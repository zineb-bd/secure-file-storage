using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net.Sockets;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Application.Options;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Persistence;

namespace SecureFileStorage.Infrastructure.Security;

public class AntivirusService : IAntivirusService
{
    /// <summary>Chaîne de test EICAR (standard antivirus) — détectée sans ClamAV.</summary>
    private const string EicarMarker = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";

    /// <summary>
    /// Signature de démo inoffensive (ne déclenche pas Windows Defender).
    /// Utiliser le fichier docs/test-antivirus-demo.txt pour les tests locaux.
    /// </summary>
    private const string DemoThreatMarker = "SFS-DEMO-THREAT-SIGNATURE";

    private const int MaxRecentDurations = 100;

    private static long _totalScans;
    private static long _cleanCount;
    private static long _infectedCount;
    private static long _skippedCount;
    private static long _errorCount;
    private static long _lastScanMs;
    private static long _maxScanMs;
    private static readonly ConcurrentQueue<long> RecentDurationsMs = new();

    private readonly AntivirusSettings _settings;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AntivirusService> _logger;

    public AntivirusService(
        IOptions<AntivirusSettings> settings,
        ApplicationDbContext context,
        ILogger<AntivirusService> logger)
    {
        _settings = settings.Value;
        _context = context;
        _logger = logger;
    }

    public async Task<(AntivirusScanResult Result, string? ThreatName)> ScanAsync(
        Stream fileStream, string fileName, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, ct);
        var data = ms.ToArray();
        if (fileStream.CanSeek)
            fileStream.Position = 0;

        // 1) Moteur intégré (signatures) — toujours au téléversement
        var localThreat = DetectBuiltInThreat(data);
        if (localThreat is not null)
        {
            sw.Stop();
            await PersistAlertAsync(fileName, localThreat, "Détection moteur intégré au téléversement", ct);
            _logger.LogWarning(
                "Antivirus : fichier rejeté au téléversement — {FileName} menace={Threat}",
                fileName, localThreat);
            RecordScan(AntivirusScanResult.Infected, sw.ElapsedMilliseconds);
            return (AntivirusScanResult.Infected, localThreat);
        }

        // 2) ClamAV (optionnel) — sinon le moteur intégré valide déjà le fichier
        if (!_settings.Enabled)
        {
            sw.Stop();
            _logger.LogInformation(
                "Antivirus : scan signatures OK au téléversement — {FileName} (ClamAV désactivé)",
                fileName);
            RecordScan(AntivirusScanResult.Clean, sw.ElapsedMilliseconds);
            return (AntivirusScanResult.Clean, null);
        }

        try
        {
            using var client = new TcpClient();
            await client.ConnectAsync(_settings.ClamAvHost, _settings.ClamAvPort, ct);
            await using var stream = client.GetStream();

            var command = Encoding.UTF8.GetBytes("zINSTREAM\0");
            await stream.WriteAsync(command, ct);

            var sizeBytes = BitConverter.GetBytes((uint)data.Length);
            if (BitConverter.IsLittleEndian)
                Array.Reverse(sizeBytes);
            await stream.WriteAsync(sizeBytes, ct);
            await stream.WriteAsync(data, ct);
            await stream.WriteAsync(BitConverter.GetBytes(0u), ct);

            var buffer = new byte[4096];
            var read = await stream.ReadAsync(buffer, ct);
            var response = Encoding.UTF8.GetString(buffer, 0, read);

            sw.Stop();

            if (response.Contains("OK", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Antivirus ClamAV : fichier sain — {FileName}", fileName);
                RecordScan(AntivirusScanResult.Clean, sw.ElapsedMilliseconds);
                return (AntivirusScanResult.Clean, null);
            }

            var threat = response.Contains("FOUND", StringComparison.OrdinalIgnoreCase)
                ? response.Split(':').LastOrDefault()?.Trim()
                : "Unknown";

            await PersistAlertAsync(fileName, threat ?? "Unknown", response.Trim(), ct);
            _logger.LogWarning(
                "Antivirus ClamAV : fichier rejeté au téléversement — {FileName} menace={Threat}",
                fileName, threat);
            RecordScan(AntivirusScanResult.Infected, sw.ElapsedMilliseconds);
            return (AntivirusScanResult.Infected, threat);
        }
        catch (Exception ex)
        {
            sw.Stop();
            await PersistAlertAsync(
                fileName,
                "SCAN_FAILED",
                $"Échec du scan antivirus au téléversement : {ex.GetType().Name} — {ex.Message}",
                ct);
            _logger.LogError(
                ex,
                "Antivirus : échec du scan au téléversement — {FileName} (fichier rejeté)",
                fileName);
            RecordScan(AntivirusScanResult.Error, sw.ElapsedMilliseconds);
            return (AntivirusScanResult.Error, "SCAN_FAILED");
        }
    }

    public async Task<IEnumerable<AntivirusAlertDto>> GetAlertsAsync(
        bool unresolvedOnly = true, int take = 50, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 200);
        var query = _context.AntivirusAlerts.AsNoTracking().AsQueryable();
        if (unresolvedOnly)
            query = query.Where(a => !a.IsResolved);

        return await query
            .OrderByDescending(a => a.DetectedAt)
            .Take(take)
            .Select(a => new AntivirusAlertDto(
                a.Id, a.DocumentId, a.FileName, a.ThreatName, a.Details, a.DetectedAt, a.IsResolved))
            .ToListAsync(ct);
    }

    public async Task<AntivirusStatsDto> GetStatsAsync(CancellationToken ct = default)
    {
        var totalAlerts = await _context.AntivirusAlerts.CountAsync(ct);
        var unresolvedAlerts = await _context.AntivirusAlerts.CountAsync(a => !a.IsResolved, ct);
        var lastDetectionAt = await _context.AntivirusAlerts
            .OrderByDescending(a => a.DetectedAt)
            .Select(a => (DateTime?)a.DetectedAt)
            .FirstOrDefaultAsync(ct);

        var cleanDocuments = await _context.Documents.CountAsync(
            d => d.LastScanResult == AntivirusScanResult.Clean, ct);
        var documentsScanned = await _context.Documents.CountAsync(
            d => d.LastScanResult != AntivirusScanResult.Skipped, ct);

        var topThreats = await _context.AntivirusAlerts
            .AsNoTracking()
            .GroupBy(a => a.ThreatName)
            .Select(g => new AntivirusThreatStatDto(
                g.Key,
                g.Count(),
                g.Max(a => a.DetectedAt)))
            .OrderByDescending(t => t.Count)
            .Take(8)
            .ToListAsync(ct);

        var durations = RecentDurationsMs.ToArray();
        double? averageMs = durations.Length > 0 ? durations.Average() : null;
        var lastMs = Interlocked.Read(ref _lastScanMs);
        var maxMs = Interlocked.Read(ref _maxScanMs);

        return new AntivirusStatsDto(
            Enabled: _settings.Enabled,
            Engine: _settings.Enabled ? "ClamAV + signatures" : "Signatures (intégré)",
            Host: _settings.ClamAvHost,
            Port: _settings.ClamAvPort,
            TotalScansSession: (int)Interlocked.Read(ref _totalScans),
            CleanCountSession: (int)Interlocked.Read(ref _cleanCount),
            InfectedCountSession: (int)Interlocked.Read(ref _infectedCount),
            SkippedCountSession: (int)Interlocked.Read(ref _skippedCount),
            ErrorCountSession: (int)Interlocked.Read(ref _errorCount),
            AverageScanMs: averageMs,
            LastScanMs: lastMs > 0 ? lastMs : null,
            MaxScanMs: maxMs > 0 ? maxMs : null,
            TotalAlerts: totalAlerts,
            UnresolvedAlerts: unresolvedAlerts,
            CleanDocuments: cleanDocuments,
            DocumentsScanned: documentsScanned,
            LastDetectionAt: lastDetectionAt,
            TopThreats: topThreats);
    }

    private async Task PersistAlertAsync(string fileName, string threatName, string details, CancellationToken ct)
    {
        await _context.AntivirusAlerts.AddAsync(new AntivirusAlert
        {
            Id = Guid.NewGuid(),
            FileName = fileName,
            ThreatName = threatName,
            Details = details,
            DetectedAt = DateTime.UtcNow
        }, ct);
        await _context.SaveChangesAsync(ct);
    }

    private static string? DetectBuiltInThreat(byte[] data)
    {
        // UTF-8 + ASCII : couvre BOM, retours ligne, fichiers édités sous Windows
        var text = Encoding.UTF8.GetString(data);
        if (text.Contains(DemoThreatMarker, StringComparison.OrdinalIgnoreCase))
            return "SFS-Demo-Threat";
        if (text.Contains(EicarMarker, StringComparison.OrdinalIgnoreCase))
            return "EICAR-Test-File";
        return null;
    }

    private static void RecordScan(AntivirusScanResult result, long durationMs)
    {
        Interlocked.Increment(ref _totalScans);
        switch (result)
        {
            case AntivirusScanResult.Clean:
                Interlocked.Increment(ref _cleanCount);
                break;
            case AntivirusScanResult.Infected:
                Interlocked.Increment(ref _infectedCount);
                break;
            case AntivirusScanResult.Skipped:
                Interlocked.Increment(ref _skippedCount);
                break;
            default:
                Interlocked.Increment(ref _errorCount);
                break;
        }

        if (durationMs <= 0) return;

        Interlocked.Exchange(ref _lastScanMs, durationMs);
        long currentMax;
        do
        {
            currentMax = Interlocked.Read(ref _maxScanMs);
            if (durationMs <= currentMax) break;
        } while (Interlocked.CompareExchange(ref _maxScanMs, durationMs, currentMax) != currentMax);

        RecentDurationsMs.Enqueue(durationMs);
        while (RecentDurationsMs.Count > MaxRecentDurations && RecentDurationsMs.TryDequeue(out _))
        { }
    }
}
