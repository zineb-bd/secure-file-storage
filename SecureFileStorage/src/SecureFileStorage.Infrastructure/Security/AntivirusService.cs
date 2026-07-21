using System.Net.Sockets;
using System.Text;
using Microsoft.EntityFrameworkCore;
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
    private readonly AntivirusSettings _settings;
    private readonly ApplicationDbContext _context;

    public AntivirusService(IOptions<AntivirusSettings> settings, ApplicationDbContext context)
    {
        _settings = settings.Value;
        _context = context;
    }

    public async Task<(AntivirusScanResult Result, string? ThreatName)> ScanAsync(
        Stream fileStream, string fileName, CancellationToken ct = default)
    {
        if (!_settings.Enabled)
            return (AntivirusScanResult.Skipped, null);

        try
        {
            using var ms = new MemoryStream();
            await fileStream.CopyToAsync(ms, ct);
            var data = ms.ToArray();
            fileStream.Position = 0;

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

            if (response.Contains("OK", StringComparison.OrdinalIgnoreCase))
                return (AntivirusScanResult.Clean, null);

            var threat = response.Contains("FOUND", StringComparison.OrdinalIgnoreCase)
                ? response.Split(':').LastOrDefault()?.Trim()
                : "Unknown";

            await _context.AntivirusAlerts.AddAsync(new AntivirusAlert
            {
                Id = Guid.NewGuid(),
                FileName = fileName,
                ThreatName = threat ?? "Unknown",
                Details = response,
                DetectedAt = DateTime.UtcNow
            }, ct);
            await _context.SaveChangesAsync(ct);

            return (AntivirusScanResult.Infected, threat);
        }
        catch
        {
            return (AntivirusScanResult.Error, null);
        }
    }

    public async Task<IEnumerable<AntivirusAlertDto>> GetAlertsAsync(bool unresolvedOnly = true, CancellationToken ct = default)
    {
        var query = _context.AntivirusAlerts.AsQueryable();
        if (unresolvedOnly)
            query = query.Where(a => !a.IsResolved);

        return await query
            .OrderByDescending(a => a.DetectedAt)
            .Select(a => new AntivirusAlertDto(
                a.Id, a.DocumentId, a.FileName, a.ThreatName, a.Details, a.DetectedAt, a.IsResolved))
            .ToListAsync(ct);
    }
}
