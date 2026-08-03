using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Persistence;
using SecureFileStorage.Infrastructure.Security;

namespace SecureFileStorage.Infrastructure.Services;

public class DocumentService : IDocumentService
{
    private static readonly HashSet<string> PreviewableTypes =
    [
        "application/pdf",
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ];

    private readonly IDocumentRepository _documentRepository;
    private readonly IStorageService _storageService;
    private readonly IEncryptionService _encryptionService;
    private readonly IAntivirusService _antivirusService;
    private readonly IPermissionChecker _permissionChecker;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;
    private readonly ApplicationDbContext _context;
    private readonly IUnitOfWork _unitOfWork;
    private readonly StoredBlobService _storedBlobService;

    public DocumentService(
        IDocumentRepository documentRepository,
        IStorageService storageService,
        IEncryptionService encryptionService,
        IAntivirusService antivirusService,
        IPermissionChecker permissionChecker,
        IAuditService auditService,
        INotificationService notificationService,
        ApplicationDbContext context,
        IUnitOfWork unitOfWork,
        StoredBlobService storedBlobService)
    {
        _documentRepository = documentRepository;
        _storageService = storageService;
        _encryptionService = encryptionService;
        _antivirusService = antivirusService;
        _permissionChecker = permissionChecker;
        _auditService = auditService;
        _notificationService = notificationService;
        _context = context;
        _unitOfWork = unitOfWork;
        _storedBlobService = storedBlobService;
    }

    public async Task<DocumentDto> UploadAsync(
        Stream fileStream, string fileName, string contentType, Guid userId,
        DocumentUploadRequest request, CancellationToken ct = default)
    {
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, ct);
        var validation = FileValidator.Validate(fileName, contentType, ms.Length);
        if (!validation.IsValid)
            throw new InvalidOperationException(validation.Error);

        ms.Position = 0;
        var (scanResult, threat) = await _antivirusService.ScanAsync(ms, fileName, ct);
        if (scanResult == AntivirusScanResult.Infected)
        {
            await _auditService.LogAsync(
                userId,
                AuditAction.AntivirusAlert,
                "Document",
                null,
                $"Menace antivirus détectée — fichier rejeté : {fileName} ({threat})",
                "",
                success: false,
                ct: ct);
            throw new InvalidOperationException(
                $"THREAT_DETECTED: The document could not be uploaded because a security threat was detected. ({threat})");
        }

        // Temporary buffer held in memory only — permanent encrypted storage happens after a clean/skipped scan.
        ms.Position = 0;
        var plainData = ms.ToArray();

        var (blob, deduplicated) = await AcquireBlobWithRetryAsync(plainData, ct);
        var hash = blob.Sha256Hash;
        var documentId = Guid.NewGuid();

        var version = new DocumentVersion
        {
            Id = Guid.NewGuid(),
            VersionNumber = 1,
            UploadedById = userId,
            ChangeComment = request.ChangeComment
        };
        StoredBlobService.LinkVersion(version, blob);

        var document = new Document
        {
            Id = documentId,
            FileName = fileName,
            ContentType = contentType,
            SizeBytes = plainData.Length,
            Category = request.Category ?? "General",
            Description = request.Description ?? string.Empty,
            Sha256Hash = hash,
            CurrentVersion = 1,
            OwnerId = userId,
            LastScanResult = scanResult,
            LastScanAt = DateTime.UtcNow,
            Visibility = ParseVisibility(request.Visibility),
            Versions = [version]
        };

        if (document.Visibility == DocumentVisibility.Public)
        {
            document.PublicAccessLevel = !string.IsNullOrWhiteSpace(request.PublicAccessLevel) &&
                TryParseAccessLevel(request.PublicAccessLevel, out var publicLevel)
                ? publicLevel
                : ShareAccessLevel.Read;
        }

        if (document.Visibility == DocumentVisibility.Shared)
        {
            await ApplySharedUsersAsync(document, request.SharedUsers, userId, ct);
        }

        if (request.AllowedUserIds is not null)
        {
            foreach (var allowedUserId in request.AllowedUserIds.Where(id => id != userId))
            {
                document.Permissions.Add(CreateDocumentPermission(
                    allowedUserId, ShareAccessLevel.Read, userId));
            }
        }

        await _documentRepository.AddAsync(document, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogAsync(userId, AuditAction.Upload, "Document", documentId,
            deduplicated
                ? $"Téléversement de {fileName} (contenu dédupliqué — hash {hash[..12]}…)"
                : $"Téléversement de {fileName}", "", ct: ct);

        var sharedRecipientIds = document.Permissions.Select(p => p.UserId).Distinct().ToList();
        if (sharedRecipientIds.Count > 0)
        {
            await _notificationService.NotifyDocumentSharedManyAsync(
                sharedRecipientIds, userId, documentId, fileName, ct);
        }

        var saved = await _documentRepository.GetByIdAsync(documentId, ct);
        return await ToDtoAsync(saved!, userId, deduplicated, ct);
    }

    public async Task<(Stream Stream, string FileName, string ContentType)?> DownloadAsync(
        Guid documentId, Guid userId, int? version = null, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanDownloadAsync(documentId, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdWithVersionsAsync(documentId, ct);
        if (doc is null || doc.Status == DocumentStatus.Deleted) return null;

        var versionNumber = version ?? doc.CurrentVersion;
        var docVersion = doc.Versions.FirstOrDefault(v => v.VersionNumber == versionNumber);
        if (docVersion is null) return null;

        var (storagePath, encryptedKey) = StoredBlobService.ResolveStorage(docVersion);
        await using var encryptedStream = await _storageService.ReadAsync(storagePath, ct);
        using var ms = new MemoryStream();
        await encryptedStream.CopyToAsync(ms, ct);
        var plain = await _encryptionService.DecryptAsync(ms.ToArray(), encryptedKey, ct);

        await _auditService.LogAsync(userId, AuditAction.Download, "Document", documentId,
            $"Téléchargement v{versionNumber}", "", ct: ct);

        return (new MemoryStream(plain), doc.FileName, doc.ContentType);
    }

    public async Task<(Stream Stream, string ContentType)?> PreviewAsync(
        Guid documentId, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanReadAsync(documentId, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdWithVersionsAsync(documentId, ct);
        if (doc is null || doc.Status == DocumentStatus.Deleted) return null;
        if (!PreviewableTypes.Contains(doc.ContentType)) return null;

        var docVersion = doc.Versions.FirstOrDefault(v => v.VersionNumber == doc.CurrentVersion);
        if (docVersion is null) return null;

        var (storagePath, encryptedKey) = StoredBlobService.ResolveStorage(docVersion);
        await using var encryptedStream = await _storageService.ReadAsync(storagePath, ct);
        using var ms = new MemoryStream();
        await encryptedStream.CopyToAsync(ms, ct);
        var plain = await _encryptionService.DecryptAsync(ms.ToArray(), encryptedKey, ct);

        await _auditService.LogAsync(userId, AuditAction.Preview, "Document", documentId,
            "Prévisualisation", "", ct: ct);

        return (new MemoryStream(plain), doc.ContentType);
    }

    public async Task<DocumentDto?> GetByIdAsync(Guid id, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanReadAsync(id, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdAsync(id, ct);
        if (doc is null) return null;

        await _auditService.LogAsync(userId, AuditAction.View, "Document", id, "Consultation", "", ct: ct);
        return await ToDtoAsync(doc, userId, ct: ct);
    }

    public async Task<PagedResult<DocumentDto>> SearchAsync(
        DocumentSearchRequest request, Guid userId, CancellationToken ct = default)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        var isAdmin = user is not null &&
            user.UserRoles.Any(ur => ur.Role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase));

        var (items, total) = await _documentRepository.SearchAsync(request, ownerFilter: null, ct);

        if (!isAdmin)
        {
            items = items.Where(d =>
                d.OwnerId == userId ||
                d.Visibility == DocumentVisibility.Public ||
                d.Permissions.Any(p => p.UserId == userId && PermissionChecker.IsActive(p))).ToList();
            total = items.Count();
        }

        await _auditService.LogAsync(userId, AuditAction.Search, "Document", null,
            $"Recherche : {request.FileName ?? "tous"}", "", ct: ct);

        var anyLockCleared = false;
        var dtos = new List<DocumentDto>();
        var favoriteIds = await GetFavoriteIdSetAsync(userId, ct);
        foreach (var doc in items)
        {
            var hadLock = DocumentLockHelper.IsActiveLock(doc);
            DocumentLockHelper.ClearIfExpired(doc);
            if (hadLock && !DocumentLockHelper.IsActiveLock(doc))
                anyLockCleared = true;

            var canModify = PermissionChecker.CanWriteLoadedDocument(doc, userId, isAdmin);
            dtos.Add(MapDocument(doc, userId, isAdmin, false, canModify, favoriteIds.Contains(doc.Id)));
        }

        if (anyLockCleared)
            await _unitOfWork.SaveChangesAsync(ct);

        return new PagedResult<DocumentDto>(dtos, total, request.Page, request.PageSize);
    }

    public async Task<PagedResult<DocumentDto>> GetSharedWithMeAsync(
        DocumentSearchRequest request, Guid userId, CancellationToken ct = default)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        var isAdmin = user is not null &&
            user.UserRoles.Any(ur => ur.Role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase));

        var searchRequest = request with { Status = request.Status ?? "Active", Page = 1, PageSize = 500 };
        var (items, _) = await _documentRepository.SearchAsync(searchRequest, ownerFilter: null, ct);

        var shared = items
            .Where(d =>
                d.OwnerId != userId &&
                d.Status == DocumentStatus.Active &&
                (
                    d.Permissions.Any(p => p.UserId == userId && PermissionChecker.IsActive(p)) ||
                    d.Visibility == DocumentVisibility.Public
                ))
            .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt)
            .ToList();

        if (!string.IsNullOrWhiteSpace(request.FileName))
        {
            shared = shared
                .Where(d => d.FileName.Contains(request.FileName, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var total = shared.Count;
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, request.PageSize);
        var paged = shared.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var anyLockCleared = false;
        var dtos = new List<DocumentDto>();
        var favoriteIds = await GetFavoriteIdSetAsync(userId, ct);
        foreach (var doc in paged)
        {
            var hadLock = DocumentLockHelper.IsActiveLock(doc);
            DocumentLockHelper.ClearIfExpired(doc);
            if (hadLock && !DocumentLockHelper.IsActiveLock(doc))
                anyLockCleared = true;

            var canModify = PermissionChecker.CanWriteLoadedDocument(doc, userId, isAdmin);
            dtos.Add(MapDocument(doc, userId, isAdmin, false, canModify, favoriteIds.Contains(doc.Id)));
        }

        if (anyLockCleared)
            await _unitOfWork.SaveChangesAsync(ct);

        return new PagedResult<DocumentDto>(dtos, total, page, pageSize);
    }

    public async Task<IEnumerable<DocumentVersionDto>> GetVersionsAsync(
        Guid documentId, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanReadAsync(documentId, userId, ct))
            return [];

        var doc = await _documentRepository.GetByIdWithVersionsAsync(documentId, ct);
        if (doc is null) return [];

        return doc.Versions
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => new DocumentVersionDto(
                v.Id, v.VersionNumber, v.SizeBytes, v.Sha256Hash,
                v.UploadedById, v.UploadedBy?.Email ?? "", v.CreatedAt, v.ChangeComment));
    }

    public async Task<DocumentDto?> UpdateAsync(
        Guid documentId, Stream fileStream, string fileName, string contentType,
        Guid userId, string? changeComment, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanWriteAsync(documentId, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdWithVersionsAsync(documentId, ct);
        if (doc is null || doc.Status == DocumentStatus.Deleted) return null;

        var (scanResult, threat) = await _antivirusService.ScanAsync(fileStream, fileName, ct);
        if (scanResult == AntivirusScanResult.Infected)
        {
            await _auditService.LogAsync(
                userId,
                AuditAction.AntivirusAlert,
                "Document",
                documentId,
                $"Menace antivirus détectée — version rejetée : {fileName} ({threat})",
                "",
                success: false,
                ct: ct);
            throw new InvalidOperationException(
                $"THREAT_DETECTED: The document could not be uploaded because a security threat was detected. ({threat})");
        }

        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, ct);
        var plainData = ms.ToArray();
        var (blob, deduplicated) = await AcquireBlobWithRetryAsync(plainData, ct);

        var newVersionNumber = doc.CurrentVersion + 1;
        var version = new DocumentVersion
        {
            Id = Guid.NewGuid(),
            VersionNumber = newVersionNumber,
            UploadedById = userId,
            ChangeComment = changeComment
        };
        StoredBlobService.LinkVersion(version, blob);
        doc.Versions.Add(version);

        doc.CurrentVersion = newVersionNumber;
        doc.FileName = fileName;
        doc.ContentType = contentType;
        doc.SizeBytes = plainData.Length;
        doc.Sha256Hash = blob.Sha256Hash;
        doc.UpdatedAt = DateTime.UtcNow;
        doc.LastScanResult = scanResult;
        doc.LastScanAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Update, "Document", documentId,
            deduplicated
                ? $"Nouvelle version v{newVersionNumber} (contenu dédupliqué)"
                : $"Nouvelle version v{newVersionNumber}", "", ct: ct);

        return await ToDtoAsync(doc, userId, ct: ct);
    }

    public async Task<bool> ArchiveAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanWriteAsync(documentId, userId, ct))
            return false;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null) return false;

        doc.Status = DocumentStatus.Archived;
        doc.ArchivedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Archive, "Document", documentId, "Archivage", "", ct: ct);
        return true;
    }

    public async Task<bool> RestoreAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null) return false;

        if (doc.Status == DocumentStatus.Deleted)
        {
            if (!await _permissionChecker.CanRestoreFromTrashAsync(documentId, userId, ct))
                return false;
        }
        else if (!await _permissionChecker.CanWriteAsync(documentId, userId, ct))
        {
            return false;
        }

        var wasInTrash = doc.Status == DocumentStatus.Deleted;
        doc.Status = DocumentStatus.Active;
        doc.ArchivedAt = null;
        doc.DeletedAt = null;
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Restore, "Document", documentId,
            wasInTrash ? "Restauration depuis la corbeille" : "Restauration", "", ct: ct);
        return true;
    }

    public async Task<bool> SoftDeleteAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanDeleteAsync(documentId, userId, ct))
            return false;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null) return false;

        doc.Status = DocumentStatus.Deleted;
        doc.DeletedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Delete, "Document", documentId, "Déplacé vers la corbeille", "", ct: ct);
        return true;
    }

    public Task<bool> MoveToTrashAsync(Guid documentId, Guid userId, CancellationToken ct = default) =>
        SoftDeleteAsync(documentId, userId, ct);

    public async Task<PagedResult<DocumentDto>> GetTrashAsync(
        DocumentSearchRequest request, Guid userId, CancellationToken ct = default)
    {
        var trashRequest = request with { Status = DocumentStatus.Deleted.ToString() };
        return await SearchAsync(trashRequest, userId, ct);
    }

    public async Task<EmptyTrashResult> EmptyTrashAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return new EmptyTrashResult(0);

        var isAdmin = user.UserRoles.Any(ur => ur.Role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase));

        var query = _context.Documents
            .Include(d => d.Versions)
            .Include(d => d.Permissions)
            .Where(d => d.Status == DocumentStatus.Deleted);

        if (!isAdmin)
        {
            query = query.Where(d =>
                d.OwnerId == userId ||
                d.Permissions.Any(p =>
                    p.UserId == userId &&
                    (p.Permission == PermissionType.Delete || p.Permission == PermissionType.Admin)));
        }

        var docs = await query.ToListAsync(ct);
        foreach (var doc in docs)
        {
            foreach (var version in doc.Versions)
                await _storedBlobService.ReleaseVersionAsync(version, ct);

            _context.Documents.Remove(doc);
            await _auditService.LogAsync(userId, AuditAction.Delete, "Document", doc.Id,
                "Suppression définitive (vider corbeille)", "", ct: ct);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return new EmptyTrashResult(docs.Count);
    }

    public async Task<bool> GrantPermissionAsync(
        Guid documentId, GrantPermissionRequest request, Guid grantedById, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanManageSharesAsync(documentId, grantedById, ct))
            return false;

        if (!Enum.TryParse<PermissionType>(request.Permission, true, out var permission))
            return false;

        var existing = await _context.DocumentPermissions
            .FirstOrDefaultAsync(p => p.DocumentId == documentId && p.UserId == request.UserId, ct);

        if (existing is not null)
        {
            existing.Permission = permission;
        }
        else
        {
            await _context.DocumentPermissions.AddAsync(new DocumentPermission
            {
                Id = Guid.NewGuid(),
                DocumentId = documentId,
                UserId = request.UserId,
                Permission = permission,
                GrantedById = grantedById
            }, ct);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(grantedById, AuditAction.PermissionChange, "Document", documentId,
            $"Permission {permission} accordée à {request.UserId}", "", ct: ct);

        var docForNotif = await _documentRepository.GetByIdAsync(documentId, ct);
        if (docForNotif is not null)
        {
            await _notificationService.NotifyDocumentSharedAsync(
                request.UserId,
                grantedById,
                documentId,
                docForNotif.FileName,
                permission.ToString(),
                ct);
        }

        return true;
    }

    public async Task<bool> RevokePermissionAsync(
        Guid documentId, Guid targetUserId, Guid revokedById, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanManageSharesAsync(documentId, revokedById, ct))
            return false;

        var permission = await _context.DocumentPermissions
            .FirstOrDefaultAsync(p => p.DocumentId == documentId && p.UserId == targetUserId, ct);
        if (permission is null) return false;

        _context.DocumentPermissions.Remove(permission);
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(revokedById, AuditAction.PermissionChange, "Document", documentId,
            $"Permission retirée à {targetUserId}", "", ct: ct);
        return true;
    }

    public async Task<IntegrityCheckResult> VerifyIntegrityAsync(
        Guid documentId, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanReadAsync(documentId, userId, ct))
            throw new UnauthorizedAccessException();

        var doc = await _documentRepository.GetByIdWithVersionsAsync(documentId, ct);
        if (doc is null)
            throw new KeyNotFoundException("Document introuvable.");

        var version = doc.Versions.First(v => v.VersionNumber == doc.CurrentVersion);
        var (storagePath, encryptedKey) = StoredBlobService.ResolveStorage(version);
        await using var encryptedStream = await _storageService.ReadAsync(storagePath, ct);
        using var ms = new MemoryStream();
        await encryptedStream.CopyToAsync(ms, ct);
        var plain = await _encryptionService.DecryptAsync(ms.ToArray(), encryptedKey, ct);
        var actualHash = _encryptionService.ComputeSha256Hash(plain);
        var isValid = actualHash == version.Sha256Hash;

        await _auditService.LogAsync(userId, AuditAction.IntegrityCheck, "Document", documentId,
            isValid ? "Intégrité OK" : "Intégrité compromise", "", success: isValid, ct: ct);

        return new IntegrityCheckResult(
            documentId, doc.FileName, isValid, version.Sha256Hash,
            isValid ? version.Sha256Hash : actualHash,
            isValid ? "Le document est intact." : "Le document a été modifié de manière non autorisée.");
    }

    public async Task<DocumentDetailDto?> GetDetailAsync(Guid id, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanReadAsync(id, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdWithVersionsAsync(id, ct);
        if (doc is null) return null;

        var version = doc.Versions.FirstOrDefault(v => v.VersionNumber == doc.CurrentVersion);
        await RefreshExpiredLockAsync(doc, ct);
        return await ToDetailDtoAsync(doc, userId,
            version is null ? null : StoredBlobService.ResolveStorage(version).StoragePath, ct);
    }

    public async Task<DocumentDto?> UpdateMetadataAsync(
        Guid documentId, UpdateMetadataRequest request, Guid userId, bool isAdmin, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanWriteAsync(documentId, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null) return null;

        if (request.Category is not null) doc.Category = request.Category;
        if (request.Description is not null) doc.Description = request.Description;
        if (request.OwnerId.HasValue && isAdmin) doc.OwnerId = request.OwnerId.Value;
        doc.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Update, "Document", documentId, "Métadonnées modifiées", "", ct: ct);

        var updated = await _documentRepository.GetByIdAsync(documentId, ct);
        return await ToDtoAsync(updated!, userId, ct: ct);
    }

    public async Task<DocumentDto?> CheckOutAsync(
        Guid documentId, Guid userId, DocumentLockRequest? request = null, CancellationToken ct = default)
    {
        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null || doc.Status == DocumentStatus.Deleted) return null;

        var user = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return null;

        var isAdmin = user.UserRoles.Any(ur => ur.Role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase));
        var hasWrite = doc.OwnerId == userId || isAdmin ||
            doc.Permissions.Any(p =>
                p.UserId == userId &&
                PermissionChecker.IsActive(p) &&
                PermissionChecker.ResolveAccessLevel(p) == ShareAccessLevel.Write);

        if (!hasWrite)
            throw new UnauthorizedAccessException("Vous n'avez pas les droits d'écriture sur ce document.");

        await RefreshExpiredLockAsync(doc, ct);

        if (DocumentLockHelper.IsLockedByOther(doc, userId))
        {
            var holder = doc.LockedBy is not null
                ? $"{doc.LockedBy.FirstName} {doc.LockedBy.LastName}".Trim()
                : "un autre utilisateur";
            var until = doc.LockExpiresAt.HasValue ? $" jusqu'au {doc.LockExpiresAt.Value.ToLocalTime():g}" : "";
            throw new InvalidOperationException($"Document verrouillé par {holder}{until}.");
        }

        doc.LockedById = userId;
        doc.LockedAt = DateTime.UtcNow;
        doc.LockExpiresAt = DocumentLockHelper.ResolveExpiresAt(request?.ExpiresInHours);

        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.CheckOut, "Document", documentId,
            $"Verrouillage (check-out) jusqu'au {doc.LockExpiresAt:O}", "", ct: ct);

        var refreshed = await _documentRepository.GetByIdAsync(documentId, ct);
        return await ToDtoAsync(refreshed!, userId, ct: ct);
    }

    public async Task<DocumentDto?> CheckInAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null) return null;

        await RefreshExpiredLockAsync(doc, ct);

        if (!DocumentLockHelper.IsActiveLock(doc))
            return await ToDtoAsync(doc, userId, ct: ct);

        var user = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return null;

        var isAdmin = user.UserRoles.Any(ur => ur.Role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase));
        var canRelease = doc.LockedById == userId || doc.OwnerId == userId || isAdmin;

        if (!canRelease)
            throw new InvalidOperationException("Seul le détenteur du verrou, le propriétaire ou un administrateur peut libérer le document.");

        DocumentLockHelper.ReleaseLock(doc);
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.CheckIn, "Document", documentId,
            "Libération du verrou (check-in)", "", ct: ct);

        return await ToDtoAsync(doc, userId, ct: ct);
    }

    public async Task<DocumentDto?> RestoreVersionAsync(
        Guid documentId, int versionNumber, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanWriteAsync(documentId, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdWithVersionsAsync(documentId, ct);
        if (doc is null) return null;

        var source = doc.Versions.FirstOrDefault(v => v.VersionNumber == versionNumber);
        if (source is null) return null;

        var (blob, deduplicated) = await _storedBlobService.AcquireFromVersionAsync(source, ct);

        var newVersionNumber = doc.CurrentVersion + 1;
        var version = new DocumentVersion
        {
            Id = Guid.NewGuid(),
            VersionNumber = newVersionNumber,
            UploadedById = userId,
            ChangeComment = $"Restauration depuis la version {versionNumber}"
        };
        StoredBlobService.LinkVersion(version, blob);
        doc.Versions.Add(version);

        doc.CurrentVersion = newVersionNumber;
        doc.Sha256Hash = blob.Sha256Hash;
        doc.SizeBytes = blob.SizeBytes;
        doc.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Restore, "Document", documentId,
            deduplicated
                ? $"Version {versionNumber} restaurée comme v{newVersionNumber} (blob partagé)"
                : $"Version {versionNumber} restaurée comme v{newVersionNumber}", "", ct: ct);

        return await ToDtoAsync(doc, userId, ct: ct);
    }

    public async Task<bool> PermanentDeleteAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var user = await _context.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || !user.UserRoles.Any(ur => ur.Role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase)))
            return false;

        var doc = await _documentRepository.GetByIdWithVersionsAsync(documentId, ct);
        if (doc is null) return false;

        foreach (var v in doc.Versions)
            await _storedBlobService.ReleaseVersionAsync(v, ct);

        _context.Documents.Remove(doc);
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Delete, "Document", documentId, "Suppression définitive", "", ct: ct);
        return true;
    }

    public async Task<DocumentUserShareDto?> ShareWithUserAsync(
        Guid documentId, ShareWithUserRequest request, Guid sharedById, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanManageSharesAsync(documentId, sharedById, ct))
            return null;

        if (!TryParseAccessLevel(request.AccessLevel, out var accessLevel))
            return null;

        var targetUserId = request.UserId;
        if (targetUserId is null && !string.IsNullOrWhiteSpace(request.UserEmail))
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.UserEmail.Trim(), ct);
            if (user is null) return null;
            targetUserId = user.Id;
        }

        if (targetUserId is null) return null;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null || doc.OwnerId == targetUserId) return null;

        var expiresAt = ResolveExpiresAt(request.ExpiresAt, request.ExpiresInHours);
        var permissionType = accessLevel == ShareAccessLevel.Write ? PermissionType.Write : PermissionType.Read;

        var existing = await _context.DocumentPermissions
            .FirstOrDefaultAsync(p => p.DocumentId == documentId && p.UserId == targetUserId, ct);

        if (existing is not null)
        {
            existing.Permission = permissionType;
            existing.AccessLevel = accessLevel;
            existing.ExpiresAt = expiresAt;
            existing.GrantedById = sharedById;
            existing.GrantedAt = DateTime.UtcNow;
        }
        else
        {
            existing = new DocumentPermission
            {
                Id = Guid.NewGuid(),
                DocumentId = documentId,
                UserId = targetUserId.Value,
                Permission = permissionType,
                AccessLevel = accessLevel,
                ExpiresAt = expiresAt,
                GrantedById = sharedById
            };
            await _context.DocumentPermissions.AddAsync(existing, ct);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(sharedById, AuditAction.Share, "Document", documentId,
            $"Partage {accessLevel} avec {targetUserId} jusqu'à {(expiresAt?.ToString("O") ?? "sans limite")}", "", ct: ct);

        await _notificationService.NotifyDocumentSharedAsync(
            targetUserId.Value,
            sharedById,
            documentId,
            doc.FileName,
            accessLevel.ToString(),
            ct);

        var target = await _context.Users.FirstAsync(u => u.Id == targetUserId, ct);
        return MapUserShare(existing, target);
    }

    public async Task<CreateShareLinkResponse?> CreateShareLinkAsync(
        Guid documentId, CreateShareLinkRequest request, Guid createdById, string baseUrl, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanManageSharesAsync(documentId, createdById, ct))
            return null;

        if (!TryParseAccessLevel(request.AccessLevel, out var accessLevel))
            return null;

        var expiresAt = ResolveExpiresAt(request.ExpiresAt, request.ExpiresInHours)
            ?? DateTime.UtcNow.AddHours(48);

        var token = GenerateShareToken();
        var link = new DocumentShareLink
        {
            Id = Guid.NewGuid(),
            DocumentId = documentId,
            TokenHash = HashToken(token),
            AccessLevel = accessLevel,
            ExpiresAt = expiresAt,
            CreatedById = createdById
        };

        await _context.DocumentShareLinks.AddAsync(link, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(createdById, AuditAction.Share, "Document", documentId,
            $"Lien de partage {accessLevel} jusqu'au {expiresAt:O}", "", ct: ct);

        var shareUrl = $"{baseUrl.TrimEnd('/')}/share.html?token={Uri.EscapeDataString(token)}";
        return new CreateShareLinkResponse(link.Id, token, shareUrl, accessLevel.ToString(), expiresAt);
    }

    public async Task<DocumentSharesDto?> GetSharesAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanManageSharesAsync(documentId, userId, ct))
            return null;

        var userShares = await _context.DocumentPermissions
            .Include(p => p.User)
            .Where(p => p.DocumentId == documentId)
            .OrderByDescending(p => p.GrantedAt)
            .ToListAsync(ct);

        var links = await _context.DocumentShareLinks
            .Where(l => l.DocumentId == documentId && !l.IsRevoked)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(ct);

        return new DocumentSharesDto(
            userShares.Select(p => MapUserShare(p, p.User)),
            links.Select(MapShareLink));
    }

    public async Task<bool> RevokeShareLinkAsync(Guid documentId, Guid linkId, Guid revokedById, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanManageSharesAsync(documentId, revokedById, ct))
            return false;

        var link = await _context.DocumentShareLinks
            .FirstOrDefaultAsync(l => l.Id == linkId && l.DocumentId == documentId, ct);
        if (link is null || link.IsRevoked) return false;

        link.IsRevoked = true;
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(revokedById, AuditAction.PermissionChange, "Document", documentId,
            $"Lien de partage révoqué {linkId}", "", ct: ct);
        return true;
    }

    public async Task<SharedDocumentInfoDto?> GetSharedInfoAsync(string token, CancellationToken ct = default)
    {
        var link = await FindActiveShareLinkAsync(token, ShareAccessLevel.Read, ct);
        if (link is null) return null;

        var doc = link.Document;
        return new SharedDocumentInfoDto(
            doc.Id, doc.FileName, doc.ContentType, doc.SizeBytes,
            link.AccessLevel.ToString(), link.ExpiresAt,
            $"{doc.Owner.FirstName} {doc.Owner.LastName}");
    }

    public async Task<(Stream Stream, string ContentType)?> PreviewByTokenAsync(string token, CancellationToken ct = default)
    {
        var payload = await ReadDocumentByTokenAsync(token, ShareAccessLevel.Read, ct);
        if (payload is null) return null;
        if (!PreviewableTypes.Contains(payload.Value.ContentType)) return null;

        await _auditService.LogAsync(null, AuditAction.Preview, "Document", payload.Value.DocumentId,
            "Prévisualisation via lien de partage", "", ct: ct);

        return (payload.Value.Stream, payload.Value.ContentType);
    }

    public async Task<(Stream Stream, string FileName, string ContentType)?> DownloadByTokenAsync(string token, CancellationToken ct = default)
    {
        var payload = await ReadDocumentByTokenAsync(token, ShareAccessLevel.Download, ct);
        if (payload is null) return null;

        await _auditService.LogAsync(null, AuditAction.Download, "Document", payload.Value.DocumentId,
            "Téléchargement via lien de partage", "", ct: ct);

        return (payload.Value.Stream, payload.Value.FileName, payload.Value.ContentType);
    }

    private async Task<(Stream Stream, string FileName, string ContentType, Guid DocumentId)?> ReadDocumentByTokenAsync(
        string token, ShareAccessLevel requiredLevel, CancellationToken ct)
    {
        var link = await FindActiveShareLinkAsync(token, requiredLevel, ct);
        if (link is null) return null;

        var doc = link.Document;
        var version = doc.Versions.FirstOrDefault(v => v.VersionNumber == doc.CurrentVersion);
        if (version is null) return null;

        var (storagePath, encryptedKey) = StoredBlobService.ResolveStorage(version);
        await using var encryptedStream = await _storageService.ReadAsync(storagePath, ct);
        using var ms = new MemoryStream();
        await encryptedStream.CopyToAsync(ms, ct);
        var plain = await _encryptionService.DecryptAsync(ms.ToArray(), encryptedKey, ct);

        return (new MemoryStream(plain), doc.FileName, doc.ContentType, doc.Id);
    }

    private async Task<(StoredBlob Blob, bool Deduplicated)> AcquireBlobWithRetryAsync(
        byte[] plainData, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var (blob, deduplicated) = await _storedBlobService.AcquireAsync(plainData, ct);

            try
            {
                await _unitOfWork.SaveChangesAsync(ct);
                return (blob, deduplicated);
            }
            catch (DbUpdateException) when (attempt == 0 && !deduplicated)
            {
                await _storedBlobService.RollbackNewBlobAsync(blob, ct);
                await _unitOfWork.SaveChangesAsync(ct);
            }
        }

        var fallback = await _storedBlobService.AcquireAsync(plainData, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return fallback;
    }

    private async Task<DocumentShareLink?> FindActiveShareLinkAsync(
        string token, ShareAccessLevel requiredLevel, CancellationToken ct)
    {
        var hash = HashToken(token);
        var link = await _context.DocumentShareLinks
            .Include(l => l.Document).ThenInclude(d => d.Versions).ThenInclude(v => v.StoredBlob)
            .Include(l => l.Document).ThenInclude(d => d.Owner)
            .FirstOrDefaultAsync(l => l.TokenHash == hash && !l.IsRevoked, ct);

        if (link is null || link.ExpiresAt <= DateTime.UtcNow) return null;
        if (link.Document.Status == DocumentStatus.Deleted) return null;
        if (link.AccessLevel < requiredLevel) return null;
        return link;
    }

    private static DocumentUserShareDto MapUserShare(DocumentPermission permission, User user)
    {
        var level = PermissionChecker.ResolveAccessLevel(permission);
        var expired = permission.ExpiresAt.HasValue && permission.ExpiresAt <= DateTime.UtcNow;
        return new DocumentUserShareDto(
            permission.Id,
            permission.UserId,
            user.Email,
            $"{user.FirstName} {user.LastName}",
            level.ToString(),
            permission.GrantedAt,
            permission.ExpiresAt,
            expired);
    }

    private static ShareLinkDto MapShareLink(DocumentShareLink link) =>
        new(link.Id, link.AccessLevel.ToString(), link.CreatedAt, link.ExpiresAt, link.IsRevoked,
            link.ExpiresAt <= DateTime.UtcNow);

    private static bool TryParseAccessLevel(string value, out ShareAccessLevel accessLevel) =>
        Enum.TryParse(value, true, out accessLevel) &&
        Enum.IsDefined(typeof(ShareAccessLevel), accessLevel);

    private static DateTime? ResolveExpiresAt(DateTime? expiresAt, int? expiresInHours)
    {
        if (expiresAt.HasValue) return expiresAt.Value.ToUniversalTime();
        if (expiresInHours.HasValue && expiresInHours.Value > 0)
            return DateTime.UtcNow.AddHours(expiresInHours.Value);
        return null;
    }

    private static string GenerateShareToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private async Task RefreshExpiredLockAsync(Document doc, CancellationToken ct)
    {
        var hadActiveLock = DocumentLockHelper.IsActiveLock(doc);
        DocumentLockHelper.ClearIfExpired(doc);
        if (hadActiveLock && !DocumentLockHelper.IsActiveLock(doc))
            await _unitOfWork.SaveChangesAsync(ct);
    }

    private async Task<DocumentDto> ToDtoAsync(
        Document doc, Guid userId, bool wasDeduplicated = false, CancellationToken ct = default)
    {
        await RefreshExpiredLockAsync(doc, ct);
        var user = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        var isAdmin = user is not null &&
            user.UserRoles.Any(ur => ur.Role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase));
        var canModify = await _permissionChecker.CanWriteAsync(doc.Id, userId, ct);
        var isFavorite = await _context.DocumentFavorites
            .AnyAsync(f => f.UserId == userId && f.DocumentId == doc.Id, ct);
        return MapDocument(doc, userId, isAdmin, wasDeduplicated, canModify, isFavorite);
    }

    private async Task<HashSet<Guid>> GetFavoriteIdSetAsync(Guid userId, CancellationToken ct) =>
        (await _context.DocumentFavorites
            .AsNoTracking()
            .Where(f => f.UserId == userId)
            .Select(f => f.DocumentId)
            .ToListAsync(ct)).ToHashSet();

    public async Task<FavoriteToggleResult?> AddFavoriteAsync(
        Guid documentId, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanReadAsync(documentId, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null || doc.Status == DocumentStatus.Deleted) return null;

        var existing = await _context.DocumentFavorites
            .FirstOrDefaultAsync(f => f.UserId == userId && f.DocumentId == documentId, ct);
        if (existing is null)
        {
            await _context.DocumentFavorites.AddAsync(new DocumentFavorite
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                DocumentId = documentId,
                CreatedAt = DateTime.UtcNow
            }, ct);
            await _unitOfWork.SaveChangesAsync(ct);
            await _auditService.LogAsync(userId, AuditAction.Favorite, "Document", documentId,
                "Ajout aux favoris", "", ct: ct);
        }

        return new FavoriteToggleResult(documentId, true);
    }

    public async Task<FavoriteToggleResult?> RemoveFavoriteAsync(
        Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var existing = await _context.DocumentFavorites
            .FirstOrDefaultAsync(f => f.UserId == userId && f.DocumentId == documentId, ct);
        if (existing is null)
            return new FavoriteToggleResult(documentId, false);

        _context.DocumentFavorites.Remove(existing);
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Favorite, "Document", documentId,
            "Retrait des favoris", "", ct: ct);
        return new FavoriteToggleResult(documentId, false);
    }

    public async Task<PagedResult<DocumentDto>> GetFavoritesAsync(
        DocumentSearchRequest request, Guid userId, CancellationToken ct = default)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        var isAdmin = user is not null &&
            user.UserRoles.Any(ur => ur.Role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase));

        var query = _context.DocumentFavorites
            .AsNoTracking()
            .Where(f => f.UserId == userId)
            .Include(f => f.Document).ThenInclude(d => d.Owner)
            .Include(f => f.Document).ThenInclude(d => d.Permissions)
            .Include(f => f.Document).ThenInclude(d => d.LockedBy)
            .Where(f => f.Document.Status != DocumentStatus.Deleted)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.FileName))
            query = query.Where(f => f.Document.FileName.Contains(request.FileName));
        if (!string.IsNullOrWhiteSpace(request.Category))
            query = query.Where(f => f.Document.Category == request.Category);
        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<DocumentStatus>(request.Status, true, out var status))
            query = query.Where(f => f.Document.Status == status);

        var favorites = await query
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync(ct);

        var accessible = new List<Document>();
        foreach (var fav in favorites)
        {
            var doc = fav.Document;
            if (isAdmin ||
                doc.OwnerId == userId ||
                doc.Visibility == DocumentVisibility.Public ||
                doc.Permissions.Any(p => p.UserId == userId && PermissionChecker.IsActive(p)))
            {
                accessible.Add(doc);
            }
        }

        var total = accessible.Count;
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, request.PageSize);
        var paged = accessible.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var dtos = paged.Select(doc =>
        {
            var canModify = PermissionChecker.CanWriteLoadedDocument(doc, userId, isAdmin);
            return MapDocument(doc, userId, isAdmin, false, canModify, true);
        }).ToList();

        return new PagedResult<DocumentDto>(dtos, total, page, pageSize);
    }

    public async Task<DocumentCollaboratorsDto?> GetCollaboratorsAsync(
        Guid documentId, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanReadAsync(documentId, userId, ct))
            return null;

        var doc = await _context.Documents
            .AsNoTracking()
            .Include(d => d.Owner)
            .Include(d => d.Permissions).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(d => d.Id == documentId, ct);
        if (doc is null) return null;

        var canManage = await _permissionChecker.CanManageSharesAsync(documentId, userId, ct);
        var owner = new DocumentCollaboratorDto(
            doc.OwnerId,
            $"{doc.Owner.FirstName} {doc.Owner.LastName}".Trim(),
            doc.Owner.Email,
            "Owner",
            "Owner");

        var collaborators = doc.Permissions
            .OrderByDescending(p => p.GrantedAt)
            .Select(p =>
            {
                var level = PermissionChecker.ResolveAccessLevel(p);
                var expired = p.ExpiresAt.HasValue && p.ExpiresAt <= DateTime.UtcNow;
                return new DocumentCollaboratorDto(
                    p.UserId,
                    $"{p.User.FirstName} {p.User.LastName}".Trim(),
                    p.User.Email,
                    "Collaborator",
                    level.ToString(),
                    p.Id,
                    p.GrantedAt,
                    p.ExpiresAt,
                    expired);
            })
            .ToList();

        return new DocumentCollaboratorsDto(owner, collaborators, canManage);
    }

    private async Task<DocumentDetailDto> ToDetailDtoAsync(
        Document doc, Guid userId, string? storagePath, CancellationToken ct = default)
    {
        await RefreshExpiredLockAsync(doc, ct);
        var canModify = await _permissionChecker.CanWriteAsync(doc.Id, userId, ct);
        return MapDetail(doc, storagePath, userId, canModify);
    }

    private static DocumentDetailDto MapDetail(
        Document doc, string? storagePath, Guid userId, bool canModify) =>
        new(doc.Id, doc.FileName, FileValidator.GetExtension(doc.FileName), doc.ContentType, doc.SizeBytes,
            doc.Category, doc.Description, doc.Sha256Hash, doc.CurrentVersion, doc.Status.ToString(),
            doc.OwnerId, $"{doc.Owner.FirstName} {doc.Owner.LastName}", doc.CreatedAt, doc.UpdatedAt,
            doc.LastScanResult.ToString(), storagePath,
            DocumentLockHelper.IsActiveLock(doc),
            doc.LockedById,
            doc.LockedBy is not null ? $"{doc.LockedBy.FirstName} {doc.LockedBy.LastName}".Trim() : null,
            doc.LockedAt,
            doc.LockExpiresAt,
            DocumentLockHelper.IsLockedByUser(doc, userId),
            canModify,
            doc.Visibility.ToString(),
            doc.PublicAccessLevel.ToString());

    private static DocumentDto MapDocument(
        Document doc, Guid userId, bool isAdmin, bool wasDeduplicated = false, bool canModify = false,
        bool isFavorite = false)
    {
        var myLevel = PermissionChecker.GetEffectiveLevelOnDocument(doc, userId, isAdmin);
        return new(doc.Id, doc.FileName, doc.ContentType, doc.SizeBytes, doc.Category, doc.Description,
            doc.Sha256Hash, doc.CurrentVersion, doc.Status.ToString(), doc.OwnerId,
            $"{doc.Owner.FirstName} {doc.Owner.LastName}", doc.CreatedAt, doc.UpdatedAt, doc.DeletedAt,
            doc.LastScanResult.ToString(), wasDeduplicated,
            DocumentLockHelper.IsActiveLock(doc),
            doc.LockedById,
            doc.LockedBy is not null ? $"{doc.LockedBy.FirstName} {doc.LockedBy.LastName}".Trim() : null,
            doc.LockedAt,
            doc.LockExpiresAt,
            DocumentLockHelper.IsLockedByUser(doc, userId),
            canModify,
            doc.Visibility.ToString(),
            doc.PublicAccessLevel.ToString(),
            myLevel?.ToString(),
            doc.OwnerId == userId,
            isFavorite);
    }

    private static DocumentVisibility ParseVisibility(string? value) =>
        Enum.TryParse<DocumentVisibility>(value, true, out var v) ? v : DocumentVisibility.Private;

    private async Task ApplySharedUsersAsync(
        Document document, IEnumerable<UploadShareEntry>? entries, Guid ownerId, CancellationToken ct)
    {
        if (entries is null) return;

        var seenUserIds = new HashSet<Guid>();

        foreach (var entry in entries)
        {
            if (string.IsNullOrWhiteSpace(entry.UserEmail)) continue;
            var email = entry.UserEmail.Trim();
            var user = await _context.Users.FirstOrDefaultAsync(
                u => u.Email.ToLower() == email.ToLower(), ct);
            if (user is null || user.Id == ownerId || !seenUserIds.Add(user.Id)) continue;

            if (!TryParseAccessLevel(entry.AccessLevel, out var accessLevel))
                accessLevel = ShareAccessLevel.Read;

            document.Permissions.Add(CreateDocumentPermission(user.Id, accessLevel, ownerId));
        }
    }

    private static DocumentPermission CreateDocumentPermission(
        Guid targetUserId, ShareAccessLevel accessLevel, Guid grantedById) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = targetUserId,
            Permission = accessLevel == ShareAccessLevel.Write ? PermissionType.Write : PermissionType.Read,
            AccessLevel = accessLevel,
            GrantedById = grantedById
        };
}

public class StorageConfigService : IStorageConfigService
{
    private readonly ApplicationDbContext _context;
    private readonly IUnitOfWork _unitOfWork;

    public StorageConfigService(ApplicationDbContext context, IUnitOfWork unitOfWork)
    {
        _context = context;
        _unitOfWork = unitOfWork;
    }

    public async Task<StorageConfigDto?> GetActiveAsync(CancellationToken ct = default)
    {
        var config = await _context.StorageConfigurations.FirstOrDefaultAsync(c => c.IsActive, ct);
        return config is null ? null : Map(config);
    }

    public async Task<StorageConfigDto> UpdateAsync(UpdateStorageConfigRequest request, CancellationToken ct = default)
    {
        var existing = await _context.StorageConfigurations.Where(c => c.IsActive).ToListAsync(ct);
        var previous = existing.OrderByDescending(c => c.UpdatedAt).FirstOrDefault();
        foreach (var c in existing) c.IsActive = false;

        var connectionString = ResolveConnectionString(request.ConnectionString, previous?.ConnectionString);

        var config = new StorageConfiguration
        {
            Id = Guid.NewGuid(),
            ProviderType = Enum.TryParse<StorageProviderType>(request.ProviderType, true, out var provider)
                ? provider
                : previous?.ProviderType ?? StorageProviderType.LocalFileSystem,
            DatabaseProvider = Enum.Parse<DatabaseProviderType>(request.DatabaseProvider, true),
            BasePath = string.IsNullOrWhiteSpace(request.BasePath)
                ? previous?.BasePath ?? "./storage"
                : request.BasePath,
            ConnectionString = connectionString,
            S3Endpoint = request.S3Endpoint ?? previous?.S3Endpoint,
            S3Bucket = request.S3Bucket ?? previous?.S3Bucket,
            S3AccessKey = request.S3AccessKey ?? previous?.S3AccessKey,
            S3SecretKey = request.S3SecretKey ?? previous?.S3SecretKey,
            IsActive = true,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.StorageConfigurations.AddAsync(config, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return Map(config);
    }

    private static string? ResolveConnectionString(string? incoming, string? previous)
    {
        if (string.IsNullOrWhiteSpace(incoming)) return previous;
        if (incoming.Contains("********", StringComparison.Ordinal)) return previous;
        return incoming.Trim();
    }

    private static StorageConfigDto Map(StorageConfiguration c) =>
        new(c.Id, c.ProviderType.ToString(), c.DatabaseProvider.ToString(), c.BasePath,
            MaskConnectionString(c.ConnectionString), c.S3Endpoint, c.S3Bucket, c.IsActive, c.UpdatedAt);

    private static string? MaskConnectionString(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return System.Text.RegularExpressions.Regex.Replace(
            value,
            @"(Password|Pwd)\s*=\s*[^;]+",
            "$1=********",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }
}
