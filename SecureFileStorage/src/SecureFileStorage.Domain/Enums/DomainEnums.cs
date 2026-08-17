namespace SecureFileStorage.Domain.Enums;

public enum DocumentStatus
{
    Active = 0,
    Archived = 1,
    Deleted = 2
}

public enum StorageProviderType
{
    LocalFileSystem = 0,
    S3Compatible = 1,
    Nas = 2
}

public enum DatabaseProviderType
{
    PostgreSql = 0,
    SqlServer = 1,
    Oracle = 2,
    MySql = 3,
    Other = 4
}

/// <summary>
/// Algorithmes disponibles pour les nouveaux fichiers.
/// AesCbcLegacy reste pris en charge uniquement pour lire les fichiers historiques.
/// </summary>
public enum EncryptionAlgorithm
{
    AesGcm = 0,
    ChaCha20Poly1305 = 1,
    AesCbcLegacy = 2
}

public enum AuditAction
{
    Upload = 0,
    Download = 1,
    View = 2,
    Update = 3,
    Delete = 4,
    Archive = 5,
    Restore = 6,
    Search = 7,
    Preview = 8,
    Login = 9,
    PermissionChange = 10,
    IntegrityCheck = 11,
    AntivirusAlert = 12,
    Logout = 13,
    Share = 14,
    CheckOut = 15,
    CheckIn = 16,
    Favorite = 17,
    Import = 18
}

public enum DocumentVisibility
{
    Private = 0,
    Shared = 1,
    Public = 2
}

public enum ShareAccessLevel
{
    Read = 0,
    Download = 1,
    Write = 2,
    Preview = 3
}

public enum PermissionType
{
    Read = 0,
    Write = 1,
    Delete = 2,
    Admin = 3
}

public enum AntivirusScanResult
{
    Clean = 0,
    Infected = 1,
    Skipped = 2,
    Error = 3
}
