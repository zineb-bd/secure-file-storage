using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Application.Options;
using SecureFileStorage.Domain.Entities;
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

    public async Task<(byte[] EncryptedData, string EncryptedKey)> EncryptAsync(byte[] plainData, CancellationToken ct = default)
    {
        var dataKey = RandomNumberGenerator.GetBytes(32);
        var iv = RandomNumberGenerator.GetBytes(16);

        byte[] encryptedData;
        using (var aes = Aes.Create())
        {
            aes.Key = dataKey;
            aes.IV = iv;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            using var encryptor = aes.CreateEncryptor();
            encryptedData = encryptor.TransformFinalBlock(plainData, 0, plainData.Length);
        }

        var payload = new byte[iv.Length + encryptedData.Length];
        Buffer.BlockCopy(iv, 0, payload, 0, iv.Length);
        Buffer.BlockCopy(encryptedData, 0, payload, iv.Length, encryptedData.Length);

        var masterKey = GetMasterKeyBytes();
        var encryptedKey = EncryptKeyWithMaster(dataKey, masterKey);

        return (payload, Convert.ToBase64String(encryptedKey));
    }

    public Task<byte[]> DecryptAsync(byte[] encryptedData, string encryptedKey, CancellationToken ct = default)
    {
        var masterKey = GetMasterKeyBytes();
        var dataKey = DecryptKeyWithMaster(Convert.FromBase64String(encryptedKey), masterKey);

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
        var plain = decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
        return Task.FromResult(plain);
    }

    public string ComputeSha256Hash(byte[] data)
    {
        var hash = SHA256.HashData(data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public async Task<string> RotateMasterKeyAsync(CancellationToken ct = default)
    {
        var keyId = Guid.NewGuid().ToString("N")[..16];
        var record = new EncryptionKeyRecord
        {
            Id = Guid.NewGuid(),
            KeyIdentifier = keyId,
            EncryptedMasterKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var existing = await _context.EncryptionKeys.Where(k => k.IsActive).ToListAsync(ct);
        foreach (var key in existing)
        {
            key.IsActive = false;
            key.RotatedAt = DateTime.UtcNow;
        }

        await _context.EncryptionKeys.AddAsync(record, ct);
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
