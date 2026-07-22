using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecureFileStorage.Application.Interfaces;
using Swashbuckle.AspNetCore.Annotations;

namespace SecureFileStorage.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
[Tags("Utilisateurs")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService) => _userService = userService;

    [HttpGet("directory")]
    [SwaggerOperation(Summary = "Annuaire des utilisateurs", Description = "Liste les utilisateurs actifs pour le partage à l'upload.")]
    public async Task<IActionResult> GetDirectory(CancellationToken ct) =>
        Ok(await _userService.GetDirectoryAsync(ct));
}
