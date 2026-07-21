using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using Swashbuckle.AspNetCore.Annotations;

namespace SecureFileStorage.Api.Controllers.Admin;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
[Tags("Administration — Utilisateurs")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IAuthService _authService;

    public UsersController(IUserService userService, IAuthService authService)
    {
        _userService = userService;
        _authService = authService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Lister les utilisateurs", Description = "Retourne tous les comptes utilisateurs.")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetAll(CancellationToken ct) =>
        Ok(await _userService.GetAllAsync(ct));

    [HttpGet("{id:guid}")]
    [SwaggerOperation(Summary = "Détails d'un utilisateur", Description = "Affiche les informations d'un utilisateur.")]
    public async Task<ActionResult<UserDto>> GetById(Guid id, CancellationToken ct)
    {
        var user = await _userService.GetByIdAsync(id, ct);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost]
    [SwaggerOperation(Summary = "Créer un utilisateur", Description = "Ajoute un nouvel utilisateur au système.")]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        try
        {
            var user = await _userService.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = user.Id }, user);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [SwaggerOperation(Summary = "Modifier un utilisateur", Description = "Met à jour le prénom, nom ou statut actif.")]
    public async Task<ActionResult<UserDto>> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        var user = await _userService.UpdateAsync(id, request, ct);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost("{id:guid}/deactivate")]
    [SwaggerOperation(Summary = "Désactiver un utilisateur", Description = "Désactive le compte sans le supprimer.")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct) =>
        await _userService.DeactivateAsync(id, ct) ? NoContent() : NotFound();

    [HttpDelete("{id:guid}")]
    [SwaggerOperation(Summary = "Supprimer un utilisateur", Description = "Supprime définitivement un compte.")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        await _userService.DeleteAsync(id, ct) ? NoContent() : NotFound();

    [HttpPost("{id:guid}/reset-password")]
    [SwaggerOperation(Summary = "Réinitialiser le mot de passe", Description = "Définit un nouveau mot de passe pour l'utilisateur.")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest request, CancellationToken ct) =>
        await _authService.ResetPasswordAsync(id, request.NewPassword, ct) ? NoContent() : NotFound();
}

[ApiController]
[Route("api/admin/roles")]
[Authorize(Roles = "Admin")]
[Tags("Administration — Rôles")]
public class RolesController : ControllerBase
{
    private readonly IRoleService _roleService;

    public RolesController(IRoleService roleService) => _roleService = roleService;

    [HttpGet]
    [SwaggerOperation(Summary = "Lister les rôles", Description = "Retourne tous les rôles (Admin, User, Manager).")]
    public async Task<ActionResult<IEnumerable<RoleDto>>> GetAll(CancellationToken ct) =>
        Ok(await _roleService.GetAllAsync(ct));

    [HttpPost]
    [SwaggerOperation(Summary = "Créer un rôle", Description = "Ajoute un nouveau rôle au système.")]
    public async Task<ActionResult<RoleDto>> Create([FromBody] CreateRoleRequest request, CancellationToken ct)
    {
        var role = await _roleService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetAll), role);
    }

    [HttpPut("{id:guid}")]
    [SwaggerOperation(Summary = "Modifier un rôle", Description = "Met à jour le nom ou la description d'un rôle.")]
    public async Task<ActionResult<RoleDto>> Update(Guid id, [FromBody] UpdateRoleRequest request, CancellationToken ct)
    {
        var role = await _roleService.UpdateAsync(id, request, ct);
        return role is null ? NotFound() : Ok(role);
    }

    [HttpDelete("{id:guid}")]
    [SwaggerOperation(Summary = "Supprimer un rôle", Description = "Supprime un rôle du système.")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        await _roleService.DeleteAsync(id, ct) ? NoContent() : NotFound();

    [HttpPost("assign")]
    [SwaggerOperation(Summary = "Affecter un rôle", Description = "Associe un rôle à un utilisateur.")]
    public async Task<IActionResult> AssignRole([FromBody] AssignRoleRequest request, CancellationToken ct) =>
        await _roleService.AssignRoleAsync(request, ct) ? NoContent() : BadRequest();
}

[ApiController]
[Route("api/admin/storage")]
[Authorize(Roles = "Admin")]
[Tags("Administration — Stockage")]
public class StorageController : ControllerBase
{
    private readonly IStorageConfigService _storageConfigService;

    public StorageController(IStorageConfigService storageConfigService) =>
        _storageConfigService = storageConfigService;

    [HttpGet]
    [SwaggerOperation(Summary = "Voir la configuration stockage", Description = "Affiche où les fichiers sont stockés (local, S3, NAS).")]
    public async Task<ActionResult<StorageConfigDto>> Get(CancellationToken ct)
    {
        var config = await _storageConfigService.GetActiveAsync(ct);
        return config is null ? NotFound() : Ok(config);
    }

    [HttpPut]
    [SwaggerOperation(Summary = "Configurer le stockage", Description = "Modifie le type de stockage et les paramètres.")]
    public async Task<ActionResult<StorageConfigDto>> Update([FromBody] UpdateStorageConfigRequest request, CancellationToken ct) =>
        Ok(await _storageConfigService.UpdateAsync(request, ct));
}

[ApiController]
[Route("api/admin/audit")]
[Authorize(Roles = "Admin")]
[Tags("Administration — Traçabilité documents")]
public class AuditController : ControllerBase
{
    private readonly IAuditService _auditService;

    public AuditController(IAuditService auditService) => _auditService = auditService;

    [HttpGet]
    [SwaggerOperation(Summary = "Traçabilité des documents", Description = "Liste les opérations sur les documents (téléversement, consultation, téléchargement, modification, archivage, etc.).")]
    public async Task<ActionResult<PagedResult<AuditLogDto>>> Search([FromQuery] AuditSearchRequest request, CancellationToken ct) =>
        Ok(await _auditService.SearchAsync(request, ct));

    [HttpGet("export")]
    [SwaggerOperation(Summary = "Exporter la traçabilité", Description = "Télécharge l'historique des opérations documentaires au format CSV.")]
    public async Task<IActionResult> Export([FromQuery] AuditSearchRequest request, CancellationToken ct)
    {
        var csv = await _auditService.ExportAsync(request, ct);
        return File(csv, "text/csv", $"tracabilite-documents-{DateTime.UtcNow:yyyyMMdd}.csv");
    }
}

[ApiController]
[Route("api/admin/security")]
[Authorize(Roles = "Admin")]
[Tags("Administration — Sécurité")]
public class SecurityController : ControllerBase
{
    private readonly IEncryptionService _encryptionService;
    private readonly IAntivirusService _antivirusService;

    public SecurityController(IEncryptionService encryptionService, IAntivirusService antivirusService)
    {
        _encryptionService = encryptionService;
        _antivirusService = antivirusService;
    }

    [HttpPost("rotate-key")]
    [SwaggerOperation(Summary = "Rotation des clés de chiffrement", Description = "Génère une nouvelle clé maître de chiffrement.")]
    public async Task<ActionResult<RotateKeyResponse>> RotateKey(CancellationToken ct)
    {
        var keyId = await _encryptionService.RotateMasterKeyAsync(ct);
        return Ok(new RotateKeyResponse(keyId, DateTime.UtcNow));
    }

    [HttpGet("antivirus-alerts")]
    [SwaggerOperation(Summary = "Alertes antivirus", Description = "Liste les fichiers infectés détectés.")]
    public async Task<ActionResult<IEnumerable<AntivirusAlertDto>>> GetAntivirusAlerts(CancellationToken ct) =>
        Ok(await _antivirusService.GetAlertsAsync(true, ct));
}
