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
            query = query.Where(d => d.OwnerId == userId || d.Permissions.Any(p => p.UserId == userId && (p.ExpiresAt == null || p.ExpiresAt > DateTime.UtcNow)));

        var docs = await query.ToListAsync(ct);
        var total = docs.Count;
        var logicalStorage = docs.Sum(d => d.SizeBytes);

        var blobStorage = await context.StoredBlobs.SumAsync(b => (long?)b.SizeBytes, ct) ?? 0L;
        var legacyStorage = await context.DocumentVersions
            .Where(v => v.StoredBlobId == null)
            .SumAsync(v => (long?)v.SizeBytes, ct) ?? 0L;
        var physicalStorage = blobStorage + legacyStorage;
        var bytesSaved = Math.Max(0, logicalStorage - physicalStorage);

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

        return new DashboardStatsDto(total, physicalStorage, logicalStorage, bytesSaved, recent, recentActivity, notifications);
    }

    public async Task<DocumentMaturityScoreDto> GetMaturityScoreAsync(CancellationToken ct = default)
    {
        var docs = await context.Documents
            .AsNoTracking()
            .Include(d => d.Permissions)
            .Where(d => d.Status != DocumentStatus.Deleted)
            .ToListAsync(ct);

        var total = docs.Count;
        var totalUsers = await context.Users.CountAsync(u => u.IsActive, ct);
        var usersWithRoles = await context.UserRoles.Select(ur => ur.UserId).Distinct().CountAsync(ct);
        var unresolvedAlerts = await context.AntivirusAlerts.CountAsync(a => !a.IsResolved, ct);
        var recentIntegrityChecks = await context.AuditLogs.CountAsync(
            a => a.Action == AuditAction.IntegrityCheck && a.Timestamp >= DateTime.UtcNow.AddDays(-90), ct);

        // —— Organisation ——
        var categorized = docs.Count(d => !string.IsNullOrWhiteSpace(d.Category));
        var withMetadata = docs.Count(d =>
            !string.IsNullOrWhiteSpace(d.Description) && !string.IsNullOrWhiteSpace(d.Category));
        var wellOrganized = docs.Count(d =>
            !string.IsNullOrWhiteSpace(d.Category) &&
            !string.Equals(d.Category.Trim(), "General", StringComparison.OrdinalIgnoreCase));

        var orgCategorizedPct = Pct(categorized, total);
        var orgMetadataPct = Pct(withMetadata, total);
        var orgOrganizedPct = Pct(wellOrganized, total);
        var organizationScore = Weighted(orgCategorizedPct, 40, orgMetadataPct, 35, orgOrganizedPct, 25);

        // —— Sécurité ——
        var encrypted = docs.Count(d => !string.IsNullOrWhiteSpace(d.Sha256Hash) && d.SizeBytes > 0);
        var avClean = docs.Count(d => d.LastScanResult == AntivirusScanResult.Clean);
        var hashed = docs.Count(d => !string.IsNullOrWhiteSpace(d.Sha256Hash) && d.Sha256Hash.Length >= 64);
        var permissionProtected = docs.Count(d =>
            d.Visibility == DocumentVisibility.Private ||
            d.Permissions.Any(p => p.ExpiresAt == null || p.ExpiresAt > DateTime.UtcNow));
        var rbacCoverage = totalUsers == 0 ? 100 : Pct(usersWithRoles, totalUsers);

        var secEncryptedPct = Pct(encrypted, total);
        var secAvPct = Pct(avClean, total);
        var secHashPct = Pct(hashed, total);
        var secPermPct = Pct(permissionProtected, total);
        var securityScore = Weighted(
            secEncryptedPct, 20,
            secAvPct, 30,
            secHashPct, 20,
            secPermPct, 20,
            rbacCoverage, 10);

        if (unresolvedAlerts > 0)
            securityScore = Math.Max(0, securityScore - Math.Min(15, unresolvedAlerts * 3));

        // —— Collaboration ——
        var sharedDocs = docs.Count(d =>
            d.Visibility == DocumentVisibility.Shared ||
            d.Visibility == DocumentVisibility.Public ||
            d.Permissions.Any());
        var withCollaborators = docs.Count(d =>
            d.Permissions.Any(p => p.ExpiresAt == null || p.ExpiresAt > DateTime.UtcNow));
        var activeCollaborators = docs
            .SelectMany(d => d.Permissions)
            .Where(p => p.ExpiresAt == null || p.ExpiresAt > DateTime.UtcNow)
            .Select(p => p.UserId)
            .Distinct()
            .Count();
        var collabSharePct = Pct(sharedDocs, total);
        var collabCollabPct = Pct(withCollaborators, total);
        var collabUsersPct = totalUsers == 0 ? 0 : Pct(activeCollaborators, totalUsers);
        var collaborationScore = Weighted(collabSharePct, 40, collabCollabPct, 35, collabUsersPct, 25);

        var overall = (int)Math.Round((organizationScore + securityScore + collaborationScore) / 3.0);

        var organization = new MaturityPillarDto(
            "organization",
            "Organisation documentaire",
            organizationScore,
            LevelOf(organizationScore),
            [
                new MaturityMetricDto("categorized", categorized, total, orgCategorizedPct),
                new MaturityMetricDto("metadata", withMetadata, total, orgMetadataPct),
                new MaturityMetricDto("organized", wellOrganized, total, orgOrganizedPct)
            ]);

        var security = new MaturityPillarDto(
            "security",
            "Sécurité",
            securityScore,
            LevelOf(securityScore),
            [
                new MaturityMetricDto("encrypted", encrypted, total, secEncryptedPct),
                new MaturityMetricDto("antivirusClean", avClean, total, secAvPct),
                new MaturityMetricDto("integrityHash", hashed, total, secHashPct),
                new MaturityMetricDto("permissions", permissionProtected, total, secPermPct),
                new MaturityMetricDto("rbac", usersWithRoles, totalUsers, rbacCoverage)
            ]);

        var collaboration = new MaturityPillarDto(
            "collaboration",
            "Collaboration",
            collaborationScore,
            LevelOf(collaborationScore),
            [
                new MaturityMetricDto("shared", sharedDocs, total, collabSharePct),
                new MaturityMetricDto("collaborators", withCollaborators, total, collabCollabPct),
                new MaturityMetricDto("activeUsers", activeCollaborators, totalUsers, collabUsersPct)
            ]);

        var recommendations = BuildRecommendations(
            total, categorized, withMetadata, withCollaborators, avClean,
            recentIntegrityChecks, unresolvedAlerts, sharedDocs);

        return new DocumentMaturityScoreDto(
            overall,
            LevelOf(overall),
            organization,
            security,
            collaboration,
            recommendations,
            total,
            DateTime.UtcNow);
    }

    private static List<MaturityRecommendationDto> BuildRecommendations(
        int total,
        int categorized,
        int withMetadata,
        int withCollaborators,
        int avClean,
        int recentIntegrityChecks,
        int unresolvedAlerts,
        int sharedDocs)
    {
        var list = new List<MaturityRecommendationDto>();
        if (total == 0)
        {
            list.Add(new MaturityRecommendationDto(
                "empty",
                "info",
                "No documents yet. Upload your first secured document to start measuring maturity.",
                "Add Document",
                "/documents/upload",
                null));
            return list;
        }

        var noCategoryPct = Pct(total - categorized, total);
        if (noCategoryPct > 0)
        {
            list.Add(new MaturityRecommendationDto(
                "no-category",
                noCategoryPct >= 20 ? "warning" : "info",
                $"{noCategoryPct}% of your documents have no category. Consider organizing them.",
                "View Details",
                "/categories",
                noCategoryPct));
        }

        var incompleteMetaPct = Pct(total - withMetadata, total);
        if (incompleteMetaPct > 0)
        {
            list.Add(new MaturityRecommendationDto(
                "incomplete-metadata",
                incompleteMetaPct >= 20 ? "warning" : "info",
                $"{incompleteMetaPct}% of documents have incomplete metadata.",
                "View Details",
                "/documents",
                incompleteMetaPct));
        }

        var noCollabPct = Pct(total - withCollaborators, total);
        if (noCollabPct > 0)
        {
            list.Add(new MaturityRecommendationDto(
                "no-collaborators",
                noCollabPct >= 40 ? "warning" : "info",
                $"{noCollabPct}% of documents have no collaborators.",
                "View Details",
                "/shared",
                noCollabPct));
        }

        var notCleanPct = Pct(total - avClean, total);
        if (notCleanPct > 0)
        {
            list.Add(new MaturityRecommendationDto(
                "antivirus",
                notCleanPct >= 30 ? "warning" : "info",
                $"{notCleanPct}% of documents were not confirmed clean by antivirus (skipped, error, or pending).",
                "View Details",
                "/admin/config",
                notCleanPct));
        }

        if (recentIntegrityChecks == 0 && total > 0)
        {
            list.Add(new MaturityRecommendationDto(
                "integrity",
                "warning",
                "Some documents have not been integrity-checked recently.",
                "View Details",
                "/documents",
                null));
        }

        if (unresolvedAlerts > 0)
        {
            list.Add(new MaturityRecommendationDto(
                "alerts",
                "critical",
                $"{unresolvedAlerts} unresolved antivirus alert(s) require attention.",
                "View Details",
                "/admin/config",
                null));
        }

        var unsharedPct = Pct(total - sharedDocs, total);
        if (unsharedPct >= 80 && total >= 5)
        {
            list.Add(new MaturityRecommendationDto(
                "low-sharing",
                "info",
                "Collaboration is low: few documents are shared with other users.",
                "View Details",
                "/documents",
                unsharedPct));
        }

        return list
            .OrderByDescending(r => r.Severity switch
            {
                "critical" => 3,
                "warning" => 2,
                _ => 1
            })
            .ThenByDescending(r => r.Percent ?? 0)
            .Take(6)
            .ToList();
    }

    private static int Pct(int part, int whole) =>
        whole <= 0 ? 0 : (int)Math.Round(100.0 * part / whole);

    private static int Weighted(params int[] valuesAndWeights)
    {
        var sum = 0;
        var weightSum = 0;
        for (var i = 0; i + 1 < valuesAndWeights.Length; i += 2)
        {
            sum += valuesAndWeights[i] * valuesAndWeights[i + 1];
            weightSum += valuesAndWeights[i + 1];
        }
        return weightSum == 0 ? 0 : (int)Math.Round(sum / (double)weightSum);
    }

    private static string LevelOf(int score) =>
        score >= 85 ? "Excellent" : score >= 70 ? "Good" : "NeedsImprovement";
}
