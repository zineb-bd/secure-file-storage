namespace SecureFileStorage.Infrastructure.Security;

public static class FileValidator
{
    private static readonly HashSet<string> AllowedExtensions =
    [
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt", ".csv", ".zip"
    ];

    private static readonly HashSet<string> AllowedMimePrefixes =
    [
        "application/pdf", "application/msword", "application/vnd.",
        "image/", "text/", "application/zip"
    ];

    public const long MaxFileSizeBytes = 100 * 1024 * 1024;

    public static (bool IsValid, string? Error) Validate(string fileName, string contentType, long sizeBytes)
    {
        if (sizeBytes <= 0)
            return (false, "Le fichier est vide.");
        if (sizeBytes > MaxFileSizeBytes)
            return (false, $"Taille maximale dépassée ({MaxFileSizeBytes / 1024 / 1024} Mo).");

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext) || !AllowedExtensions.Contains(ext))
            return (false, $"Type de fichier non autorisé : {ext}. Types acceptés : PDF, Office, images, TXT, ZIP.");

        if (!AllowedMimePrefixes.Any(p => contentType.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
            return (false, $"Type MIME non autorisé : {contentType}.");

        return (true, null);
    }

    public static string GetExtension(string fileName) =>
        Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
}
