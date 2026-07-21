using System.Text;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;

namespace SecureFileStorage.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly IAuditRepository _auditRepository;
    private readonly IUnitOfWork _unitOfWork;

    public AuditService(IAuditRepository auditRepository, IUnitOfWork unitOfWork)
    {
        _auditRepository = auditRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task LogAsync(
        Guid? userId, AuditAction action, string resourceType, Guid? resourceId,
        string details, string ipAddress, bool success = true, CancellationToken ct = default)
    {
        if (!resourceType.Equals("Document", StringComparison.OrdinalIgnoreCase))
            return;

        await _auditRepository.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            ResourceType = resourceType,
            ResourceId = resourceId,
            Details = details,
            IpAddress = ipAddress,
            Success = success,
            Timestamp = DateTime.UtcNow
        }, ct);
        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<AuditLogDto>> SearchAsync(AuditSearchRequest request, CancellationToken ct = default)
    {
        var (items, total) = await _auditRepository.SearchAsync(request, ct);
        var dtos = items.Select(a => new AuditLogDto(
            a.Id, a.UserId, a.User?.Email, a.Action.ToString(), a.ResourceType,
            a.ResourceId, a.Details, a.IpAddress, a.Success, a.Timestamp));
        return new PagedResult<AuditLogDto>(dtos, total, request.Page, request.PageSize);
    }

    public async Task<byte[]> ExportAsync(AuditSearchRequest request, CancellationToken ct = default)
    {
        request = request with { PageSize = 10000 };
        var result = await SearchAsync(request, ct);
        var sb = new StringBuilder();
        sb.AppendLine("Id,UserId,UserEmail,Action,ResourceType,ResourceId,Details,IpAddress,Success,Timestamp");
        foreach (var log in result.Items)
        {
            sb.AppendLine($"{log.Id},{log.UserId},{log.UserEmail},{log.Action},{log.ResourceType},{log.ResourceId},\"{log.Details.Replace("\"", "'")}\",{log.IpAddress},{log.Success},{log.Timestamp:O}");
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}

public class PermissionChecker : IPermissionChecker
{
    private readonly IDocumentRepository _documentRepository;
    private readonly IUserRepository _userRepository;

    public PermissionChecker(IDocumentRepository documentRepository, IUserRepository userRepository)
    {
        _documentRepository = documentRepository;
        _userRepository = userRepository;
    }

    public bool IsAdmin(IEnumerable<string> roles) =>
        roles.Any(r => r.Equals("Admin", StringComparison.OrdinalIgnoreCase));

    public async Task<bool> CanReadAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(userId, ct);
        if (user is null) return false;
        if (IsAdmin(user.UserRoles.Select(ur => ur.Role.Name))) return true;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null || doc.Status == DocumentStatus.Deleted) return false;
        if (doc.OwnerId == userId) return true;

        return doc.Permissions.Any(p =>
            p.UserId == userId &&
            (p.Permission == PermissionType.Read || p.Permission == PermissionType.Write || p.Permission == PermissionType.Admin));
    }

    public async Task<bool> CanWriteAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(userId, ct);
        if (user is null) return false;
        if (IsAdmin(user.UserRoles.Select(ur => ur.Role.Name))) return true;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null || doc.Status == DocumentStatus.Deleted) return false;
        if (doc.OwnerId == userId) return true;

        return doc.Permissions.Any(p =>
            p.UserId == userId &&
            (p.Permission == PermissionType.Write || p.Permission == PermissionType.Admin));
    }

    public async Task<bool> CanDeleteAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(userId, ct);
        if (user is null) return false;
        if (IsAdmin(user.UserRoles.Select(ur => ur.Role.Name))) return true;

        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null) return false;
        if (doc.OwnerId == userId) return true;

        return doc.Permissions.Any(p =>
            p.UserId == userId &&
            (p.Permission == PermissionType.Delete || p.Permission == PermissionType.Admin));
    }

    public async Task<bool> CanRestoreFromTrashAsync(Guid documentId, Guid userId, CancellationToken ct = default)
    {
        var doc = await _documentRepository.GetByIdAsync(documentId, ct);
        if (doc is null || doc.Status != DocumentStatus.Deleted) return false;
        return await CanDeleteAsync(documentId, userId, ct);
    }
}
