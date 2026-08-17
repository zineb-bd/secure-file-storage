using SecureFileStorage.Domain.Enums;

namespace SecureFileStorage.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public User? User { get; set; }
    public AuditAction Action { get; set; }
    public string ResourceType { get; set; } = string.Empty;
    public Guid? ResourceId { get; set; }
    public string Details { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public bool Success { get; set; } = true;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class StorageConfiguration
{
    public Guid Id { get; set; }
    public StorageProviderType ProviderType { get; set; }
    public DatabaseProviderType DatabaseProvider { get; set; }
    public string BasePath { get; set; } = string.Empty;
    /// <summary>Chaîne de connexion cible pour le fournisseur de base choisi.</summary>
    public string? ConnectionString { get; set; }
    public string? S3Endpoint { get; set; }
    public string? S3Bucket { get; set; }
    public string? S3AccessKey { get; set; }
    public string? S3SecretKey { get; set; }
    /// <summary>Active la compression GZip avant chiffrement (nouveaux fichiers).</summary>
    public bool CompressionEnabled { get; set; } = true;
    /// <summary>Algorithme utilisé pour les nouveaux fichiers.</summary>
    public EncryptionAlgorithm EncryptionAlgorithm { get; set; } = EncryptionAlgorithm.AesGcm;
    /// <summary>Clé maître active, propre à cette configuration de stockage.</summary>
    public Guid? ActiveEncryptionKeyId { get; set; }
    public EncryptionKeyRecord? ActiveEncryptionKey { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class EncryptionKeyRecord
{
    public Guid Id { get; set; }
    public Guid StorageConfigurationId { get; set; }
    public StorageConfiguration StorageConfiguration { get; set; } = null!;
    public string KeyIdentifier { get; set; } = string.Empty;
    public string EncryptedMasterKey { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RotatedAt { get; set; }
}

public class AntivirusAlert
{
    public Guid Id { get; set; }
    public Guid? DocumentId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ThreatName { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public DateTime DetectedAt { get; set; } = DateTime.UtcNow;
    public bool IsResolved { get; set; }
}

/// <summary>
/// Compteur quotidien anonyme du chatbot. Ne contient ni message, ni réponse,
/// ni utilisateur, ni document ou métadonnée de document.
/// </summary>
public class ChatbotUsageMetric
{
    public Guid Id { get; set; }
    public DateOnly Day { get; set; }
    public string Topic { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public int RequestCount { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
