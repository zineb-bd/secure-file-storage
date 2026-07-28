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

public record MaturityPillarDto(
    string Id,
    string Label,
    int Score,
    string Level,
    IEnumerable<MaturityMetricDto> Metrics);

public record MaturityMetricDto(string Key, int Value, int Total, int Percent);

public record MaturityRecommendationDto(
    string Id,
    string Severity,
    string Message,
    string? ActionLabel,
    string? ActionHref,
    int? Percent);

public record DocumentMaturityScoreDto(
    int OverallScore,
    string OverallLevel,
    MaturityPillarDto Organization,
    MaturityPillarDto Security,
    MaturityPillarDto Collaboration,
    IEnumerable<MaturityRecommendationDto> Recommendations,
    int TotalDocuments,
    DateTime GeneratedAt);
