using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Application.Options;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Infrastructure.Persistence;

namespace SecureFileStorage.Infrastructure.Services;

/// <summary>
/// Statistiques anonymisées : aucun message, réponse, identifiant d'utilisateur,
/// document, adresse IP ou métadonnée de document n'est enregistré.
/// </summary>
public class ChatbotAnalyticsService : IChatbotAnalyticsService
{
    private readonly ApplicationDbContext _context;
    private readonly ChatbotSettings _settings;

    public ChatbotAnalyticsService(
        ApplicationDbContext context,
        IOptions<ChatbotSettings> options)
    {
        _context = context;
        _settings = options.Value;
    }

    public async Task RecordAnonymousUsageAsync(
        string source, string topic, CancellationToken ct = default)
    {
        if (!_settings.TrackAnonymousStatistics) return;

        var safeSource = Normalize(source, 32, "fallback");
        var safeTopic = Normalize(topic, 64, "other");
        var day = DateOnly.FromDateTime(DateTime.UtcNow);

        try
        {
            var metric = await _context.ChatbotUsageMetrics
                .FirstOrDefaultAsync(
                    m => m.Day == day && m.Source == safeSource && m.Topic == safeTopic,
                    ct);

            if (metric is null)
            {
                await _context.ChatbotUsageMetrics.AddAsync(new ChatbotUsageMetric
                {
                    Id = Guid.NewGuid(),
                    Day = day,
                    Source = safeSource,
                    Topic = safeTopic,
                    RequestCount = 1,
                    UpdatedAt = DateTime.UtcNow
                }, ct);
            }
            else
            {
                metric.RequestCount++;
                metric.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Deux requêtes identiques peuvent créer le compteur simultanément.
            // Les statistiques restent facultatives et ne doivent jamais bloquer le chat.
        }
    }

    public async Task<ChatbotUsageStatsDto> GetAnonymousStatsAsync(CancellationToken ct = default)
    {
        var metrics = await _context.ChatbotUsageMetrics
            .AsNoTracking()
            .ToListAsync(ct);

        return new ChatbotUsageStatsDto(
            metrics.Sum(m => m.RequestCount),
            metrics.Where(m => m.Source == "faq").Sum(m => m.RequestCount),
            metrics.Where(m => m.Source == "ai").Sum(m => m.RequestCount),
            metrics.Where(m => m.Source == "fallback").Sum(m => m.RequestCount),
            metrics
                .GroupBy(m => m.Topic)
                .Select(g => new ChatbotTopicStatDto(g.Key, g.Sum(m => m.RequestCount)))
                .OrderByDescending(x => x.Count)
                .Take(8)
                .ToList());
    }

    private static string Normalize(string value, int maxLength, string fallback)
    {
        var normalized = new string((value ?? string.Empty)
            .Trim()
            .ToLowerInvariant()
            .Where(char.IsLetterOrDigit)
            .Take(maxLength)
            .ToArray());
        return string.IsNullOrWhiteSpace(normalized) ? fallback : normalized;
    }
}
