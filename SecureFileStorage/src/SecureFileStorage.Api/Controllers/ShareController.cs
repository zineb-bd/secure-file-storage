using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using Swashbuckle.AspNetCore.Annotations;

namespace SecureFileStorage.Api.Controllers;

[ApiController]
[Route("api/share")]
[AllowAnonymous]
[Tags("Partage sécurisé")]
public class ShareController : ControllerBase
{
    private readonly IDocumentService _documentService;

    public ShareController(IDocumentService documentService) => _documentService = documentService;

    [HttpGet("info")]
    [SwaggerOperation(Summary = "Informations d'un partage (query)", Description = "Consulte les métadonnées via ?token=… — accessible sans authentification.")]
    public async Task<ActionResult<SharedDocumentInfoDto>> GetInfoByQuery([FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Jeton manquant." });
        var info = await _documentService.GetSharedInfoAsync(token.Trim(), ct);
        return info is null ? NotFound(new { message = "Lien invalide, expiré ou révoqué." }) : Ok(info);
    }

    [HttpGet("preview")]
    [SwaggerOperation(Summary = "Prévisualiser via lien (query)")]
    public async Task<IActionResult> PreviewByQuery([FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Jeton manquant." });
        var result = await _documentService.PreviewByTokenAsync(token.Trim(), ct);
        if (result is null)
            return NotFound(new { message = "Prévisualisation indisponible pour ce lien." });
        return File(result.Value.Stream, result.Value.ContentType);
    }

    [HttpGet("download")]
    [SwaggerOperation(Summary = "Télécharger via lien (query)")]
    public async Task<IActionResult> DownloadByQuery([FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Jeton manquant." });
        var result = await _documentService.DownloadByTokenAsync(token.Trim(), ct);
        if (result is null)
            return NotFound(new { message = "Téléchargement non autorisé pour ce lien." });
        return File(result.Value.Stream, result.Value.ContentType, result.Value.FileName);
    }

    [HttpGet("{token}/info")]
    [SwaggerOperation(Summary = "Informations d'un partage", Description = "Consulte les métadonnées d'un document partagé via lien sécurisé.")]
    public async Task<ActionResult<SharedDocumentInfoDto>> GetInfo(string token, CancellationToken ct)
    {
        var info = await _documentService.GetSharedInfoAsync(token, ct);
        return info is null ? NotFound(new { message = "Lien invalide, expiré ou révoqué." }) : Ok(info);
    }

    [HttpGet("{token}/preview")]
    [SwaggerOperation(Summary = "Prévisualiser via lien", Description = "Affiche le document si le lien autorise au minimum la lecture.")]
    public async Task<IActionResult> Preview(string token, CancellationToken ct)
    {
        var result = await _documentService.PreviewByTokenAsync(token, ct);
        if (result is null)
            return NotFound(new { message = "Prévisualisation indisponible pour ce lien." });
        return File(result.Value.Stream, result.Value.ContentType);
    }

    [HttpGet("{token}/download")]
    [SwaggerOperation(Summary = "Télécharger via lien", Description = "Télécharge le document si le lien autorise le téléchargement.")]
    public async Task<IActionResult> Download(string token, CancellationToken ct)
    {
        var result = await _documentService.DownloadByTokenAsync(token, ct);
        if (result is null)
            return NotFound(new { message = "Téléchargement non autorisé pour ce lien." });
        return File(result.Value.Stream, result.Value.ContentType, result.Value.FileName);
    }
}
