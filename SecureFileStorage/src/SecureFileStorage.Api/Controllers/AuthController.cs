using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using Swashbuckle.AspNetCore.Annotations;

namespace SecureFileStorage.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Tags("Authentification")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService) => _authService = authService;

    [HttpPost("login")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Connexion", Description = "Connectez-vous avec email et mot de passe pour obtenir un jeton d'accès.")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var result = await _authService.LoginAsync(request, ct);
        if (result is null)
            return Unauthorized(new { message = "Email ou mot de passe incorrect." });

        return Ok(result);
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "Inscription (désactivée)", Description = "L'auto-inscription est désactivée. Les comptes sont créés par un administrateur.")]
    public ActionResult Register([FromBody] RegisterRequest _)
    {
        return StatusCode(403, new
        {
            message = "La création de compte est désactivée. Contactez un administrateur."
        });
    }

    [HttpPost("logout")]
    [Authorize]
    [SwaggerOperation(Summary = "Déconnexion", Description = "Termine la session côté client (suppression du jeton JWT).")]
    public IActionResult Logout() =>
        Ok(new { message = "Déconnexion effectuée." });

    [HttpGet("me")]
    [Authorize]
    [SwaggerOperation(Summary = "Mon profil", Description = "Consulte le profil de l'utilisateur connecté.")]
    public async Task<ActionResult<UserDto>> GetProfile(CancellationToken ct)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userId, out var id)) return Unauthorized();
        var profile = await _authService.GetProfileAsync(id, ct);
        return profile is null ? NotFound() : Ok(profile);
    }

    [HttpPut("me")]
    [Authorize]
    [SwaggerOperation(Summary = "Modifier mon profil", Description = "Met à jour le prénom et le nom.")]
    public async Task<ActionResult<UserDto>> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken ct)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userId, out var id)) return Unauthorized();
        var profile = await _authService.UpdateProfileAsync(id, request, ct);
        return profile is null ? NotFound() : Ok(profile);
    }

    [HttpPost("me/change-password")]
    [Authorize]
    [SwaggerOperation(Summary = "Changer mon mot de passe", Description = "Modifie le mot de passe de l'utilisateur connecté.")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userId, out var id)) return Unauthorized();
        return await _authService.ChangePasswordAsync(id, request, ct)
            ? Ok(new { message = "Mot de passe modifié." })
            : BadRequest(new { message = "Mot de passe actuel incorrect." });
    }
}
