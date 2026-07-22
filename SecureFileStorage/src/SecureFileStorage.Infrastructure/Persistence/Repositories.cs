using Microsoft.EntityFrameworkCore;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;

namespace SecureFileStorage.Infrastructure.Persistence;

public class UnitOfWork(ApplicationDbContext context) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken ct = default) => context.SaveChangesAsync(ct);
}

public class DocumentRepository(ApplicationDbContext context) : IDocumentRepository
{
    public Task<Document?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        context.Documents
            .Include(d => d.Owner)
            .Include(d => d.LockedBy)
            .Include(d => d.Permissions)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

    public Task<Document?> GetByIdWithVersionsAsync(Guid id, CancellationToken ct = default) =>
        context.Documents
            .Include(d => d.Owner)
            .Include(d => d.Versions).ThenInclude(v => v.StoredBlob)
            .Include(d => d.Permissions)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

    public async Task AddAsync(Document document, CancellationToken ct = default) =>
        await context.Documents.AddAsync(document, ct);

    public async Task<(IEnumerable<Document> Items, int Total)> SearchAsync(
        DocumentSearchRequest request, Guid? ownerFilter, CancellationToken ct = default)
    {
        var query = context.Documents
            .Include(d => d.Owner)
            .Include(d => d.LockedBy)
            .Include(d => d.Permissions)
            .AsQueryable();

        if (ownerFilter.HasValue)
            query = query.Where(d => d.OwnerId == ownerFilter.Value);

        if (!string.IsNullOrWhiteSpace(request.FileName))
            query = query.Where(d => d.FileName.Contains(request.FileName));

        if (!string.IsNullOrWhiteSpace(request.Category))
            query = query.Where(d => d.Category == request.Category);

        if (!string.IsNullOrWhiteSpace(request.ContentType))
            query = query.Where(d => d.ContentType.Contains(request.ContentType));

        if (request.OwnerId.HasValue)
            query = query.Where(d => d.OwnerId == request.OwnerId.Value);

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<DocumentStatus>(request.Status, true, out var status))
            query = query.Where(d => d.Status == status);
        else
            query = query.Where(d => d.Status != DocumentStatus.Deleted);

        if (request.CreatedFrom.HasValue)
            query = query.Where(d => d.CreatedAt >= request.CreatedFrom.Value);

        if (request.CreatedTo.HasValue)
            query = query.Where(d => d.CreatedAt <= request.CreatedTo.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        return (items, total);
    }
}

public class UserRepository(ApplicationDbContext context) : IUserRepository
{
    public Task<User?> GetByEmailAsync(string email, CancellationToken ct = default) =>
        context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Email == email, ct);

    public Task<User?> GetByIdWithRolesAsync(Guid id, CancellationToken ct = default) =>
        context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<IEnumerable<User>> GetAllWithRolesAsync(CancellationToken ct = default) =>
        context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .ToListAsync(ct)
            .ContinueWith(t => (IEnumerable<User>)t.Result, ct);

    public async Task AddAsync(User user, CancellationToken ct = default) =>
        await context.Users.AddAsync(user, ct);

    public Task<bool> EmailExistsAsync(string email, CancellationToken ct = default) =>
        context.Users.AnyAsync(u => u.Email == email, ct);
}

public class RoleRepository(ApplicationDbContext context) : IRoleRepository
{
    public Task<Role?> GetByNameAsync(string name, CancellationToken ct = default) =>
        context.Roles.FirstOrDefaultAsync(r => r.Name == name, ct);

    public Task<IEnumerable<Role>> GetAllAsync(CancellationToken ct = default) =>
        context.Roles.ToListAsync(ct).ContinueWith(t => (IEnumerable<Role>)t.Result, ct);

    public async Task AddAsync(Role role, CancellationToken ct = default) =>
        await context.Roles.AddAsync(role, ct);
}

public class AuditRepository(ApplicationDbContext context) : IAuditRepository
{
    public async Task AddAsync(AuditLog log, CancellationToken ct = default) =>
        await context.AuditLogs.AddAsync(log, ct);

    public async Task<(IEnumerable<AuditLog> Items, int Total)> SearchAsync(AuditSearchRequest request, CancellationToken ct = default)
    {
        var query = context.AuditLogs
            .Include(a => a.User)
            .Where(a => a.ResourceType == "Document")
            .AsQueryable();

        if (request.UserId.HasValue)
            query = query.Where(a => a.UserId == request.UserId.Value);

        if (request.ResourceId.HasValue)
            query = query.Where(a => a.ResourceId == request.ResourceId.Value);

        if (!string.IsNullOrWhiteSpace(request.Action) && Enum.TryParse<AuditAction>(request.Action, true, out var action))
            query = query.Where(a => a.Action == action);

        if (request.From.HasValue)
            query = query.Where(a => a.Timestamp >= request.From.Value);

        if (request.To.HasValue)
            query = query.Where(a => a.Timestamp <= request.To.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        return (items, total);
    }
}
