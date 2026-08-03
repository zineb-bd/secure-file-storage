using Microsoft.EntityFrameworkCore;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Infrastructure.Persistence;

namespace SecureFileStorage.Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly IUnitOfWork _unitOfWork;

    public NotificationService(ApplicationDbContext context, IUnitOfWork unitOfWork)
    {
        _context = context;
        _unitOfWork = unitOfWork;
    }

    public async Task NotifyDocumentSharedAsync(
        Guid recipientUserId,
        Guid actorUserId,
        Guid documentId,
        string documentName,
        string accessLevel,
        CancellationToken ct = default)
    {
        if (recipientUserId == actorUserId) return;

        var actorName = await ResolveActorNameAsync(actorUserId, ct);
        var levelLabel = string.IsNullOrWhiteSpace(accessLevel) ? "lecture" : accessLevel.ToLowerInvariant() switch
        {
            "write" or "écriture" or "ecriture" => "écriture",
            _ => "lecture"
        };

        await _context.UserNotifications.AddAsync(new UserNotification
        {
            Id = Guid.NewGuid(),
            UserId = recipientUserId,
            ActorId = actorUserId,
            Type = "DocumentShared",
            DocumentId = documentId,
            Message = $"{actorName} a partagé « {documentName} » avec vous ({levelLabel}).",
            CreatedAt = DateTime.UtcNow
        }, ct);

        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task NotifyDocumentSharedManyAsync(
        IEnumerable<Guid> recipientUserIds,
        Guid actorUserId,
        Guid documentId,
        string documentName,
        CancellationToken ct = default)
    {
        var recipients = recipientUserIds
            .Where(id => id != actorUserId)
            .Distinct()
            .ToList();
        if (recipients.Count == 0) return;

        var actorName = await ResolveActorNameAsync(actorUserId, ct);
        var now = DateTime.UtcNow;

        foreach (var recipientId in recipients)
        {
            await _context.UserNotifications.AddAsync(new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = recipientId,
                ActorId = actorUserId,
                Type = "DocumentShared",
                DocumentId = documentId,
                Message = $"{actorName} vous a invité à collaborer sur « {documentName} ».",
                CreatedAt = now
            }, ct);
        }

        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<NotificationListDto> GetForUserAsync(Guid userId, int take = 40, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 100);
        var unreadCount = await GetUnreadCountAsync(userId, ct);

        var items = await _context.UserNotifications
            .AsNoTracking()
            .Include(n => n.Actor)
            .Include(n => n.Document)
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .Select(n => new UserNotificationDto(
                n.Id,
                n.Type,
                n.Message,
                n.DocumentId,
                n.Document != null ? n.Document.FileName : null,
                n.ActorId,
                n.Actor != null ? (n.Actor.FirstName + " " + n.Actor.LastName).Trim() : null,
                n.IsRead,
                n.CreatedAt))
            .ToListAsync(ct);

        return new NotificationListDto(items, unreadCount);
    }

    public Task<int> GetUnreadCountAsync(Guid userId, CancellationToken ct = default) =>
        _context.UserNotifications.CountAsync(n => n.UserId == userId && !n.IsRead, ct);

    public async Task<bool> MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken ct = default)
    {
        var notif = await _context.UserNotifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId, ct);
        if (notif is null) return false;
        if (!notif.IsRead)
        {
            notif.IsRead = true;
            await _unitOfWork.SaveChangesAsync(ct);
        }
        return true;
    }

    public async Task MarkAllAsReadAsync(Guid userId, CancellationToken ct = default)
    {
        var unread = await _context.UserNotifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync(ct);
        if (unread.Count == 0) return;

        foreach (var n in unread)
            n.IsRead = true;

        await _unitOfWork.SaveChangesAsync(ct);
    }

    private async Task<string> ResolveActorNameAsync(Guid actorUserId, CancellationToken ct)
    {
        var actor = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == actorUserId, ct);
        if (actor is null) return "Un collaborateur";
        var name = $"{actor.FirstName} {actor.LastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? actor.Email : name;
    }
}
