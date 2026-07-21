namespace SecureFileStorage.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = [];
    public ICollection<Document> OwnedDocuments { get; set; } = [];
    public ICollection<DocumentPermission> DocumentPermissions { get; set; } = [];
    public ICollection<AuditLog> AuditLogs { get; set; } = [];
}
