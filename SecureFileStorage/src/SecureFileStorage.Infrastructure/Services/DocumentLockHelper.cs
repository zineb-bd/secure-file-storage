using SecureFileStorage.Domain.Entities;

namespace SecureFileStorage.Infrastructure.Services;

public static class DocumentLockHelper
{
    public static bool IsActiveLock(Document doc) =>
        doc.LockedById.HasValue &&
        (doc.LockExpiresAt is null || doc.LockExpiresAt > DateTime.UtcNow);

    public static bool IsLockedByOther(Document doc, Guid userId) =>
        IsActiveLock(doc) && doc.LockedById != userId;

    public static bool IsLockedByUser(Document doc, Guid userId) =>
        IsActiveLock(doc) && doc.LockedById == userId;

    public static void ClearIfExpired(Document doc)
    {
        if (!doc.LockedById.HasValue) return;
        if (doc.LockExpiresAt.HasValue && doc.LockExpiresAt <= DateTime.UtcNow)
        {
            doc.LockedById = null;
            doc.LockedAt = null;
            doc.LockExpiresAt = null;
        }
    }

    public static void ReleaseLock(Document doc)
    {
        doc.LockedById = null;
        doc.LockedAt = null;
        doc.LockExpiresAt = null;
    }

    public static DateTime ResolveExpiresAt(int? expiresInHours)
    {
        var hours = expiresInHours is > 0 and <= 168 ? expiresInHours.Value : 8;
        return DateTime.UtcNow.AddHours(hours);
    }
}
