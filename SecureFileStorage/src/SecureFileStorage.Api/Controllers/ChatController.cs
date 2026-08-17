using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;

namespace SecureFileStorage.Api.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IChatbotService _chatbot;
    private readonly IChatbotAnalyticsService _analytics;

    public ChatController(IChatbotService chatbot, IChatbotAnalyticsService analytics)
    {
        _chatbot = chatbot;
        _analytics = analytics;
    }

    [HttpPost]
    public async Task<ActionResult<ChatResponse>> Ask([FromBody] ChatRequest request, CancellationToken ct)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "Le message est requis." });

        if (request.Message.Length > 2000)
            return BadRequest(new { message = "Le message est trop long (max 2000 caractères)." });

        var response = await _chatbot.AskAsync(request, ct);
        // Enregistre uniquement un compteur agrégé (date, thème, source), jamais le message.
        await _analytics.RecordAnonymousUsageAsync(response.Source, response.Topic, ct);
        return Ok(response);
    }
}
