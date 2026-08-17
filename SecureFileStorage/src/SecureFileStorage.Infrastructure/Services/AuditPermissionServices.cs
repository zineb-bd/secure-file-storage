using System.Text;
using Microsoft.EntityFrameworkCore;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Persistence;

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
    private readonly ApplicationDbContext _context;

    public PermissionChecker(
        IDocumentRepository documentRepository,
        IUserRepository userRepository,
        ApplicationDbContext context)
    {
        _documentRepository = documentRepository;
        _userRepository = userRepository;
        _context = context;
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

        // Suppression : droit document explicite Delete/Admin, sous réserve de la politique catégorie
        var level = await ResolveCategoryAwareLevelAsync(doc, userId, isAdmin: false, ct);
        if (level is null) return false;

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

        return await ResolveCategoryAwareLevelAsync(doc, userId, isAdmin, ct);
    }

    private async Task<ShareAccessLevel?> ResolveCategoryAwareLevelAsync(
        Document doc, Guid userId, bool isAdmin, CancellationToken ct)
    {
        var groupIds = await _context.UserGroupMembers
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => m.UserGroupId)
            .ToListAsync(ct);

        var category = CategoryAccessService.NormalizeCategory(doc.Category);
        var categoryRules = await _context.CategoryAccessRules
            .AsNoTracking()
            .Where(r => r.Category.ToLower() == category.ToLower())
            .Select(r => new { r.UserGroupId, r.AccessLevel })
            .ToListAsync(ct);

        var categoryHasRules = categoryRules.Count > 0;
        ShareAccessLevel? categoryLevel = null;
        if (categoryHasRules)
        {
            var matching = categoryRules
                .Where(r => groupIds.Contains(r.UserGroupId))
                .Select(r => r.AccessLevel)
                .ToList();
            if (matching.Count > 0)
                categoryLevel = matching.MaxBy(Capability);
        }

        return GetEffectiveLevelOnDocument(doc, userId, isAdmin, categoryLevel, categoryHasRules);
    }

    /// <summary>
    /// Charge le contexte catégorie/groupes pour un utilisateur (listes de documents).
    /// </summary>
    public async Task<AccessEvaluationContext> BuildAccessContextAsync(Guid userId, CancellationToken ct = default)
    {
        var groupIds = await _context.UserGroupMembers
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => m.UserGroupId)
            .ToListAsync(ct);

        var rules = await _context.CategoryAccessRules
            .AsNoTracking()
            .Select(r => new { r.Category, r.UserGroupId, r.AccessLevel })
            .ToListAsync(ct);

        var byCategory = rules
            .GroupBy(r => r.Category, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<(Guid GroupId, ShareAccessLevel Level)>)g
                    .Select(x => (x.UserGroupId, x.AccessLevel))
                    .ToList(),
                StringComparer.OrdinalIgnoreCase);

        return new AccessEvaluationContext(groupIds, byCategory);
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

    internal static ShareAccessLevel MinLevel(ShareAccessLevel a, ShareAccessLevel b) =>
        Capability(a) <= Capability(b) ? a : b;

    /// <summary>
    /// Niveau effectif : Admin/propriétaire inchangés ; sinon combinaison restrictive
    /// (min) entre droit document/public et droit catégorie/groupe.
    /// Si la catégorie a des règles et l'utilisateur n'en matche aucune → refus.
    /// </summary>
    public static ShareAccessLevel? GetEffectiveLevelOnDocument(
        Document doc,
        Guid userId,
        bool isAdmin,
        ShareAccessLevel? categoryGrantedLevel = null,
        bool categoryHasRules = false)
    {
        if (doc.Status == DocumentStatus.Deleted) return null;
        if (isAdmin || doc.OwnerId == userId) return ShareAccessLevel.Write;

        ShareAccessLevel? documentLevel = null;
        var permission = doc.Permissions.FirstOrDefault(p => p.UserId == userId && IsActive(p));
        if (permission is not null)
            documentLevel = ResolveAccessLevel(permission);
        else if (doc.Visibility == DocumentVisibility.Public)
            documentLevel = doc.PublicAccessLevel;

        if (categoryHasRules)
        {
            if (categoryGrantedLevel is null)
                return null;

            if (documentLevel is null)
                return categoryGrantedLevel;

            return MinLevel(documentLevel.Value, categoryGrantedLevel.Value);
        }

        return documentLevel;
    }

    public static ShareAccessLevel? GetEffectiveLevelOnDocument(
        Document doc, Guid userId, bool isAdmin, AccessEvaluationContext context)
    {
        var category = CategoryAccessService.NormalizeCategory(doc.Category);
        var categoryHasRules = context.RulesByCategory.TryGetValue(category, out var rules) && rules.Count > 0;
        ShareAccessLevel? categoryLevel = null;
        if (categoryHasRules)
        {
            var matching = rules!
                .Where(r => context.UserGroupIds.Contains(r.GroupId))
                .Select(r => r.Level)
                .ToList();
            if (matching.Count > 0)
                categoryLevel = matching.MaxBy(Capability);
        }

        return GetEffectiveLevelOnDocument(doc, userId, isAdmin, categoryLevel, categoryHasRules);
    }

    public static bool CanWriteLoadedDocument(Document doc, Guid userId, bool isAdmin)
        => CanWriteLoadedDocument(doc, userId, isAdmin, categoryGrantedLevel: null, categoryHasRules: false);

    public static bool CanWriteLoadedDocument(
        Document doc, Guid userId, bool isAdmin, AccessEvaluationContext context)
    {
        var level = GetEffectiveLevelOnDocument(doc, userId, isAdmin, context);
        if (!HasCapability(level, MinWrite)) return false;
        DocumentLockHelper.ClearIfExpired(doc);
        return !DocumentLockHelper.IsLockedByOther(doc, userId);
    }

    public static bool CanWriteLoadedDocument(
        Document doc,
        Guid userId,
        bool isAdmin,
        ShareAccessLevel? categoryGrantedLevel,
        bool categoryHasRules)
    {
        var level = GetEffectiveLevelOnDocument(doc, userId, isAdmin, categoryGrantedLevel, categoryHasRules);
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

public sealed class AccessEvaluationContext
{
    public AccessEvaluationContext(
        IReadOnlyCollection<Guid> userGroupIds,
        IReadOnlyDictionary<string, IReadOnlyList<(Guid GroupId, ShareAccessLevel Level)>> rulesByCategory)
    {
        UserGroupIds = userGroupIds;
        RulesByCategory = rulesByCategory;
    }

    public IReadOnlyCollection<Guid> UserGroupIds { get; }
    public IReadOnlyDictionary<string, IReadOnlyList<(Guid GroupId, ShareAccessLevel Level)>> RulesByCategory { get; }
}
