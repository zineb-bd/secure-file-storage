using Microsoft.EntityFrameworkCore;
using SecureFileStorage.Application.DTOs;
using SecureFileStorage.Application.Interfaces;
using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Infrastructure.Persistence;

namespace SecureFileStorage.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IRoleRepository _roleRepository;
    private readonly ApplicationDbContext _context;
    private readonly IUnitOfWork _unitOfWork;

    public UserService(IUserRepository userRepository, IRoleRepository roleRepository, ApplicationDbContext context, IUnitOfWork unitOfWork)
    {
        _userRepository = userRepository;
        _roleRepository = roleRepository;
        _context = context;
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<UserDto>> GetAllAsync(CancellationToken ct = default)
    {
        var users = await _userRepository.GetAllWithRolesAsync(ct);
        return users.Select(AuthService.MapUser);
    }

    public async Task<UserDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(id, ct);
        return user is null ? null : AuthService.MapUser(user);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        if (await _userRepository.EmailExistsAsync(request.Email, ct))
            throw new InvalidOperationException("Cet email est déjà utilisé.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FirstName = request.FirstName,
            LastName = request.LastName
        };

        if (request.RoleNames is not null)
        {
            foreach (var roleName in request.RoleNames)
            {
                var role = await _roleRepository.GetByNameAsync(roleName, ct);
                if (role is not null)
                    user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
            }
        }

        await _userRepository.AddAsync(user, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        var created = await _userRepository.GetByIdWithRolesAsync(user.Id, ct);
        return AuthService.MapUser(created!);
    }

    public async Task<UserDto?> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdWithRolesAsync(id, ct);
        if (user is null) return null;

        if (request.FirstName is not null) user.FirstName = request.FirstName;
        if (request.LastName is not null) user.LastName = request.LastName;
        if (request.IsActive.HasValue) user.IsActive = request.IsActive.Value;
        user.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(ct);
        return AuthService.MapUser(user);
    }

    public async Task<bool> DeactivateAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _context.Users.FindAsync([id], ct);
        if (user is null) return false;
        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _context.Users.FindAsync([id], ct);
        if (user is null) return false;
        _context.Users.Remove(user);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }
}

public class RoleService : IRoleService
{
    private readonly IRoleRepository _roleRepository;
    private readonly ApplicationDbContext _context;
    private readonly IUnitOfWork _unitOfWork;

    public RoleService(IRoleRepository roleRepository, ApplicationDbContext context, IUnitOfWork unitOfWork)
    {
        _roleRepository = roleRepository;
        _context = context;
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<RoleDto>> GetAllAsync(CancellationToken ct = default)
    {
        var roles = await _roleRepository.GetAllAsync(ct);
        return roles.Select(r => new RoleDto(r.Id, r.Name, r.Description));
    }

    public async Task<RoleDto> CreateAsync(CreateRoleRequest request, CancellationToken ct = default)
    {
        var role = new Role
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description
        };
        await _roleRepository.AddAsync(role, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return new RoleDto(role.Id, role.Name, role.Description);
    }

    public async Task<RoleDto?> UpdateAsync(Guid id, UpdateRoleRequest request, CancellationToken ct = default)
    {
        var role = await _context.Roles.FindAsync([id], ct);
        if (role is null) return null;

        if (request.Name is not null) role.Name = request.Name;
        if (request.Description is not null) role.Description = request.Description;
        await _unitOfWork.SaveChangesAsync(ct);
        return new RoleDto(role.Id, role.Name, role.Description);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var role = await _context.Roles.FindAsync([id], ct);
        if (role is null) return false;
        _context.Roles.Remove(role);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> AssignRoleAsync(AssignRoleRequest request, CancellationToken ct = default)
    {
        var exists = await _context.UserRoles.AnyAsync(
            ur => ur.UserId == request.UserId && ur.RoleId == request.RoleId, ct);
        if (exists) return true;

        await _context.UserRoles.AddAsync(new UserRole
        {
            UserId = request.UserId,
            RoleId = request.RoleId
        }, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }
}
