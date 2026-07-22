using System.Text;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;

namespace SecureFileStorage.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly IAuditRepository _auditRepository;
    private readonly IUnitOfWork _unitOfWork;

    public AuditService(IAuditRepository auditRepository, IUnitOfWork unitOfWork)
    {
        _auditRepository = auditRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task LogAsync(
        Guid? userId, AuditAction action, string resourceType, Guid? resourceId,
        string details, string ipAddress, bool success = true, CancellationToken ct = default)
    {
        if (!resourceType.Equals("Document", StringComparison.OrdinalIgnoreCase))
            return;

        await _auditRepository.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            ResourceType = resourceType,
            ResourceId = resourceId,
            Details = details,
            IpAddress = ipAddress,
            Success = success,
            Timestamp = DateTime.UtcNow
        }, ct);
        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<AuditLogDto>> SearchAsync(AuditSearchRequest request, CancellationToken ct = default)
    {
        var (items, total) = await _auditRepository.SearchAsync(request, ct);
        var dtos = items.Select(a => new AuditLogDto(
            a.Id, a.UserId, a.User?.Email, a.Action.ToString(), a.ResourceType,
            a.ResourceId, a.Details, a.IpAddress, a.Success, a.Timestamp));
        return new PagedResult<AuditLogDto>(dtos, total, request.Page, request.PageSize);
    }

    public async Task<byte[]> ExportAsync(AuditSearchRequest request, CancellationToken ct = default)
    {
        request = request with { PageSize = 10000 };
        var result = await SearchAsync(request, ct);
        var sb = new StringBuilder();
        sb.AppendLine("Id,UserId,UserEmail,Action,ResourceType,ResourceId,Details,IpAddress,Success,Timestamp");
        foreach (var log in result.Items)
        {
            sb.AppendLine($"{log.Id},{log.UserId},{log.UserEmail},{log.Action},{log.ResourceType},{log.ResourceId},\"{log.Details.Replace("\"", "'")}\",{log.IpAddress},{log.Success},{log.Timestamp:O}");
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}

public class PermissionChecker : IPermissionChecker
{
    private readonly IDocumentRepository _documentRepository;
    private readonly IUserRepository _userRepository;

    public PermissionChecker(IDocumentRepository documentRepository, IUserRepository userRepository)
    {
        _documentRepository = documentRepository;
        _userRepository = userRepository;
    }

    public bool IsAdmin(IEnumerable<string> roles) =>
        roles.Any(r => r.Equals("Admin", StringComparison.OrdinalIgnoreCase));

    public async Task<bool> CanManageSharesAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(userId, ct);
        if (user is null) return false;
        if (IsAdmin(user.UserRoles.Select(ur => ur.Role.Name))) return true;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        return doc is not null && doc.OwnerId == userId;
    }

    public async Task<bool> CanReadAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var level = await GetEffectiveLevelAsync(documentId, userId, ct);
        return HasCapability(level, MinRead);
    }

    public async Task<bool> CanPreviewAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var level = await GetEffectiveLevelAsync(documentId, userId, ct);
        return HasCapability(level, MinPreview);
    }

    public async Task<bool> CanDownloadAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var level = await GetEffectiveLevelAsync(documentId, userId, ct);
        return HasCapability(level, MinDownload);
    }

    public async Task<bool> CanWriteAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var level = await GetEffectiveLevelAsync(documentId, userId, ct);
        if (!HasCapability(level, MinWrite)) return false;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null) return false;

        DocumentLockHelper.ClearIfExpired(doc);
        return !DocumentLockHelper.IsLockedByOther(doc, userId);
    }

    public async Task<bool> CanDeleteAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(userId, ct);
        if (user is null) return false;
        if (IsAdmin(user.UserRoles.Select(ur => ur.Role.Name))) return true;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null) return false;
        if (doc.OwnerId == userId) return true;

        return doc.Permissions.Any(p =>
            IsActive(p) &&
            p.UserId == userId &&
            (p.Permission == PermissionType.Delete || p.Permission == PermissionType.Admin));
    }

    public async Task<bool> CanRestoreFromTrashAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null || doc.Status != DocumentStatus.Deleted) return false;
        return await CanDeleteAsync(documentId, userId, ct);
    }

    private async Task<ShareAccessLevel?> GetEffectiveLevelAsync(Guid documentId, Guid userId, CancellationToken ct)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(userId, ct);
        if (user is null) return null;

        var isAdmin = IsAdmin(user.UserRoles.Select(ur => ur.Role.Name));
        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null || doc.Status == DocumentStatus.Deleted) return null;

        return GetEffectiveLevelOnDocument(doc, userId, isAdmin);
    }

    private const int MinRead = 1;
    private const int MinPreview = 2;
    private const int MinDownload = 3;
    private const int MinWrite = 4;

    internal static int Capability(ShareAccessLevel level) => level switch
    {
        ShareAccessLevel.Read => 2,
        ShareAccessLevel.Preview => 2,
        ShareAccessLevel.Download => 3,
        ShareAccessLevel.Write => 4,
        _ => 0
    };

    internal static bool HasCapability(ShareAccessLevel? level, int minimum) =>
        level.HasValue && Capability(level.Value) >= minimum;

    /// <summary>
    /// Niveau effectif sur un document déjà chargé (propriétaire, partage, public).
    /// </summary>
    public static ShareAccessLevel? GetEffectiveLevelOnDocument(Document doc, Guid userId, bool isAdmin)
    {
        if (doc.Status == DocumentStatus.Deleted) return null;
        if (isAdmin || doc.OwnerId == userId) return ShareAccessLevel.Write;

        var permission = doc.Permissions.FirstOrDefault(p => p.UserId == userId && IsActive(p));
        if (permission is not null)
            return ResolveAccessLevel(permission);

        if (doc.Visibility == DocumentVisibility.Public)
            return doc.PublicAccessLevel;

        return null;
    }

    /// <summary>
    /// Évalue les droits d'écriture sur un document déjà chargé (évite les requêtes DB en boucle).
    /// </summary>
    public static bool CanWriteLoadedDocument(Document doc, Guid userId, bool isAdmin)
    {
        var level = GetEffectiveLevelOnDocument(doc, userId, isAdmin);
        if (!HasCapability(level, MinWrite)) return false;

        DocumentLockHelper.ClearIfExpired(doc);
        return !DocumentLockHelper.IsLockedByOther(doc, userId);
    }

    internal static bool IsActive(DocumentPermission permission) =>
        permission.ExpiresAt is null || permission.ExpiresAt > DateTime.UtcNow;

    internal static ShareAccessLevel ResolveAccessLevel(DocumentPermission permission)
    {
        if (permission.Permission is PermissionType.Write or PermissionType.Admin or PermissionType.Delete)
            return ShareAccessLevel.Write;

        return permission.AccessLevel;
    }
}
