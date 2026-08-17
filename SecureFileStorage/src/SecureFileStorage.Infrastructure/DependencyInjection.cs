using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Application.Options;
using SecureFileStorage.Infrastructure.Persistence;
using SecureFileStorage.Infrastructure.Security;
using SecureFileStorage.Infrastructure.Services;
using SecureFileStorage.Infrastructure.Storage;

namespace SecureFileStorage.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.Configure<EncryptionSettings>(configuration.GetSection(EncryptionSettings.SectionName));
        services.Configure<StorageSettings>(configuration.GetSection(StorageSettings.SectionName));
        services.Configure<AntivirusSettings>(configuration.GetSection(AntivirusSettings.SectionName));
        services.Configure<DatabaseSettings>(configuration.GetSection(DatabaseSettings.SectionName));
        services.Configure<ChatbotSettings>(configuration.GetSection(ChatbotSettings.SectionName));

        var dbSettings = configuration.GetSection(DatabaseSettings.SectionName).Get<DatabaseSettings>()
            ?? new DatabaseSettings();

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            if (dbSettings.Provider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
                options.UseSqlServer(dbSettings.ConnectionString);
            else
                options.UseNpgsql(dbSettings.ConnectionString);
        });

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IDocumentRepository, DocumentRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IAuditRepository, AuditRepository>();

        services.AddScoped<IEncryptionService, AesEncryptionService>();
        services.AddScoped<IAntivirusService, AntivirusService>();
        services.AddScoped<IStorageService, LocalFileStorageService>();

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IRoleService, RoleService>();
        services.AddScoped<IUserGroupService, UserGroupService>();
        services.AddScoped<ICategoryAccessService, CategoryAccessService>();
        services.AddScoped<IDocumentService, DocumentService>();
        services.AddScoped<IDocumentImportService, DocumentImportService>();
        services.AddScoped<IDocumentImportSource, DeviceImportSource>();
        services.AddScoped<IDocumentImportSource, UrlImportSource>();
        services.AddScoped<IDocumentImportSource, GoogleDriveImportSource>();
        services.AddScoped<IDocumentImportSource, OneDriveImportSource>();
        services.AddScoped<IDocumentImportSource, DropboxImportSource>();
        services.AddHttpClient("DocumentImport", client =>
        {
            client.Timeout = TimeSpan.FromMinutes(2);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("SecureFileStorage/1.0");
        });
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<IPermissionChecker, PermissionChecker>();
        services.AddScoped<IStorageConfigService, StorageConfigService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<StoredBlobService>();
        services.AddScoped<DashboardService>();

        var chatbotSettings = configuration.GetSection(ChatbotSettings.SectionName).Get<ChatbotSettings>()
            ?? new ChatbotSettings();
        var baseUrl = string.IsNullOrWhiteSpace(chatbotSettings.BaseUrl)
            ? "https://api.openai.com/v1/"
            : chatbotSettings.BaseUrl.TrimEnd('/') + "/";

        services.AddScoped<IChatbotAnalyticsService, ChatbotAnalyticsService>();
        services.AddHttpClient<IChatbotService, ChatbotService>(client =>
        {
            client.BaseAddress = new Uri(baseUrl);
            client.Timeout = TimeSpan.FromSeconds(45);
        });

        return services;
    }
}
