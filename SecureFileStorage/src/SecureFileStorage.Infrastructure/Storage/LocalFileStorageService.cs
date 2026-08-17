using Microsoft.Extensions.Options;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Application.Options;

namespace SecureFileStorage.Infrastructure.Storage;

public class LocalFileStorageService : IStorageService
{
    private readonly StorageSettings _settings;

    public LocalFileStorageService(IOptions<StorageSettings> settings)
    {
        _settings = settings.Value;
        Directory.CreateDirectory(_settings.BasePath);
    }

    public async Task<string> SaveAsync(Stream content, string relativePath, CancellationToken ct = default)
    {
        var fullPath = GetFullPath(relativePath);
        var directory = Path.GetDirectoryName(fullPath)!;
        Directory.CreateDirectory(directory);

        await using var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(fileStream, ct);
        return relativePath;
    }

    public Task<Stream> ReadAsync(string relativePath, CancellationToken ct = default)
    {
        var fullPath = GetFullPath(relativePath);
        if (!File.Exists(fullPath))
            throw new FileNotFoundException("Fichier introuvable.", relativePath);

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string relativePath, CancellationToken ct = default)
    {
        var fullPath = GetFullPath(relativePath);
        if (File.Exists(fullPath))
            File.Delete(fullPath);
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(string relativePath, CancellationToken ct = default) =>
        Task.FromResult(File.Exists(GetFullPath(relativePath)));

    private string GetFullPath(string relativePath)
    {
        var normalized = relativePath.Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_settings.BasePath, normalized));
        var baseFull = Path.GetFullPath(_settings.BasePath);

        if (!fullPath.StartsWith(baseFull, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Chemin de stockage non autorisé.");

        return fullPath;
    }
}
