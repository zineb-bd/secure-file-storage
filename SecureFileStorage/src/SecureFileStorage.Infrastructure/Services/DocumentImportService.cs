using System.Net;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Security;

namespace SecureFileStorage.Infrastructure.Services;

/// <summary>
/// Orchestrates document imports from multiple sources into the shared upload security pipeline.
/// Cloud providers (Google Drive, OneDrive, Dropbox) are registered as disabled stubs for future extension.
/// </summary>
public class DocumentImportService : IDocumentImportService
{
    private static readonly HashSet<string> BlockedHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"
    };

    private readonly IDocumentService _documentService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IEnumerable<IDocumentImportSource> _sources;
    private readonly IAuditService _auditService;

    public DocumentImportService(
        IDocumentService documentService,
        IHttpClientFactory httpClientFactory,
        IEnumerable<IDocumentImportSource> sources,
        IAuditService auditService)
    {
        _documentService = documentService;
        _httpClientFactory = httpClientFactory;
        _sources = sources;
        _auditService = auditService;
    }

    public IReadOnlyList<DocumentImportSourceDto> GetSources() =>
        _sources
            .Select(s => new DocumentImportSourceDto(s.Id, s.DisplayName, s.IsEnabled, s.UnavailableReason))
            .ToList();

    public async Task<DocumentDto> ImportFromUrlAsync(
        ImportFromUrlRequest request, Guid userId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Url))
            throw new InvalidOperationException("L'URL est obligatoire.");

        if (!Uri.TryCreate(request.Url.Trim(), UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new InvalidOperationException("Lien invalide. Utilisez une URL HTTP ou HTTPS absolue.");

        if (BlockedHosts.Contains(uri.Host) || IsPrivateIp(uri.Host))
            throw new InvalidOperationException("Cette URL n'est pas autorisée pour des raisons de sécurité.");

        var client = _httpClientFactory.CreateClient("DocumentImport");
        using var response = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Impossible de télécharger le fichier (HTTP {(int)response.StatusCode}).");

        var contentLength = response.Content.Headers.ContentLength;
        if (contentLength is > FileValidator.MaxFileSizeBytes)
            throw new InvalidOperationException($"Taille maximale dépassée ({FileValidator.MaxFileSizeBytes / 1024 / 1024} Mo).");

        await using var remoteStream = await response.Content.ReadAsStreamAsync(ct);
        using var ms = new MemoryStream();
        var buffer = new byte[81920];
        long total = 0;
        int read;
        while ((read = await remoteStream.ReadAsync(buffer.AsMemory(0, buffer.Length), ct)) > 0)
        {
            total += read;
            if (total > FileValidator.MaxFileSizeBytes)
                throw new InvalidOperationException($"Taille maximale dépassée ({FileValidator.MaxFileSizeBytes / 1024 / 1024} Mo).");
            await ms.WriteAsync(buffer.AsMemory(0, read), ct);
        }

        if (ms.Length == 0)
            throw new InvalidOperationException("Le fichier téléchargé est vide.");

        var fileName = ResolveFileName(request.FileName, uri, response);
        var contentType = response.Content.Headers.ContentType?.MediaType
            ?? GuessContentType(fileName);

        var validation = FileValidator.Validate(fileName, contentType, ms.Length);
        if (!validation.IsValid)
            throw new InvalidOperationException(validation.Error ?? "Fichier invalide.");

        ms.Position = 0;
        var result = await _documentService.UploadAsync(
            ms, fileName, contentType, userId,
            new DocumentUploadRequest(
                request.Category,
                request.Description,
                "Import depuis URL",
                null,
                request.Visibility,
                request.PublicAccessLevel,
                request.SharedUsers),
            ct);

        await _auditService.LogAsync(userId, AuditAction.Import, "Document", result.Id,
            $"Import URL : {uri.Host}", "", ct: ct);

        return result;
    }

    private static string ResolveFileName(string? requested, Uri uri, HttpResponseMessage response)
    {
        if (!string.IsNullOrWhiteSpace(requested))
            return Path.GetFileName(requested.Trim());

        var disposition = response.Content.Headers.ContentDisposition?.FileNameStar
            ?? response.Content.Headers.ContentDisposition?.FileName;
        if (!string.IsNullOrWhiteSpace(disposition))
            return Path.GetFileName(disposition.Trim().Trim('"'));

        var fromPath = Path.GetFileName(uri.AbsolutePath);
        if (!string.IsNullOrWhiteSpace(fromPath) && fromPath.Contains('.'))
            return fromPath;

        return "imported-document.bin";
    }

    private static string GuessContentType(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".pdf" => "application/pdf",
            ".doc" => "application/msword",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls" => "application/vnd.ms-excel",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".ppt" => "application/vnd.ms-powerpoint",
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".txt" => "text/plain",
            ".csv" => "text/csv",
            ".zip" => "application/zip",
            _ => "application/octet-stream"
        };
    }

    private static bool IsPrivateIp(string host)
    {
        if (!IPAddress.TryParse(host, out var ip))
            return false;

        var bytes = ip.GetAddressBytes();
        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && bytes.Length == 4)
        {
            return bytes[0] == 10
                || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
                || (bytes[0] == 192 && bytes[1] == 168)
                || (bytes[0] == 169 && bytes[1] == 254);
        }

        return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || IPAddress.IsLoopback(ip);
    }
}

public sealed class DeviceImportSource : IDocumentImportSource
{
    public string Id => "device";
    public string DisplayName => "Upload from Device";
    public bool IsEnabled => true;
    public string? UnavailableReason => null;
}

public sealed class UrlImportSource : IDocumentImportSource
{
    public string Id => "url";
    public string DisplayName => "Import from Link";
    public bool IsEnabled => true;
    public string? UnavailableReason => null;
}

public sealed class GoogleDriveImportSource : IDocumentImportSource
{
    public string Id => "googledrive";
    public string DisplayName => "Google Drive";
    public bool IsEnabled => false;
    public string? UnavailableReason => "Coming soon";
}

public sealed class OneDriveImportSource : IDocumentImportSource
{
    public string Id => "onedrive";
    public string DisplayName => "OneDrive";
    public bool IsEnabled => false;
    public string? UnavailableReason => "Coming soon";
}

public sealed class DropboxImportSource : IDocumentImportSource
{
    public string Id => "dropbox";
    public string DisplayName => "Dropbox";
    public bool IsEnabled => false;
    public string? UnavailableReason => "Coming soon";
}
