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
    SqlServer = 1
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
    CheckIn = 16
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
