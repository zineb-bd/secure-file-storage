using SecureFileStorage.Domain.Enums;

namespace SecureFileStorage.Domain.Entities;

/// <summary>
/// Référence à un fichier physique chiffré (stockage disque, pas un BLOB SQL).
/// Identifié par le hash SHA-256 du contenu en clair ; plusieurs versions peuvent le partager.
/// </summary>
public class StoredBlob
{
    public Guid Id { get; set; }
    public string Sha256Hash { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public string EncryptedKey { get; set; } = string.Empty;
    public Guid? StorageConfigurationId { get; set; }
    public Guid? EncryptionKeyId { get; set; }
    public long SizeBytes { get; set; }
    public bool IsCompressed { get; set; }
    public EncryptionAlgorithm EncryptionAlgorithm { get; set; } = EncryptionAlgorithm.AesCbcLegacy;
    public int ReferenceCount { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<DocumentVersion> Versions { get; set; } = [];
}
