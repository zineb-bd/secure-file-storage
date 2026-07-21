namespace SecureFileStorage.Application.Options;

public class JwtSettings
{
    public const string SectionName = "Jwt";
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "SecureFileStorage";
    public string Audience { get; set; } = "SecureFileStorageClients";
    public int ExpirationMinutes { get; set; } = 60;
}

public class EncryptionSettings
{
    public const string SectionName = "Encryption";
    public string MasterKey { get; set; } = string.Empty;
}

public class StorageSettings
{
    public const string SectionName = "Storage";
    public string Provider { get; set; } = "LocalFileSystem";
    public string BasePath { get; set; } = "./storage";
    public string? S3Endpoint { get; set; }
    public string? S3Bucket { get; set; }
    public string? S3AccessKey { get; set; }
    public string? S3SecretKey { get; set; }
}

public class AntivirusSettings
{
    public const string SectionName = "Antivirus";
    public bool Enabled { get; set; }
    public string ClamAvHost { get; set; } = "localhost";
    public int ClamAvPort { get; set; } = 3310;
}

public class DatabaseSettings
{
    public const string SectionName = "Database";
    public string Provider { get; set; } = "PostgreSql";
    public string ConnectionString { get; set; } = string.Empty;
}
