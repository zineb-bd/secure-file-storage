using SecureFileStorage.Domain.Enums;

namespace SecureFileStorage.Domain.Entities;

public class Document
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Sha256Hash { get; set; } = string.Empty;
    public int CurrentVersion { get; set; } = 1;
    public DocumentStatus Status { get; set; } = DocumentStatus.Active;
    public Guid OwnerId { get; set; }
    public User Owner { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime? ArchivedAt { get; set; }
    public AntivirusScanResult LastScanResult { get; set; } = AntivirusScanResult.Skipped;
    public DateTime? LastScanAt { get; set; }

    public ICollection<DocumentVersion> Versions { get; set; } = [];
    public ICollection<DocumentPermission> Permissions { get; set; } = [];
}

public class DocumentVersion
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }
    public Document Document { get; set; } = null!;
    public int VersionNumber { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public string EncryptedKey { get; set; } = string.Empty;
    public string Sha256Hash { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public Guid UploadedById { get; set; }
    public User UploadedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? ChangeComment { get; set; }
}

public class DocumentPermission
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }
    public Document Document { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public PermissionType Permission { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public Guid GrantedById { get; set; }
}
