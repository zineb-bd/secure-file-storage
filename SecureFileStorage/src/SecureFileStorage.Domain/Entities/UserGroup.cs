using SecureFileStorage.Domain.Enums;

namespace SecureFileStorage.Domain.Entities;

/// <summary>Groupe métier indépendant des rôles Admin/User.</summary>
public class UserGroup
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<UserGroupMember> Members { get; set; } = [];
    public ICollection<CategoryAccessRule> CategoryAccessRules { get; set; } = [];
}

public class UserGroupMember
{
    public Guid UserGroupId { get; set; }
    public UserGroup UserGroup { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Droit d'accès accordé à un groupe pour une catégorie de documents.</summary>
public class CategoryAccessRule
{
    public Guid Id { get; set; }
    /// <summary>Nom de catégorie normalisé (ex. RH, Factures).</summary>
    public string Category { get; set; } = string.Empty;
    public Guid UserGroupId { get; set; }
    public UserGroup UserGroup { get; set; } = null!;
    public ShareAccessLevel AccessLevel { get; set; } = ShareAccessLevel.Read;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid CreatedById { get; set; }
    public User CreatedBy { get; set; } = null!;
}
