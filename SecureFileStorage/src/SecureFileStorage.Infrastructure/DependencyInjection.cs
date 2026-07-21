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
        services.AddScoped<IDocumentService, DocumentService>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<IPermissionChecker, PermissionChecker>();
        services.AddScoped<IStorageConfigService, StorageConfigService>();
        services.AddScoped<DashboardService>();

        return services;
    }
}
