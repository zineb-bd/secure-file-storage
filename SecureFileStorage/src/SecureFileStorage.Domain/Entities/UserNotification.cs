namespace SecureFileStorage.Domain.Entities;

public class UserNotification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid? ActorId { get; set; }
    public User? Actor { get; set; }
    public string Type { get; set; } = "DocumentShared";
    public string Message { get; set; } = string.Empty;
    public Guid? DocumentId { get; set; }
    public Document? Document { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
