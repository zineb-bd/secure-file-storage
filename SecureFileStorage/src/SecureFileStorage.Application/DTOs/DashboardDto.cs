namespace SecureFileStorage.Application.DTOs;

public record DashboardStatsDto(
    int TotalDocuments,
    long StorageUsedBytes,
    long LogicalStorageBytes,
    long BytesSavedByDedup,
    IEnumerable<DocumentDto> RecentDocuments,
    IEnumerable<RecentActivityDto> RecentActivity,
    IEnumerable<NotificationDto> Notifications);

public record RecentActivityDto(string Action, string DocumentName, Guid? DocumentId, DateTime Timestamp);

public record NotificationDto(string Type, string Message, DateTime Date);
