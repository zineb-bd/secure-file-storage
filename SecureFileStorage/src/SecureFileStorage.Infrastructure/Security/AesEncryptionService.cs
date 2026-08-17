using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Application.Options;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Persistence;

namespace SecureFileStorage.Infrastructure.Security;

public class AesEncryptionService : IEncryptionService
{
    private readonly EncryptionSettings _settings;
    private readonly ApplicationDbContext _context;

    public AesEncryptionService(IOptions<EncryptionSettings> settings, ApplicationDbContext context)
    {
        _settings = settings.Value;
        _context = context;
    }

    public Task<(byte[] EncryptedData, string EncryptedKey)> EncryptAsync(
        byte[] plainData, EncryptionAlgorithm algorithm, CancellationToken ct = default)
    {
        var dataKey = RandomNumberGenerator.GetBytes(32);
        var payload = algorithm switch
        {
            EncryptionAlgorithm.AesGcm => EncryptAesGcm(plainData, dataKey),
            EncryptionAlgorithm.ChaCha20Poly1305 => EncryptChaCha20Poly1305(plainData, dataKey),
            EncryptionAlgorithm.AesCbcLegacy => EncryptAesCbc(plainData, dataKey),
            _ => throw new NotSupportedException($"Algorithme non pris en charge : {algorithm}.")
        };

        var masterKey = GetMasterKeyBytes();
        var encryptedKey = EncryptKeyWithMaster(dataKey, masterKey);

        return Task.FromResult((payload, Convert.ToBase64String(encryptedKey)));
    }

    public Task<byte[]> DecryptAsync(
        byte[] encryptedData, string encryptedKey, EncryptionAlgorithm algorithm, CancellationToken ct = default)
    {
        var masterKey = GetMasterKeyBytes();
        var dataKey = DecryptKeyWithMaster(Convert.FromBase64String(encryptedKey), masterKey);

        var plain = algorithm switch
        {
            EncryptionAlgorithm.AesGcm => DecryptAesGcm(encryptedData, dataKey),
            EncryptionAlgorithm.ChaCha20Poly1305 => DecryptChaCha20Poly1305(encryptedData, dataKey),
            EncryptionAlgorithm.AesCbcLegacy => DecryptAesCbc(encryptedData, dataKey),
            _ => throw new NotSupportedException($"Algorithme non pris en charge : {algorithm}.")
        };

        return Task.FromResult(plain);
    }

    private static byte[] EncryptAesCbc(byte[] plainData, byte[] dataKey)
    {
        var iv = RandomNumberGenerator.GetBytes(16);
        using var aes = Aes.Create();
        aes.Key = dataKey;
        aes.IV = iv;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;
        using var encryptor = aes.CreateEncryptor();
        var encrypted = encryptor.TransformFinalBlock(plainData, 0, plainData.Length);
        return [.. iv, .. encrypted];
    }

    private static byte[] DecryptAesCbc(byte[] encryptedData, byte[] dataKey)
    {
        var iv = new byte[16];
        var cipher = new byte[encryptedData.Length - 16];
        Buffer.BlockCopy(encryptedData, 0, iv, 0, 16);
        Buffer.BlockCopy(encryptedData, 16, cipher, 0, cipher.Length);

        using var aes = Aes.Create();
        aes.Key = dataKey;
        aes.IV = iv;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;

        using var decryptor = aes.CreateDecryptor();
        return decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
    }

    private static byte[] EncryptAesGcm(byte[] plainData, byte[] dataKey)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var cipher = new byte[plainData.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(dataKey, tag.Length);
        aes.Encrypt(nonce, plainData, cipher, tag);
        return [.. nonce, .. tag, .. cipher];
    }

    private static byte[] DecryptAesGcm(byte[] encryptedData, byte[] dataKey)
    {
        const int nonceLength = 12, tagLength = 16;
        if (encryptedData.Length < nonceLength + tagLength)
            throw new CryptographicException("Payload AES-GCM invalide.");
        var plain = new byte[encryptedData.Length - nonceLength - tagLength];
        using var aes = new AesGcm(dataKey, tagLength);
        aes.Decrypt(encryptedData[..nonceLength], encryptedData[nonceLength..(nonceLength + tagLength)],
            encryptedData[(nonceLength + tagLength)..], plain);
        return plain;
    }

    private static byte[] EncryptChaCha20Poly1305(byte[] plainData, byte[] dataKey)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var cipher = new byte[plainData.Length];
        var tag = new byte[16];
        using var chacha = new ChaCha20Poly1305(dataKey);
        chacha.Encrypt(nonce, plainData, cipher, tag);
        return [.. nonce, .. tag, .. cipher];
    }

    private static byte[] DecryptChaCha20Poly1305(byte[] encryptedData, byte[] dataKey)
    {
        const int nonceLength = 12, tagLength = 16;
        if (encryptedData.Length < nonceLength + tagLength)
            throw new CryptographicException("Payload ChaCha20-Poly1305 invalide.");
        var plain = new byte[encryptedData.Length - nonceLength - tagLength];
        using var chacha = new ChaCha20Poly1305(dataKey);
        chacha.Decrypt(encryptedData[..nonceLength], encryptedData[nonceLength..(nonceLength + tagLength)],
            encryptedData[(nonceLength + tagLength)..], plain);
        return plain;
    }

    public string ComputeSha256Hash(byte[] data)
    {
        var hash = SHA256.HashData(data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public async Task<string> RotateMasterKeyAsync(CancellationToken ct = default)
    {
        var storageConfiguration = await _context.StorageConfigurations
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync(c => c.IsActive, ct)
            ?? throw new InvalidOperationException("Aucune configuration de stockage active.");

        var keyId = Guid.NewGuid().ToString("N")[..16];
        var record = new EncryptionKeyRecord
        {
            Id = Guid.NewGuid(),
            StorageConfigurationId = storageConfiguration.Id,
            KeyIdentifier = keyId,
            EncryptedMasterKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var existing = await _context.EncryptionKeys
            .Where(k => k.StorageConfigurationId == storageConfiguration.Id && k.IsActive)
            .ToListAsync(ct);
        foreach (var key in existing)
        {
            key.IsActive = false;
            key.RotatedAt = DateTime.UtcNow;
        }

        await _context.EncryptionKeys.AddAsync(record, ct);
        storageConfiguration.ActiveEncryptionKeyId = record.Id;
        storageConfiguration.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return keyId;
    }

    private byte[] GetMasterKeyBytes()
    {
        if (string.IsNullOrWhiteSpace(_settings.MasterKey))
            throw new InvalidOperationException("La clé maître de chiffrement n'est pas configurée.");

        return SHA256.HashData(Encoding.UTF8.GetBytes(_settings.MasterKey));
    }

    private static byte[] EncryptKeyWithMaster(byte[] dataKey, byte[] masterKey)
    {
        using var aes = Aes.Create();
        aes.Key = masterKey;
        aes.GenerateIV();
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;

        using var encryptor = aes.CreateEncryptor();
        var encrypted = encryptor.TransformFinalBlock(dataKey, 0, dataKey.Length);

        var result = new byte[aes.IV.Length + encrypted.Length];
        Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
        Buffer.BlockCopy(encrypted, 0, result, aes.IV.Length, encrypted.Length);
        return result;
    }

    private static byte[] DecryptKeyWithMaster(byte[] encryptedKey, byte[] masterKey)
    {
        var iv = new byte[16];
        var cipher = new byte[encryptedKey.Length - 16];
        Buffer.BlockCopy(encryptedKey, 0, iv, 0, 16);
        Buffer.BlockCopy(encryptedKey, 16, cipher, 0, cipher.Length);

        using var aes = Aes.Create();
        aes.Key = masterKey;
        aes.IV = iv;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;

        using var decryptor = aes.CreateDecryptor();
        return decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
    }
}
