using System.IO.Compression;

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
        if (string.IsNullOrWhiteSpace(fileName) || fileName != Path.GetFileName(fileName))
            return (false, "Nom de fichier non valide.");
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

    /// <summary>
    /// Vérifie que la signature binaire est cohérente avec l'extension déclarée.
    /// Ce contrôle bloque un exécutable renommé en PDF ou image.
    /// </summary>
    public static (bool IsValid, string? Error) ValidateContent(string fileName, byte[] data)
    {
        if (data.Length == 0)
            return (false, "Le fichier est vide.");

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var isZipContainer = StartsWith(data, 0x50, 0x4B, 0x03, 0x04)
            || StartsWith(data, 0x50, 0x4B, 0x05, 0x06);
        var isOleContainer = StartsWith(data, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1);

        var valid = ext switch
        {
            ".pdf" => StartsWith(data, 0x25, 0x50, 0x44, 0x46, 0x2D),
            ".doc" or ".xls" or ".ppt" => isOleContainer,
            ".docx" or ".xlsx" or ".pptx" or ".zip" => isZipContainer,
            ".jpg" or ".jpeg" => StartsWith(data, 0xFF, 0xD8, 0xFF),
            ".png" => StartsWith(data, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
            ".gif" => StartsWith(data, 0x47, 0x49, 0x46, 0x38),
            ".webp" => StartsWith(data, 0x52, 0x49, 0x46, 0x46)
                && data.Length > 11
                && data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50,
            ".txt" or ".csv" => !data.Take(Math.Min(data.Length, 4096)).Contains((byte)0),
            _ => false
        };

        if (!valid)
            return (false, "Le contenu du fichier ne correspond pas au type déclaré.");

        if (isZipContainer && !ValidateZipSafety(data, out var zipError))
            return (false, zipError);

        return (true, null);
    }

    private static bool StartsWith(byte[] data, params byte[] signature) =>
        data.Length >= signature.Length && data.AsSpan(0, signature.Length).SequenceEqual(signature);

    private static bool ValidateZipSafety(byte[] data, out string? error)
    {
        try
        {
            using var archive = new ZipArchive(new MemoryStream(data), ZipArchiveMode.Read);
            if (archive.Entries.Count > 1_000)
            {
                error = "Archive rejetée : trop de fichiers internes.";
                return false;
            }

            var uncompressedSize = archive.Entries.Sum(entry => entry.Length);
            if (uncompressedSize > MaxFileSizeBytes * 5)
            {
                error = "Archive rejetée : volume décompressé excessif.";
                return false;
            }
        }
        catch (InvalidDataException)
        {
            error = "Archive ZIP invalide.";
            return false;
        }

        error = null;
        return true;
    }

    public static string GetExtension(string fileName) =>
        Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
}
