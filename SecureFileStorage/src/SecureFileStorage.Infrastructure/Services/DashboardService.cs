using Microsoft.EntityFrameworkCore;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Persistence;

namespace SecureFileStorage.Infrastructure.Services;

public class DashboardService(ApplicationDbContext context, IPermissionChecker permissionChecker)
{
    public async Task<DashboardStatsDto> GetStatsAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstAsync(u => u.Id == userId, ct);

        var isAdmin = user.UserRoles.Any(ur => ur.Role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase));

        var query = context.Documents
            .Include(d => d.Owner)
            .Where(d => d.Status != DocumentStatus.Deleted);

        if (!isAdmin)
            query = query.Where(d => d.OwnerId == userId || d.Permissions.Any(p => p.UserId == userId));

        var docs = await query.ToListAsync(ct);
        var total = docs.Count;
        var storage = docs.Sum(d => d.SizeBytes);

        var recent = docs
            .OrderByDescending(d => d.CreatedAt)
            .Take(5)
            .Select(d => new DocumentDto(
                d.Id, d.FileName, d.ContentType, d.SizeBytes, d.Category, d.Description,
                d.Sha256Hash, d.CurrentVersion, d.Status.ToString(), d.OwnerId,
                $"{d.Owner.FirstName} {d.Owner.LastName}", d.CreatedAt, d.UpdatedAt, d.DeletedAt,
                d.LastScanResult.ToString()));

        var activity = await context.AuditLogs
            .Where(a => a.UserId == userId && a.ResourceType == "Document")
            .OrderByDescending(a => a.Timestamp)
            .Take(8)
            .ToListAsync(ct);

        var docIds = activity.Where(a => a.ResourceId.HasValue).Select(a => a.ResourceId!.Value).Distinct().ToList();
        var docNames = await context.Documents
            .Where(d => docIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, d => d.FileName, ct);

        var recentActivity = activity.Select(a => new RecentActivityDto(
            a.Action.ToString(),
            a.ResourceId.HasValue && docNames.TryGetValue(a.ResourceId.Value, out var n) ? n : "—",
            a.ResourceId,
            a.Timestamp));

        var notifications = docs
            .Where(d => d.UpdatedAt.HasValue && d.UpdatedAt > DateTime.UtcNow.AddDays(-7))
            .OrderByDescending(d => d.UpdatedAt)
            .Take(3)
            .Select(d => new NotificationDto("Version",
                $"Document « {d.FileName} » mis à jour (v{d.CurrentVersion})",
                d.UpdatedAt ?? d.CreatedAt))
            .ToList();

        return new DashboardStatsDto(total, storage, recent, recentActivity, notifications);
    }
}
