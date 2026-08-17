using Microsoft.EntityFrameworkCore;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Persistence;

namespace SecureFileStorage.Infrastructure.Services;

public class UserGroupService : IUserGroupService
{
    private readonly ApplicationDbContext _context;
    private readonly IUnitOfWork _unitOfWork;

    public UserGroupService(ApplicationDbContext context, IUnitOfWork unitOfWork)
    {
        _context = context;
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<UserGroupDto>> GetAllAsync(CancellationToken ct = default)
    {
        var groups = await _context.UserGroups
            .AsNoTracking()
            .Include(g => g.Members).ThenInclude(m => m.User)
            .OrderBy(g => g.Name)
            .ToListAsync(ct);
        return groups.Select(Map);
    }

    public async Task<UserGroupDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var group = await _context.UserGroups
            .AsNoTracking()
            .Include(g => g.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(g => g.Id == id, ct);
        return group is null ? null : Map(group);
    }

    public async Task<UserGroupDto> CreateAsync(CreateUserGroupRequest request, CancellationToken ct = default)
    {
        var name = NormalizeName(request.Name);
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("Le nom du groupe est obligatoire.");

        if (await _context.UserGroups.AnyAsync(g => g.Name == name, ct))
            throw new InvalidOperationException("Un groupe avec ce nom existe déjà.");

        var group = new UserGroup
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = (request.Description ?? string.Empty).Trim()
        };
        await _context.UserGroups.AddAsync(group, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return (await GetByIdAsync(group.Id, ct))!;
    }

    public async Task<UserGroupDto?> UpdateAsync(Guid id, UpdateUserGroupRequest request, CancellationToken ct = default)
    {
        var group = await _context.UserGroups.FirstOrDefaultAsync(g => g.Id == id, ct);
        if (group is null) return null;

        if (request.Name is not null)
        {
            var name = NormalizeName(request.Name);
            if (string.IsNullOrWhiteSpace(name))
                throw new InvalidOperationException("Le nom du groupe est obligatoire.");
            if (await _context.UserGroups.AnyAsync(g => g.Name == name && g.Id != id, ct))
                throw new InvalidOperationException("Un groupe avec ce nom existe déjà.");
            group.Name = name;
        }

        if (request.Description is not null)
            group.Description = request.Description.Trim();

        group.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var group = await _context.UserGroups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == id, ct);
        if (group is null) return false;

        if (group.Members.Count > 0)
            throw new InvalidOperationException("Impossible de supprimer un groupe qui contient encore des membres.");

        _context.UserGroups.Remove(group);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<UserGroupDto?> AddMemberAsync(Guid groupId, Guid userId, CancellationToken ct = default)
    {
        var group = await _context.UserGroups.FirstOrDefaultAsync(g => g.Id == groupId, ct);
        if (group is null) return null;

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct)
            ?? throw new InvalidOperationException("Utilisateur introuvable ou inactif.");

        var exists = await _context.UserGroupMembers
            .AnyAsync(m => m.UserGroupId == groupId && m.UserId == userId, ct);
        if (!exists)
        {
            await _context.UserGroupMembers.AddAsync(new UserGroupMember
            {
                UserGroupId = groupId,
                UserId = user.Id,
                JoinedAt = DateTime.UtcNow
            }, ct);
            group.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync(ct);
        }

        return await GetByIdAsync(groupId, ct);
    }

    public async Task<bool> RemoveMemberAsync(Guid groupId, Guid userId, CancellationToken ct = default)
    {
        var member = await _context.UserGroupMembers
            .FirstOrDefaultAsync(m => m.UserGroupId == groupId && m.UserId == userId, ct);
        if (member is null) return false;

        _context.UserGroupMembers.Remove(member);
        var group = await _context.UserGroups.FirstOrDefaultAsync(g => g.Id == groupId, ct);
        if (group is not null) group.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    private static string NormalizeName(string name) => name.Trim();

    private static UserGroupDto Map(UserGroup group) => new(
        group.Id,
        group.Name,
        group.Description,
        group.Members.Count,
        group.CreatedAt,
        group.UpdatedAt,
        group.Members
            .OrderBy(m => m.User.LastName)
            .ThenBy(m => m.User.FirstName)
            .Select(m => new UserGroupMemberDto(
                m.UserId,
                m.User.Email,
                $"{m.User.FirstName} {m.User.LastName}".Trim(),
                m.JoinedAt)));
}

public class CategoryAccessService : ICategoryAccessService
{
    private readonly ApplicationDbContext _context;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CategoryAccessService(
        ApplicationDbContext context,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _context = context;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<IEnumerable<CategoryAccessRuleDto>> GetAllAsync(CancellationToken ct = default)
    {
        var rules = await _context.CategoryAccessRules
            .AsNoTracking()
            .Include(r => r.UserGroup)
            .OrderBy(r => r.Category)
            .ThenBy(r => r.UserGroup.Name)
            .ToListAsync(ct);
        return rules.Select(Map);
    }

    public async Task<IEnumerable<CategoryAccessRuleDto>> GetByCategoryAsync(string category, CancellationToken ct = default)
    {
        var key = NormalizeCategory(category);
        var rules = await _context.CategoryAccessRules
            .AsNoTracking()
            .Include(r => r.UserGroup)
            .Where(r => r.Category == key)
            .OrderBy(r => r.UserGroup.Name)
            .ToListAsync(ct);
        return rules.Select(Map);
    }

    public async Task<CategoryAccessRuleDto> UpsertAsync(
        UpsertCategoryAccessRuleRequest request, Guid actorId, CancellationToken ct = default)
    {
        var category = NormalizeCategory(request.Category);
        if (string.IsNullOrWhiteSpace(category))
            throw new InvalidOperationException("La catégorie est obligatoire.");

        if (!Enum.TryParse(request.AccessLevel, true, out ShareAccessLevel accessLevel))
            throw new InvalidOperationException("Niveau d'accès invalide (Read, Preview, Download, Write).");

        var group = await _context.UserGroups.FirstOrDefaultAsync(g => g.Id == request.UserGroupId, ct)
            ?? throw new InvalidOperationException("Groupe introuvable.");

        var rule = await _context.CategoryAccessRules
            .Include(r => r.UserGroup)
            .FirstOrDefaultAsync(r => r.Category == category && r.UserGroupId == request.UserGroupId, ct);

        if (rule is null)
        {
            rule = new CategoryAccessRule
            {
                Id = Guid.NewGuid(),
                Category = category,
                UserGroupId = group.Id,
                UserGroup = group,
                AccessLevel = accessLevel,
                CreatedById = actorId,
                CreatedAt = DateTime.UtcNow
            };
            await _context.CategoryAccessRules.AddAsync(rule, ct);
        }
        else
        {
            rule.AccessLevel = accessLevel;
        }

        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(
            actorId,
            AuditAction.PermissionChange,
            "Document",
            null,
            $"Règle catégorie « {category} » → groupe « {group.Name} » : {accessLevel}",
            "",
            ct: ct);

        return Map(rule);
    }

    public async Task<bool> DeleteAsync(Guid ruleId, CancellationToken ct = default)
    {
        var rule = await _context.CategoryAccessRules
            .Include(r => r.UserGroup)
            .FirstOrDefaultAsync(r => r.Id == ruleId, ct);
        if (rule is null) return false;

        var details = $"Suppression règle catégorie « {rule.Category} » / groupe « {rule.UserGroup.Name} »";
        _context.CategoryAccessRules.Remove(rule);
        await _unitOfWork.SaveChangesAsync(ct);
        await _auditService.LogAsync(
            null,
            AuditAction.PermissionChange,
            "Document",
            null,
            details,
            "",
            ct: ct);
        return true;
    }

    public static string NormalizeCategory(string category) =>
        (category ?? string.Empty).Trim();

    private static CategoryAccessRuleDto Map(CategoryAccessRule rule) => new(
        rule.Id,
        rule.Category,
        rule.UserGroupId,
        rule.UserGroup.Name,
        rule.AccessLevel.ToString(),
        rule.CreatedAt);
}
