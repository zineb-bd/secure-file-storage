namespace SecureFileStorage.Application.DTOs;

public record LoginRequest(string Email, string Password);

public record LoginResponse(string Token, string Email, string FullName, IEnumerable<string> Roles, DateTime ExpiresAt);

public record RegisterRequest(string Email, string Password, string FirstName, string LastName);

public record UserDto(Guid Id, string Email, string FirstName, string LastName, bool IsActive, IEnumerable<string> Roles, DateTime CreatedAt);

public record CreateUserRequest(string Email, string Password, string FirstName, string LastName, IEnumerable<string>? RoleNames);

public record UpdateUserRequest(string? FirstName, string? LastName, bool? IsActive);

public record RoleDto(Guid Id, string Name, string Description);

public record CreateRoleRequest(string Name, string Description);

public record UpdateRoleRequest(string? Name, string? Description);

public record AssignRoleRequest(Guid UserId, Guid RoleId);

public record UploadShareEntry(string UserEmail, string AccessLevel);

public record DocumentUploadRequest(
    string? Category,
    string? Description,
    string? ChangeComment,
    IEnumerable<Guid>? AllowedUserIds,
    string Visibility = "Private",
    string? PublicAccessLevel = null,
    IEnumerable<UploadShareEntry>? SharedUsers = null);

public record UserDirectoryEntry(Guid Id, string Email, string FullName);

public record DocumentDto(
    Guid Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    string Category,
    string Description,
    string Sha256Hash,
    int CurrentVersion,
    string Status,
    Guid OwnerId,
    string OwnerName,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? DeletedAt,
    string LastScanResult,
    bool WasDeduplicated = false,
    bool IsLocked = false,
    Guid? LockedById = null,
    string? LockedByName = null,
    DateTime? LockedAt = null,
    DateTime? LockExpiresAt = null,
    bool IsLockedByCurrentUser = false,
    bool CanModify = false,
    string Visibility = "Private",
    string PublicAccessLevel = "Read",
    string? MyAccessLevel = null,
    bool IsOwner = false,
    bool IsFavorite = false);

public record EmptyTrashResult(int DeletedCount);

public record DocumentVersionDto(
    Guid Id,
    int VersionNumber,
    long SizeBytes,
    string Sha256Hash,
    Guid UploadedById,
    string UploadedByName,
    DateTime CreatedAt,
    string? ChangeComment);

public record DocumentSearchRequest(
    string? FileName,
    string? Category,
    string? ContentType,
    Guid? OwnerId,
    string? Status,
    DateTime? CreatedFrom,
    DateTime? CreatedTo,
    int Page = 1,
    int PageSize = 20);

public record PagedResult<T>(IEnumerable<T> Items, int TotalCount, int Page, int PageSize);

public record GrantPermissionRequest(Guid UserId, string Permission);

public record ShareWithUserRequest(
    Guid? UserId,
    string? UserEmail,
    string AccessLevel,
    DateTime? ExpiresAt = null,
    int? ExpiresInHours = null);

public record CreateShareLinkRequest(
    string AccessLevel,
    DateTime? ExpiresAt = null,
    int? ExpiresInHours = null);

public record DocumentUserShareDto(
    Guid Id,
    Guid UserId,
    string UserEmail,
    string UserName,
    string AccessLevel,
    DateTime GrantedAt,
    DateTime? ExpiresAt,
    bool IsExpired);

public record ShareLinkDto(
    Guid Id,
    string AccessLevel,
    DateTime CreatedAt,
    DateTime ExpiresAt,
    bool IsRevoked,
    bool IsExpired);

public record CreateShareLinkResponse(
    Guid Id,
    string Token,
    string ShareUrl,
    string AccessLevel,
    DateTime ExpiresAt);

public record DocumentSharesDto(
    IEnumerable<DocumentUserShareDto> UserShares,
    IEnumerable<ShareLinkDto> Links);

public record DocumentCollaboratorDto(
    Guid? UserId,
    string UserName,
    string UserEmail,
    string Role,
    string AccessLevel,
    Guid? PermissionId = null,
    DateTime? GrantedAt = null,
    DateTime? ExpiresAt = null,
    bool IsExpired = false);

public record DocumentCollaboratorsDto(
    DocumentCollaboratorDto Owner,
    IEnumerable<DocumentCollaboratorDto> Collaborators,
    bool CanManage);

public record FavoriteToggleResult(Guid DocumentId, bool IsFavorite);

public record ImportFromUrlRequest(
    string Url,
    string? FileName = null,
    string? Category = null,
    string? Description = null,
    string Visibility = "Private",
    string? PublicAccessLevel = null,
    IEnumerable<UploadShareEntry>? SharedUsers = null);

public record DocumentImportSourceDto(
    string Id,
    string DisplayName,
    bool IsEnabled,
    string? UnavailableReason = null);

public record SharedDocumentInfoDto(
    Guid Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    string AccessLevel,
    DateTime ExpiresAt,
    string OwnerName);

public record StorageConfigDto(
    Guid Id,
    string ProviderType,
    string DatabaseProvider,
    string BasePath,
    string? S3Endpoint,
    string? S3Bucket,
    bool IsActive,
    DateTime UpdatedAt);

public record UpdateStorageConfigRequest(
    string ProviderType,
    string DatabaseProvider,
    string BasePath,
    string? S3Endpoint,
    string? S3Bucket,
    string? S3AccessKey,
    string? S3SecretKey);

public record AuditLogDto(
    Guid Id,
    Guid? UserId,
    string? UserEmail,
    string Action,
    string ResourceType,
    Guid? ResourceId,
    string Details,
    string IpAddress,
    bool Success,
    DateTime Timestamp);

public record AuditSearchRequest(
    Guid? UserId,
    string? Action,
    Guid? ResourceId,
    DateTime? From,
    DateTime? To,
    int Page = 1,
    int PageSize = 50);

public record AntivirusAlertDto(
    Guid Id,
    Guid? DocumentId,
    string FileName,
    string ThreatName,
    string Details,
    DateTime DetectedAt,
    bool IsResolved);

public record IntegrityCheckResult(
    Guid DocumentId,
    string FileName,
    bool IsValid,
    string ExpectedHash,
    string? ActualHash,
    string Message);

public record ResetPasswordRequest(string NewPassword);

public record UpdateProfileRequest(string? FirstName, string? LastName);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record UpdateMetadataRequest(string? Category, string? Description, Guid? OwnerId);

public record DocumentLockRequest(int? ExpiresInHours = 8);

public record RotateKeyResponse(string KeyIdentifier, DateTime RotatedAt);

public record DocumentDetailDto(
    Guid Id,
    string FileName,
    string Extension,
    string ContentType,
    long SizeBytes,
    string Category,
    string Description,
    string Sha256Hash,
    int CurrentVersion,
    string Status,
    Guid OwnerId,
    string OwnerName,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    string LastScanResult,
    string? StoragePath,
    bool IsLocked = false,
    Guid? LockedById = null,
    string? LockedByName = null,
    DateTime? LockedAt = null,
    DateTime? LockExpiresAt = null,
    bool IsLockedByCurrentUser = false,
    bool CanModify = false,
    string Visibility = "Private",
    string PublicAccessLevel = "Read");

public record ChatRequest(string Message, string? Locale = null);

public record ChatResponse(string Reply, string Source);
