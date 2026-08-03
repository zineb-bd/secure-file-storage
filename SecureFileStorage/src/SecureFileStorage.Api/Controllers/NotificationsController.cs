using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using Swashbuckle.AspNetCore.Annotations;

namespace SecureFileStorage.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
[Tags("Notifications")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notifications;
    private readonly ICurrentUserService _currentUser;

    public NotificationsController(INotificationService notifications, ICurrentUserService currentUser)
    {
        _notifications = notifications;
        _currentUser = currentUser;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Lister mes notifications", Description = "Retourne les notifications de l'utilisateur connecté.")]
    public async Task<ActionResult<NotificationListDto>> GetMine([FromQuery] int take = 40, CancellationToken ct = default)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return Ok(await _notifications.GetForUserAsync(_currentUser.UserId.Value, take, ct));
    }

    [HttpGet("unread-count")]
    [SwaggerOperation(Summary = "Nombre de notifications non lues")]
    public async Task<ActionResult<object>> GetUnreadCount(CancellationToken ct = default)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        var count = await _notifications.GetUnreadCountAsync(_currentUser.UserId.Value, ct);
        return Ok(new { count });
    }

    [HttpPost("{id:guid}/read")]
    [SwaggerOperation(Summary = "Marquer une notification comme lue")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct = default)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        var ok = await _notifications.MarkAsReadAsync(_currentUser.UserId.Value, id, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("read-all")]
    [SwaggerOperation(Summary = "Marquer toutes les notifications comme lues")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct = default)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        await _notifications.MarkAllAsReadAsync(_currentUser.UserId.Value, ct);
        return NoContent();
    }
}
