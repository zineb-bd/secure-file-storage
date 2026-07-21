using Microsoft.EntityFrameworkCore;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Persistence;

namespace SecureFileStorage.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        if (!await context.Roles.AnyAsync())
        {
            var adminRole = new Role { Id = Guid.NewGuid(), Name = "Admin", Description = "Administrateur système" };
            var userRole = new Role { Id = Guid.NewGuid(), Name = "User", Description = "Utilisateur standard" };
            var managerRole = new Role { Id = Guid.NewGuid(), Name = "Manager", Description = "Responsable avec droits étendus" };

            context.Roles.AddRange(adminRole, userRole, managerRole);

            var admin = new User
            {
                Id = Guid.NewGuid(),
                Email = "admin@entreprise.local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                FirstName = "Admin",
                LastName = "Système"
            };
            admin.UserRoles.Add(new UserRole { UserId = admin.Id, RoleId = adminRole.Id });
            context.Users.Add(admin);

            context.StorageConfigurations.Add(new StorageConfiguration
            {
                Id = Guid.NewGuid(),
                ProviderType = StorageProviderType.LocalFileSystem,
                DatabaseProvider = DatabaseProviderType.PostgreSql,
                BasePath = "./storage",
                IsActive = true
            });

            await context.SaveChangesAsync();
        }
    }
}
