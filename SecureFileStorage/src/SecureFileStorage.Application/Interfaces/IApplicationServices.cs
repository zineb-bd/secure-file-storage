using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;

namespace SecureFileStorage.Application.Interfaces;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<UserDto?> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<bool> ResetPasswordAsync(Guid userId, string newPassword, CancellationToken ct = default);
    Task<UserDto?> GetProfileAsync(Guid userId, CancellationToken ct = default);
    Task<UserDto?> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default);
    Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default);
}

public interface IUserService
{
    Task<IEnumerable<UserDto>> GetAllAsync(CancellationToken ct = default);
    Task<IEnumerable<UserDirectoryEntry>> GetDirectoryAsync(CancellationToken ct = default);
    Task<UserDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default);
    Task<UserDto?> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default);
    Task<bool> DeactivateAsync(Guid id, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IRoleService
{
    Task<IEnumerable<RoleDto>> GetAllAsync(CancellationToken ct = default);
    Task<RoleDto> CreateAsync(CreateRoleRequest request, CancellationToken ct = default);
    Task<RoleDto?> UpdateAsync(Guid id, UpdateRoleRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<bool> AssignRoleAsync(AssignRoleRequest request, CancellationToken ct = default);
}

public interface IDocumentService
{
    Task<DocumentDto> UploadAsync(Stream fileStream, string fileName, string contentType, Guid userId, DocumentUploadRequest request, CancellationToken ct = default);
    Task<(Stream Stream, string FileName, string ContentType)?> DownloadAsync(Guid documentId, Guid userId, int? version = null, CancellationToken ct = default);
    Task<(Stream Stream, string ContentType)?> PreviewAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<DocumentDto?> GetByIdAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task<PagedResult<DocumentDto>> SearchAsync(DocumentSearchRequest request, Guid userId, CancellationToken ct = default);
    Task<PagedResult<DocumentDto>> GetSharedWithMeAsync(DocumentSearchRequest request, Guid userId, CancellationToken ct = default);
    Task<IEnumerable<DocumentVersionDto>> GetVersionsAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<DocumentDto?> UpdateAsync(Guid documentId, Stream fileStream, string fileName, string contentType, Guid userId, string? changeComment, CancellationToken ct = default);
    Task<bool> ArchiveAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<bool> RestoreAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<bool> SoftDeleteAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<bool> MoveToTrashAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<PagedResult<DocumentDto>> GetTrashAsync(DocumentSearchRequest request, Guid userId, CancellationToken ct = default);
    Task<EmptyTrashResult> EmptyTrashAsync(Guid userId, CancellationToken ct = default);
    Task<bool> GrantPermissionAsync(Guid documentId, GrantPermissionRequest request, Guid grantedById, CancellationToken ct = default);
    Task<bool> RevokePermissionAsync(Guid documentId, Guid targetUserId, Guid revokedById, CancellationToken ct = default);
    Task<DocumentUserShareDto?> ShareWithUserAsync(Guid documentId, ShareWithUserRequest request, Guid sharedById, CancellationToken ct = default);
    Task<CreateShareLinkResponse?> CreateShareLinkAsync(Guid documentId, CreateShareLinkRequest request, Guid createdById, string baseUrl, CancellationToken ct = default);
    Task<DocumentSharesDto?> GetSharesAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<bool> RevokeShareLinkAsync(Guid documentId, Guid linkId, Guid revokedById, CancellationToken ct = default);
    Task<SharedDocumentInfoDto?> GetSharedInfoAsync(string token, CancellationToken ct = default);
    Task<(Stream Stream, string ContentType)?> PreviewByTokenAsync(string token, CancellationToken ct = default);
    Task<(Stream Stream, string FileName, string ContentType)?> DownloadByTokenAsync(string token, CancellationToken ct = default);
    Task<IntegrityCheckResult> VerifyIntegrityAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<DocumentDetailDto?> GetDetailAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task<DocumentDto?> UpdateMetadataAsync(Guid documentId, UpdateMetadataRequest request, Guid userId, bool isAdmin, CancellationToken ct = default);
    Task<DocumentDto?> RestoreVersionAsync(Guid documentId, int versionNumber, Guid userId, CancellationToken ct = default);
    Task<bool> PermanentDeleteAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<DocumentDto?> CheckOutAsync(Guid documentId, Guid userId, DocumentLockRequest? request = null, CancellationToken ct = default);
    Task<DocumentDto?> CheckInAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<FavoriteToggleResult?> AddFavoriteAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<FavoriteToggleResult?> RemoveFavoriteAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<PagedResult<DocumentDto>> GetFavoritesAsync(DocumentSearchRequest request, Guid userId, CancellationToken ct = default);
    Task<DocumentCollaboratorsDto?> GetCollaboratorsAsync(Guid documentId, Guid userId, CancellationToken ct = default);
}

public interface IDocumentImportService
{
    IReadOnlyList<DocumentImportSourceDto> GetSources();
    Task<DocumentDto> ImportFromUrlAsync(ImportFromUrlRequest request, Guid userId, CancellationToken ct = default);
}

public interface IDocumentImportSource
{
    string Id { get; }
    string DisplayName { get; }
    bool IsEnabled { get; }
    string? UnavailableReason { get; }
}

public interface IAuditService
{
    Task LogAsync(Guid? userId, AuditAction action, string resourceType, Guid? resourceId, string details, string ipAddress, bool success = true, CancellationToken ct = default);
    Task<PagedResult<AuditLogDto>> SearchAsync(AuditSearchRequest request, CancellationToken ct = default);
    Task<byte[]> ExportAsync(AuditSearchRequest request, CancellationToken ct = default);
}

public interface IStorageService
{
    Task<string> SaveAsync(Stream content, string relativePath, CancellationToken ct = default);
    Task<Stream> ReadAsync(string relativePath, CancellationToken ct = default);
    Task DeleteAsync(string relativePath, CancellationToken ct = default);
    Task<bool> ExistsAsync(string relativePath, CancellationToken ct = default);
}

public interface IEncryptionService
{
    Task<(byte[] EncryptedData, string EncryptedKey)> EncryptAsync(byte[] plainData, CancellationToken ct = default);
    Task<byte[]> DecryptAsync(byte[] encryptedData, string encryptedKey, CancellationToken ct = default);
    string ComputeSha256Hash(byte[] data);
    Task<string> RotateMasterKeyAsync(CancellationToken ct = default);
}

public interface IAntivirusService
{
    Task<(AntivirusScanResult Result, string? ThreatName)> ScanAsync(Stream fileStream, string fileName, CancellationToken ct = default);
    Task<IEnumerable<AntivirusAlertDto>> GetAlertsAsync(bool unresolvedOnly = true, int take = 50, CancellationToken ct = default);
    Task<AntivirusStatsDto> GetStatsAsync(CancellationToken ct = default);
}

public interface IStorageConfigService
{
    Task<StorageConfigDto?> GetActiveAsync(CancellationToken ct = default);
    Task<StorageConfigDto> UpdateAsync(UpdateStorageConfigRequest request, CancellationToken ct = default);
}

public interface INotificationService
{
    Task NotifyDocumentSharedAsync(
        Guid recipientUserId,
        Guid actorUserId,
        Guid documentId,
        string documentName,
        string accessLevel,
        CancellationToken ct = default);

    Task NotifyDocumentSharedManyAsync(
        IEnumerable<Guid> recipientUserIds,
        Guid actorUserId,
        Guid documentId,
        string documentName,
        CancellationToken ct = default);

    Task<NotificationListDto> GetForUserAsync(Guid userId, int take = 40, CancellationToken ct = default);
    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken ct = default);
    Task<bool> MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken ct = default);
    Task MarkAllAsReadAsync(Guid userId, CancellationToken ct = default);
}

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Email { get; }
    IEnumerable<string> Roles { get; }
    bool IsInRole(string role);
}

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public interface IDocumentRepository
{
    Task<Document?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Document?> GetByIdWithVersionsAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Document document, CancellationToken ct = default);
    Task<(IEnumerable<Document> Items, int Total)> SearchAsync(DocumentSearchRequest request, Guid? ownerFilter, CancellationToken ct = default);
}

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> GetByIdWithRolesAsync(Guid id, CancellationToken ct = default);
    Task<IEnumerable<User>> GetAllWithRolesAsync(CancellationToken ct = default);
    Task AddAsync(User user, CancellationToken ct = default);
    Task<bool> EmailExistsAsync(string email, CancellationToken ct = default);
}

public interface IRoleRepository
{
    Task<Role?> GetByNameAsync(string name, CancellationToken ct = default);
    Task<IEnumerable<Role>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(Role role, CancellationToken ct = default);
}

public interface IAuditRepository
{
    Task AddAsync(AuditLog log, CancellationToken ct = default);
    Task<(IEnumerable<AuditLog> Items, int Total)> SearchAsync(AuditSearchRequest request, CancellationToken ct = default);
}

public interface IPermissionChecker
{
    Task<bool> CanReadAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<bool> CanDownloadAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<bool> CanWriteAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<bool> CanDeleteAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<bool> CanRestoreFromTrashAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    Task<bool> CanManageSharesAsync(Guid documentId, Guid userId, CancellationToken ct = default);
    bool IsAdmin(IEnumerable<string> roles);
}

public interface IChatbotService
{
    Task<ChatResponse> AskAsync(ChatRequest request, CancellationToken ct = default);
}
