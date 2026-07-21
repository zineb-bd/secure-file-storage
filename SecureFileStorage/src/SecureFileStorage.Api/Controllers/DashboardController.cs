using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Infrastructure.Services;

namespace SecureFileStorage.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly DashboardService _dashboard;
    private readonly ICurrentUserService _currentUser;

    public DashboardController(DashboardService dashboard, ICurrentUserService currentUser)
    {
        _dashboard = dashboard;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<DashboardStatsDto>> GetStats(CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return Ok(await _dashboard.GetStatsAsync(_currentUser.UserId.Value, ct));
    }
}
