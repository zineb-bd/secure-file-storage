using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using Swashbuckle.AspNetCore.Annotations;

namespace SecureFileStorage.Api.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
[Tags("Gestion des documents")]
public class DocumentsController : ControllerBase
{
    private readonly IDocumentService _documentService;
    private readonly ICurrentUserService _currentUser;

    public DocumentsController(IDocumentService documentService, ICurrentUserService currentUser)
    {
        _documentService = documentService;
        _currentUser = currentUser;
    }

    [HttpPost]
    [RequestSizeLimit(100_000_000)]
    [SwaggerOperation(Summary = "Téléverser un document", Description = "Envoie un fichier. Il sera chiffré et stocké de manière sécurisée.")]
    public async Task<ActionResult<DocumentDto>> Upload(
        IFormFile file,
        [FromForm] string? category,
        [FromForm] string? description,
        CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        if (file.Length == 0) return BadRequest(new { message = "Fichier vide." });

        await using var stream = file.OpenReadStream();
        var result = await _documentService.UploadAsync(
            stream, file.FileName, file.ContentType, _currentUser.UserId.Value,
            new DocumentUploadRequest(category, description, null, null), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Rechercher des documents", Description = "Recherche par nom, catégorie, type ou date.")]
    public async Task<ActionResult<PagedResult<DocumentDto>>> Search([FromQuery] DocumentSearchRequest request, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return Ok(await _documentService.SearchAsync(request, _currentUser.UserId.Value, ct));
    }

    [HttpGet("{id:guid}")]
    [SwaggerOperation(Summary = "Détails d'un document", Description = "Affiche les informations d'un document (nom, taille, propriétaire, etc.).")]
    public async Task<ActionResult<DocumentDto>> GetById(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        var doc = await _documentService.GetByIdAsync(id, _currentUser.UserId.Value, ct);
        return doc is null ? NotFound() : Ok(doc);
    }

    [HttpGet("{id:guid}/download")]
    [SwaggerOperation(Summary = "Télécharger un document", Description = "Télécharge le fichier déchiffré si vous avez les droits.")]
    public async Task<IActionResult> Download(Guid id, [FromQuery] int? version, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        var result = await _documentService.DownloadAsync(id, _currentUser.UserId.Value, version, ct);
        if (result is null) return NotFound();
        return File(result.Value.Stream, result.Value.ContentType, result.Value.FileName);
    }

    [HttpGet("{id:guid}/preview")]
    [SwaggerOperation(Summary = "Prévisualiser un document", Description = "Affiche le document dans le navigateur (PDF, images, Office).")]
    public async Task<IActionResult> Preview(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        var result = await _documentService.PreviewAsync(id, _currentUser.UserId.Value, ct);
        if (result is null) return NotFound(new { message = "Prévisualisation non disponible." });
        return File(result.Value.Stream, result.Value.ContentType);
    }

    [HttpGet("{id:guid}/versions")]
    [SwaggerOperation(Summary = "Historique des versions", Description = "Liste toutes les versions d'un document.")]
    public async Task<ActionResult<IEnumerable<DocumentVersionDto>>> GetVersions(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return Ok(await _documentService.GetVersionsAsync(id, _currentUser.UserId.Value, ct));
    }

    [HttpPut("{id:guid}")]
    [RequestSizeLimit(100_000_000)]
    [SwaggerOperation(Summary = "Mettre à jour un document", Description = "Crée une nouvelle version du document.")]
    public async Task<ActionResult<DocumentDto>> Update(
        Guid id, IFormFile file, [FromForm] string? changeComment, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        await using var stream = file.OpenReadStream();
        var result = await _documentService.UpdateAsync(
            id, stream, file.FileName, file.ContentType, _currentUser.UserId.Value, changeComment, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{id:guid}/archive")]
    [SwaggerOperation(Summary = "Archiver un document", Description = "Met le document en archive (non supprimé).")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return await _documentService.ArchiveAsync(id, _currentUser.UserId.Value, ct)
            ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/restore")]
    [SwaggerOperation(Summary = "Restaurer un document", Description = "Réactive un document archivé ou supprimé.")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return await _documentService.RestoreAsync(id, _currentUser.UserId.Value, ct)
            ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/trash")]
    [SwaggerOperation(Summary = "Déplacer dans la corbeille", Description = "Suppression logique — le document peut être restauré.")]
    public async Task<IActionResult> MoveToTrash(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return await _documentService.MoveToTrashAsync(id, _currentUser.UserId.Value, ct)
            ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    [SwaggerOperation(Summary = "Supprimer un document", Description = "Déplace le document dans la corbeille.")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return await _documentService.SoftDeleteAsync(id, _currentUser.UserId.Value, ct)
            ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/permissions")]
    [SwaggerOperation(Summary = "Accorder une permission", Description = "Donne à un utilisateur le droit de lire/écrire un document.")]
    public async Task<IActionResult> GrantPermission(Guid id, [FromBody] GrantPermissionRequest request, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return await _documentService.GrantPermissionAsync(id, request, _currentUser.UserId.Value, ct)
            ? NoContent() : BadRequest();
    }

    [HttpDelete("{id:guid}/permissions/{userId:guid}")]
    [SwaggerOperation(Summary = "Retirer une permission", Description = "Révoque l'accès d'un utilisateur à un document.")]
    public async Task<IActionResult> RevokePermission(Guid id, Guid userId, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return await _documentService.RevokePermissionAsync(id, userId, _currentUser.UserId.Value, ct)
            ? NoContent() : NotFound();
    }

    [HttpGet("{id:guid}/detail")]
    [SwaggerOperation(Summary = "Métadonnées complètes", Description = "Affiche toutes les métadonnées du document.")]
    public async Task<ActionResult<DocumentDetailDto>> GetDetail(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        var doc = await _documentService.GetDetailAsync(id, _currentUser.UserId.Value, ct);
        return doc is null ? NotFound() : Ok(doc);
    }

    [HttpPut("{id:guid}/metadata")]
    [SwaggerOperation(Summary = "Modifier les métadonnées", Description = "Change catégorie, description ou propriétaire (admin).")]
    public async Task<ActionResult<DocumentDto>> UpdateMetadata(Guid id, [FromBody] UpdateMetadataRequest request, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        var isAdmin = _currentUser.IsInRole("Admin");
        var doc = await _documentService.UpdateMetadataAsync(id, request, _currentUser.UserId.Value, isAdmin, ct);
        return doc is null ? NotFound() : Ok(doc);
    }

    [HttpPost("{id:guid}/versions/{version}/restore")]
    [SwaggerOperation(Summary = "Restaurer une version", Description = "Crée une nouvelle version à partir d'une ancienne.")]
    public async Task<ActionResult<DocumentDto>> RestoreVersion(Guid id, int version, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        var doc = await _documentService.RestoreVersionAsync(id, version, _currentUser.UserId.Value, ct);
        return doc is null ? NotFound() : Ok(doc);
    }

    [HttpDelete("{id:guid}/permanent")]
    [Authorize(Roles = "Admin")]
    [SwaggerOperation(Summary = "Suppression définitive", Description = "Supprime définitivement le document (admin).")]
    public async Task<IActionResult> PermanentDelete(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return await _documentService.PermanentDeleteAsync(id, _currentUser.UserId.Value, ct)
            ? NoContent() : NotFound();
    }

    [HttpGet("{id:guid}/integrity")]
    [SwaggerOperation(Summary = "Vérifier l'intégrité", Description = "Contrôle que le fichier n'a pas été modifié (SHA-256).")]
    public async Task<ActionResult<IntegrityCheckResult>> VerifyIntegrity(Guid id, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        try
        {
            return Ok(await _documentService.VerifyIntegrityAsync(id, _currentUser.UserId.Value, ct));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
