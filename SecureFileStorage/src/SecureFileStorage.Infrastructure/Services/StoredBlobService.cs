using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Persistence;
using SecureFileStorage.Infrastructure.Storage;

namespace SecureFileStorage.Infrastructure.Services;

public class StoredBlobService
{
    private readonly ApplicationDbContext _context;
    private readonly IStorageService _storageService;
    private readonly IEncryptionService _encryptionService;

    public StoredBlobService(
        ApplicationDbContext context,
        IStorageService storageService,
        IEncryptionService encryptionService)
    {
        _context = context;
        _storageService = storageService;
        _encryptionService = encryptionService;
    }

    /// <summary>
    /// Prépare un blob pour le contenu donné. Incrémente la ref si le hash existe déjà.
    /// La persistance est laissée à l'appelant (SaveChangesAsync).
    /// </summary>
    public async Task<(StoredBlob Blob, bool Deduplicated)> AcquireAsync(byte[] plainData, CancellationToken ct = default)
    {
        var hash = _encryptionService.ComputeSha256Hash(plainData);

        var existing = await _context.StoredBlobs
            .FirstOrDefaultAsync(b => b.Sha256Hash == hash, ct);

        if (existing is not null)
        {
            existing.ReferenceCount++;
            return (existing, true);
        }

        var storageSettings = await _context.StorageConfigurations
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new { c.Id, c.CompressionEnabled, c.EncryptionAlgorithm, c.ActiveEncryptionKeyId })
            .FirstOrDefaultAsync(ct);
        var compressionEnabled = storageSettings?.CompressionEnabled ?? true;
        var algorithm = storageSettings?.EncryptionAlgorithm ?? EncryptionAlgorithm.AesGcm;
        var activeKeyId = storageSettings?.ActiveEncryptionKeyId;

        if (storageSettings is not null && activeKeyId is null)
        {
            var key = new EncryptionKeyRecord
            {
                Id = Guid.NewGuid(),
                StorageConfigurationId = storageSettings.Id,
                KeyIdentifier = Guid.NewGuid().ToString("N")[..16],
                EncryptedMasterKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            var trackedConfiguration = await _context.StorageConfigurations
                .FirstAsync(c => c.Id == storageSettings.Id, ct);
            trackedConfiguration.ActiveEncryptionKeyId = key.Id;
            await _context.EncryptionKeys.AddAsync(key, ct);
            await _context.SaveChangesAsync(ct);
            activeKeyId = key.Id;
        }

        var (payload, compressed) = FileCompression.WrapForStorage(plainData, compressionEnabled);
        var (encryptedData, encryptedKey) = await _encryptionService.EncryptAsync(payload, algorithm, ct);
        var storagePath = $"blobs/{hash}.enc";

        await using var encryptedStream = new MemoryStream(encryptedData);
        await _storageService.SaveAsync(encryptedStream, storagePath, ct);

        var blob = new StoredBlob
        {
            Id = Guid.NewGuid(),
            Sha256Hash = hash,
            StoragePath = storagePath,
            EncryptedKey = encryptedKey,
            StorageConfigurationId = storageSettings?.Id,
            EncryptionKeyId = activeKeyId,
            SizeBytes = plainData.Length,
            IsCompressed = compressed,
            EncryptionAlgorithm = algorithm,
            ReferenceCount = 1
        };

        await _context.StoredBlobs.AddAsync(blob, ct);
        return (blob, false);
    }

    /// <summary>
    /// Réutilise le blob d'une version source (restauration) sans rechiffrer.
    /// </summary>
    public async Task<(StoredBlob Blob, bool Deduplicated)> AcquireFromVersionAsync(
        DocumentVersion source, CancellationToken ct = default)
    {
        if (source.StoredBlobId is not null)
        {
            var blob = await _context.StoredBlobs
                .FirstOrDefaultAsync(b => b.Id == source.StoredBlobId, ct)
                ?? throw new InvalidOperationException("Blob source introuvable.");

            blob.ReferenceCount++;
            return (blob, blob.ReferenceCount > 1);
        }

        var plain = await ReadPlainAsync(source, ct);
        return await AcquireAsync(plain, ct);
    }

    /// <summary>
    /// Lit le fichier physique, déchiffre AES-256, puis décompresse si le payload est marqué SFSZ.
    /// Compatible avec les fichiers stockés avant l’ajout de la compression.
    /// </summary>
    public async Task<byte[]> ReadPlainAsync(DocumentVersion version, CancellationToken ct = default)
    {
        var (storagePath, encryptedKey) = ResolveStorage(version);
        await using var encryptedStream = await _storageService.ReadAsync(storagePath, ct);
        using var ms = new MemoryStream();
        await encryptedStream.CopyToAsync(ms, ct);
        var algorithm = version.StoredBlob?.EncryptionAlgorithm ?? EncryptionAlgorithm.AesCbcLegacy;
        var decrypted = await _encryptionService.DecryptAsync(ms.ToArray(), encryptedKey, algorithm, ct);
        return FileCompression.UnwrapAfterDecrypt(decrypted);
    }

    public async Task ReleaseVersionAsync(DocumentVersion version, CancellationToken ct = default)
    {
        if (version.StoredBlobId is null)
        {
            if (!string.IsNullOrEmpty(version.StoragePath))
                await _storageService.DeleteAsync(version.StoragePath, ct);
            return;
        }

        var blob = await _context.StoredBlobs
            .FirstOrDefaultAsync(b => b.Id == version.StoredBlobId, ct);

        if (blob is null) return;

        blob.ReferenceCount--;

        if (blob.ReferenceCount <= 0)
        {
            await _storageService.DeleteAsync(blob.StoragePath, ct);
            _context.StoredBlobs.Remove(blob);
        }
    }

    public async Task RollbackNewBlobAsync(StoredBlob blob, CancellationToken ct = default)
    {
        _context.StoredBlobs.Remove(blob);
        if (!string.IsNullOrEmpty(blob.StoragePath))
            await _storageService.DeleteAsync(blob.StoragePath, ct);
    }

    public static (string StoragePath, string EncryptedKey) ResolveStorage(DocumentVersion version)
    {
        if (version.StoredBlob is not null)
            return (version.StoredBlob.StoragePath, version.StoredBlob.EncryptedKey);

        return (version.StoragePath, version.EncryptedKey);
    }

    public static void LinkVersion(DocumentVersion version, StoredBlob blob)
    {
        version.StoredBlobId = blob.Id;
        version.StoredBlob = blob;
        version.StoragePath = blob.StoragePath;
        version.EncryptedKey = blob.EncryptedKey;
        version.Sha256Hash = blob.Sha256Hash;
        version.SizeBytes = blob.SizeBytes;
    }
}
