using Microsoft.EntityFrameworkCore;
using SecureFileStorage.Domain.Entities;

namespace SecureFileStorage.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<StoredBlob> StoredBlobs => Set<StoredBlob>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<DocumentVersion> DocumentVersions => Set<DocumentVersion>();
    public DbSet<DocumentPermission> DocumentPermissions => Set<DocumentPermission>();
    public DbSet<DocumentShareLink> DocumentShareLinks => Set<DocumentShareLink>();
    public DbSet<DocumentFavorite> DocumentFavorites => Set<DocumentFavorite>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<StorageConfiguration> StorageConfigurations => Set<StorageConfiguration>();
    public DbSet<EncryptionKeyRecord> EncryptionKeys => Set<EncryptionKeyRecord>();
    public DbSet<AntivirusAlert> AntivirusAlerts => Set<AntivirusAlert>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256);
        });

        modelBuilder.Entity<Role>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<UserRole>(e =>
        {
            e.HasKey(x => new { x.UserId, x.RoleId });
            e.HasOne(x => x.User).WithMany(u => u.UserRoles).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Role).WithMany(r => r.UserRoles).HasForeignKey(x => x.RoleId);
        });

        modelBuilder.Entity<Document>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Owner).WithMany(u => u.OwnedDocuments).HasForeignKey(x => x.OwnerId);
            e.HasOne(x => x.LockedBy).WithMany().HasForeignKey(x => x.LockedById).IsRequired(false);
            e.Property(x => x.FileName).HasMaxLength(500);
            e.Property(x => x.Sha256Hash).HasMaxLength(64);
        });

        modelBuilder.Entity<DocumentVersion>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Document).WithMany(d => d.Versions).HasForeignKey(x => x.DocumentId);
            e.HasOne(x => x.UploadedBy).WithMany().HasForeignKey(x => x.UploadedById);
            e.HasOne(x => x.StoredBlob).WithMany(b => b.Versions).HasForeignKey(x => x.StoredBlobId);
            e.HasIndex(x => new { x.DocumentId, x.VersionNumber }).IsUnique();
        });

        modelBuilder.Entity<StoredBlob>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Sha256Hash).HasMaxLength(64);
            e.HasIndex(x => x.Sha256Hash).IsUnique();
            e.Property(x => x.StoragePath).HasMaxLength(500);
        });

        modelBuilder.Entity<DocumentPermission>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Document).WithMany(d => d.Permissions).HasForeignKey(x => x.DocumentId);
            e.HasOne(x => x.User).WithMany(u => u.DocumentPermissions).HasForeignKey(x => x.UserId);
            e.HasIndex(x => new { x.DocumentId, x.UserId }).IsUnique();
        });

        modelBuilder.Entity<DocumentShareLink>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.TokenHash).HasMaxLength(64);
            e.HasIndex(x => x.TokenHash);
            e.HasOne(x => x.Document).WithMany(d => d.ShareLinks).HasForeignKey(x => x.DocumentId);
        });

        modelBuilder.Entity<DocumentFavorite>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.DocumentId }).IsUnique();
            e.HasOne(x => x.User).WithMany(u => u.Favorites).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Document).WithMany(d => d.Favorites).HasForeignKey(x => x.DocumentId);
        });

        modelBuilder.Entity<UserNotification>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Type).HasMaxLength(64);
            e.Property(x => x.Message).HasMaxLength(1000);
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasIndex(x => new { x.UserId, x.IsRead });
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Actor).WithMany().HasForeignKey(x => x.ActorId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Document).WithMany().HasForeignKey(x => x.DocumentId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Timestamp);
            e.HasOne(x => x.User).WithMany(u => u.AuditLogs).HasForeignKey(x => x.UserId);
        });
    }
}
