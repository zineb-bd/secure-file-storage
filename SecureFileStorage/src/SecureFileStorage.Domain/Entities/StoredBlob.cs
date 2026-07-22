namespace SecureFileStorage.Domain.Entities;

/// <summary>
/// Contenu chiffré partagé, identifié par le hash SHA-256 du fichier en clair.
/// </summary>
public class StoredBlob
{
    public Guid Id { get; set; }
    public string Sha256Hash { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public string EncryptedKey { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public int ReferenceCount { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<DocumentVersion> Versions { get; set; } = [];
}
