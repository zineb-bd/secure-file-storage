using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using Swashbuckle.AspNetCore.Annotations;

namespace SecureFileStorage.Api.Controllers;

[ApiController]
[Route("api/trash")]
[Authorize]
[Tags("Corbeille")]
public class TrashController : ControllerBase
{
    private readonly IDocumentService _documentService;
    private readonly ICurrentUserService _currentUser;

    public TrashController(IDocumentService documentService, ICurrentUserService currentUser)
    {
        _documentService = documentService;
        _currentUser = currentUser;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Lister la corbeille", Description = "Affiche les documents supprimés accessibles à l'utilisateur.")]
    public async Task<ActionResult<PagedResult<DocumentDto>>> GetTrash([FromQuery] DocumentSearchRequest request, CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return Ok(await _documentService.GetTrashAsync(request, _currentUser.UserId.Value, ct));
    }

    [HttpDelete]
    [SwaggerOperation(Summary = "Vider la corbeille", Description = "Supprime définitivement tous les documents de la corbeille.")]
    public async Task<ActionResult<EmptyTrashResult>> EmptyTrash(CancellationToken ct)
    {
        if (_currentUser.UserId is null) return Unauthorized();
        return Ok(await _documentService.EmptyTrashAsync(_currentUser.UserId.Value, ct));
    }
}
