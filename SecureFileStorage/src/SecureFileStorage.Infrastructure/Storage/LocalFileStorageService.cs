using Microsoft.Extensions.Options;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Application.Options;

namespace SecureFileStorage.Infrastructure.Storage;

public class LocalFileStorageService : IStorageService
{
    private readonly string _basePath;

    public LocalFileStorageService(IOptions<StorageSettings> options)
    {
        _basePath = string.IsNullOrWhiteSpace(options.Value.BasePath)
            ? Path.Combine(Directory.GetCurrentDirectory(), "storage")
            : options.Value.BasePath;
        Directory.CreateDirectory(_basePath);
    }

    public async Task<string> SaveAsync(Stream content, string relativePath, CancellationToken ct = default)
    {
        var fullPath = ResolvePath(relativePath);
        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(directory))
            Directory.CreateDirectory(directory);

        await using var file = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(file, ct);
        return relativePath.Replace('\\', '/');
    }

    public Task<Stream> ReadAsync(string relativePath, CancellationToken ct = default)
    {
        var fullPath = ResolvePath(relativePath);
        if (!File.Exists(fullPath))
            throw new FileNotFoundException("Fichier introuvable dans le stockage.", relativePath);

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string relativePath, CancellationToken ct = default)
    {
        var fullPath = ResolvePath(relativePath);
        if (File.Exists(fullPath))
            File.Delete(fullPath);
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(string relativePath, CancellationToken ct = default)
    {
        var fullPath = ResolvePath(relativePath);
        return Task.FromResult(File.Exists(fullPath));
    }

    private string ResolvePath(string relativePath)
    {
        var normalized = relativePath.Replace('/', Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_basePath, normalized));
        var root = Path.GetFullPath(_basePath);
        if (!fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Chemin de stockage invalide.");
        return fullPath;
    }
}
