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
    private readonly ApplicationDbContext _context;
    private readonly IUnitOfWork _unitOfWork;

    public DocumentService(
        IDocumentRepository documentRepository,
        IStorageService storageService,
        IEncryptionService encryptionService,
        IAntivirusService antivirusService,
        IPermissionChecker permissionChecker,
        IAuditService auditService,
        ApplicationDbContext context,
        IUnitOfWork unitOfWork)
    {
        _documentRepository = documentRepository;
        _storageService = storageService;
        _encryptionService = encryptionService;
        _antivirusService = antivirusService;
        _permissionChecker = permissionChecker;
        _auditService = auditService;
        _context = context;
        _unitOfWork = unitOfWork;
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
            throw new InvalidOperationException($"Fichier infecté détecté : {threat}");

        ms.Position = 0;
        var plainData = ms.ToArray();
        var hash = _encryptionService.ComputeSha256Hash(plainData);

        var (encryptedData, encryptedKey) = await _encryptionService.EncryptAsync(plainData, ct);
        var documentId = Guid.NewGuid();
        var storagePath = $"{documentId:N}/v1.enc";

        await using var encryptedStream = new MemoryStream(encryptedData);
        await _storageService.SaveAsync(encryptedStream, storagePath, ct);

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
            Versions =
            [
                new DocumentVersion
                {
                    Id = Guid.NewGuid(),
                    VersionNumber = 1,
                    StoragePath = storagePath,
                    EncryptedKey = encryptedKey,
                    Sha256Hash = hash,
                    SizeBytes = plainData.Length,
                    UploadedById = userId,
                    ChangeComment = request.ChangeComment
                }
            ]
        };

        if (request.AllowedUserIds is not null)
        {
            foreach (var allowedUserId in request.AllowedUserIds.Where(id => id != userId))
            {
                document.Permissions.Add(new DocumentPermission
                {
                    Id = Guid.NewGuid(),
                    UserId = allowedUserId,
                    Permission = PermissionType.Read,
                    GrantedById = userId
                });
            }
        }

        await _documentRepository.AddAsync(document, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogAsync(userId, AuditAction.Upload, "Document", documentId,
            $"Téléversement de {fileName}", "", ct: ct);

        var saved = await _documentRepository.GetByIdAsync(documentId, ct);
        return MapDocument(saved!);
    }

    public async Task<(Stream Stream, string FileName, string ContentType)?> DownloadAsync(
        Guid documentId, Guid userId, int? version = null, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanReadAsync(documentId, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdWithVersionsAsync(documentId, ct);
        if (doc is null || doc.Status == DocumentStatus.Deleted) return null;

        var versionNumber = version ?? doc.CurrentVersion;
        var docVersion = doc.Versions.FirstOrDefault(v => v.VersionNumber == versionNumber);
        if (docVersion is null) return null;

        await using var encryptedStream = await _storageService.ReadAsync(docVersion.StoragePath, ct);
        using var ms = new MemoryStream();
        await encryptedStream.CopyToAsync(ms, ct);
        var plain = await _encryptionService.DecryptAsync(ms.ToArray(), docVersion.EncryptedKey, ct);

        await _auditService.LogAsync(userId, AuditAction.Download, "Document", documentId,
            $"Téléchargement v{versionNumber}", "", ct: ct);

        return (new MemoryStream(plain), doc.FileName, doc.ContentType);
    }

    public async Task<(Stream Stream, string ContentType)?> PreviewAsync(
        Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var download = await DownloadAsync(documentId, userId, ct: ct);
        if (download is null) return null;

        if (!PreviewableTypes.Contains(download.Value.ContentType))
            return null;

        await _auditService.LogAsync(userId, AuditAction.Preview, "Document", documentId,
            "Prévisualisation", "", ct: ct);

        return (download.Value.Stream, download.Value.ContentType);
    }

    public async Task<DocumentDto?> GetByIdAsync(Guid id, Guid userId, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanReadAsync(id, userId, ct))
            return null;

        var doc = await _documentRepository.GetByIdAsync(id, ct);
        if (doc is null) return null;

        await _auditService.LogAsync(userId, AuditAction.View, "Document", id, "Consultation", "", ct: ct);
        return MapDocument(doc);
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
                d.Permissions.Any(p => p.UserId == userId)).ToList();
            total = items.Count();
        }

        await _auditService.LogAsync(userId, AuditAction.Search, "Document", null,
            $"Recherche : {request.FileName ?? "tous"}", "", ct: ct);

        return new PagedResult<DocumentDto>(
            items.Select(MapDocument), total, request.Page, request.PageSize);
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
            throw new InvalidOperationException($"Fichier infecté détecté : {threat}");

        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, ct);
        var plainData = ms.ToArray();
        var hash = _encryptionService.ComputeSha256Hash(plainData);
        var (encryptedData, encryptedKey) = await _encryptionService.EncryptAsync(plainData, ct);

        var newVersionNumber = doc.CurrentVersion + 1;
        var storagePath = $"{documentId:N}/v{newVersionNumber}.enc";

        await using var encryptedStream = new MemoryStream(encryptedData);
        await _storageService.SaveAsync(encryptedStream, storagePath, ct);

        doc.Versions.Add(new DocumentVersion
        {
            Id = Guid.NewGuid(),
            VersionNumber = newVersionNumber,
            StoragePath = storagePath,
            EncryptedKey = encryptedKey,
            Sha256Hash = hash,
            SizeBytes = plainData.Length,
            UploadedById = userId,
            ChangeComment = changeComment
        });

        doc.CurrentVersion = newVersionNumber;
        doc.FileName = fileName;
        doc.ContentType = contentType;
        doc.SizeBytes = plainData.Length;
        doc.Sha256Hash = hash;
        doc.UpdatedAt = DateTime.UtcNow;
        doc.LastScanResult = scanResult;
        doc.LastScanAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Update, "Document", documentId,
            $"Nouvelle version v{newVersionNumber}", "", ct: ct);

        return MapDocument(doc);
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
                await _storageService.DeleteAsync(version.StoragePath, ct);

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
        if (!await _permissionChecker.CanWriteAsync(documentId, grantedById, ct))
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
        return true;
    }

    public async Task<bool> RevokePermissionAsync(
        Guid documentId, Guid targetUserId, Guid revokedById, CancellationToken ct = default)
    {
        if (!await _permissionChecker.CanWriteAsync(documentId, revokedById, ct))
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
        await using var encryptedStream = await _storageService.ReadAsync(version.StoragePath, ct);
        using var ms = new MemoryStream();
        await encryptedStream.CopyToAsync(ms, ct);
        var plain = await _encryptionService.DecryptAsync(ms.ToArray(), version.EncryptedKey, ct);
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
        return MapDetail(doc, version?.StoragePath);
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
        return MapDocument(updated!);
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

        await using var encryptedStream = await _storageService.ReadAsync(source.StoragePath, ct);
        using var ms = new MemoryStream();
        await encryptedStream.CopyToAsync(ms, ct);
        var plain = await _encryptionService.DecryptAsync(ms.ToArray(), source.EncryptedKey, ct);

        var newVersionNumber = doc.CurrentVersion + 1;
        var (encryptedData, encryptedKey) = await _encryptionService.EncryptAsync(plain, ct);
        var storagePath = $"{documentId:N}/v{newVersionNumber}.enc";

        await using var encryptedOut = new MemoryStream(encryptedData);
        await _storageService.SaveAsync(encryptedOut, storagePath, ct);

        doc.Versions.Add(new DocumentVersion
        {
            Id = Guid.NewGuid(),
            VersionNumber = newVersionNumber,
            StoragePath = storagePath,
            EncryptedKey = encryptedKey,
            Sha256Hash = source.Sha256Hash,
            SizeBytes = source.SizeBytes,
            UploadedById = userId,
            ChangeComment = $"Restauration depuis la version {versionNumber}"
        });

        doc.CurrentVersion = newVersionNumber;
        doc.Sha256Hash = source.Sha256Hash;
        doc.SizeBytes = source.SizeBytes;
        doc.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Restore, "Document", documentId,
            $"Version {versionNumber} restaurée comme v{newVersionNumber}", "", ct: ct);

        return MapDocument(doc);
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
            await _storageService.DeleteAsync(v.StoragePath, ct);

        _context.Documents.Remove(doc);
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(userId, AuditAction.Delete, "Document", documentId, "Suppression définitive", "", ct: ct);
        return true;
    }

    private static DocumentDetailDto MapDetail(Document doc, string? storagePath) =>
        new(doc.Id, doc.FileName, FileValidator.GetExtension(doc.FileName), doc.ContentType, doc.SizeBytes,
            doc.Category, doc.Description, doc.Sha256Hash, doc.CurrentVersion, doc.Status.ToString(),
            doc.OwnerId, $"{doc.Owner.FirstName} {doc.Owner.LastName}", doc.CreatedAt, doc.UpdatedAt,
            doc.LastScanResult.ToString(), storagePath);

    private static DocumentDto MapDocument(Document doc) =>
        new(doc.Id, doc.FileName, doc.ContentType, doc.SizeBytes, doc.Category, doc.Description,
            doc.Sha256Hash, doc.CurrentVersion, doc.Status.ToString(), doc.OwnerId,
            $"{doc.Owner.FirstName} {doc.Owner.LastName}", doc.CreatedAt, doc.UpdatedAt, doc.DeletedAt,
            doc.LastScanResult.ToString());
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
        foreach (var c in existing) c.IsActive = false;

        var config = new StorageConfiguration
        {
            Id = Guid.NewGuid(),
            ProviderType = Enum.Parse<StorageProviderType>(request.ProviderType, true),
            DatabaseProvider = Enum.Parse<DatabaseProviderType>(request.DatabaseProvider, true),
            BasePath = request.BasePath,
            S3Endpoint = request.S3Endpoint,
            S3Bucket = request.S3Bucket,
            S3AccessKey = request.S3AccessKey,
            S3SecretKey = request.S3SecretKey,
            IsActive = true,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.StorageConfigurations.AddAsync(config, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return Map(config);
    }

    private static StorageConfigDto Map(StorageConfiguration c) =>
        new(c.Id, c.ProviderType.ToString(), c.DatabaseProvider.ToString(), c.BasePath,
            c.S3Endpoint, c.S3Bucket, c.IsActive, c.UpdatedAt);
}
