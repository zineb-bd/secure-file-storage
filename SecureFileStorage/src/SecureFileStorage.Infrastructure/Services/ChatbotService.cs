using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Application.Options;

namespace SecureFileStorage.Infrastructure.Services;

public class ChatbotService : IChatbotService
{
    private readonly HttpClient _http;
    private readonly ChatbotSettings _settings;
    private readonly ILogger<ChatbotService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public ChatbotService(HttpClient http, IOptions<ChatbotSettings> options, ILogger<ChatbotService> logger)
    {
        _http = http;
        _settings = options.Value;
        _logger = logger;
    }

    public async Task<ChatResponse> AskAsync(ChatRequest request, CancellationToken ct = default)
    {
        var message = (request.Message ?? string.Empty).Trim();
        var locale = string.IsNullOrWhiteSpace(request.Locale) ? "fr" : request.Locale!;

        if (string.IsNullOrWhiteSpace(message))
            return new ChatResponse(FallbackReply(locale), "fallback", "empty");

        var faq = ChatFaqMatcher.TryMatch(message, locale);
        if (faq is not null)
            return new ChatResponse(faq.Value.Reply, "faq", faq.Value.Intent);

        if (!_settings.Enabled || string.IsNullOrWhiteSpace(_settings.ApiKey))
            return new ChatResponse(FallbackReply(locale), "fallback", "other");

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, "chat/completions");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey.Trim());
            req.Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    model = _settings.Model,
                    max_tokens = _settings.MaxTokens,
                    temperature = 0.3,
                    messages = new object[]
                    {
                        new { role = "system", content = BuildSystemPrompt(locale) },
                        new { role = "user", content = message }
                    }
                }, JsonOptions),
                Encoding.UTF8,
                "application/json");

            using var res = await _http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("Chatbot provider returned status {Status}", (int)res.StatusCode);
                return new ChatResponse(FallbackReply(locale), "fallback", "other");
            }

            var payload = await res.Content.ReadFromJsonAsync<OpenAiChatCompletion>(JsonOptions, ct);
            var reply = payload?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();
            if (string.IsNullOrWhiteSpace(reply))
                return new ChatResponse(FallbackReply(locale), "fallback", "other");

            return new ChatResponse(reply, "ai", "other");
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chatbot AI request failed");
            return new ChatResponse(FallbackReply(locale), "fallback", "other");
        }
    }

    private static string BuildSystemPrompt(string locale)
    {
        var isEn = locale.StartsWith("en", StringComparison.OrdinalIgnoreCase);
        if (isEn)
        {
            return """
                You are the SecureDocs in-app help assistant for a secure enterprise document management platform.
                Answer briefly and clearly about SecureDocs features only: upload, documents, sharing, categories, archive, trash, profile, dashboard, and admin areas (users, roles, audit, config).
                Explain that files are encrypted before storage and access is controlled by roles/permissions.
                Do not invent backend APIs, do not ask for secrets, and never request or process file contents.
                If the question is unrelated to SecureDocs, say you can only help with SecureDocs usage and suggest relevant topics.
                Reply in English in 2-5 short sentences.
                """;
        }

        return """
            Tu es l'assistant d'aide intégré de SecureDocs, une plateforme de gestion documentaire sécurisée.
            Réponds brièvement et clairement uniquement sur les fonctionnalités SecureDocs : téléversement, documents, partage, catégories, archive, corbeille, profil, tableau de bord, et zones admin (utilisateurs, rôles, audit, configuration).
            Explique que les fichiers sont chiffrés avant stockage et que l'accès est contrôlé par rôles/permissions.
            N'invente pas d'API, ne demande pas de secrets, et ne traite jamais le contenu des fichiers.
            Si la question est hors sujet, indique que tu aides uniquement à l'usage de SecureDocs et propose des sujets pertinents.
            Réponds en français en 2 à 5 phrases courtes.
            """;
    }

    private static string FallbackReply(string? locale)
    {
        var isEn = !string.IsNullOrWhiteSpace(locale) && locale.StartsWith("en", StringComparison.OrdinalIgnoreCase);
        return isEn
            ? "I couldn't find a precise answer. Topics I can help with: upload, sharing, trash, categories, security. Rephrase your question or use a suggestion."
            : "Je n'ai pas trouvé de réponse précise. Voici des sujets sur lesquels je peux vous aider : téléversement, partage, corbeille, catégories, sécurité. Reformulez votre question ou utilisez une suggestion.";
    }

    private sealed class OpenAiChatCompletion
    {
        public List<OpenAiChoice>? Choices { get; set; }
    }

    private sealed class OpenAiChoice
    {
        public OpenAiMessage? Message { get; set; }
    }

    private sealed class OpenAiMessage
    {
        public string? Content { get; set; }
    }
}
