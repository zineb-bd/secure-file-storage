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

public class ChatbotSettings
{
    public const string SectionName = "Chatbot";
    public bool Enabled { get; set; } = true;
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.openai.com/v1";
    public string Model { get; set; } = "gpt-4o-mini";
    public int MaxTokens { get; set; } = 400;
}
