namespace SecureFileStorage.Domain.Entities;

public class DocumentFavorite
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid DocumentId { get; set; }
    public Document Document { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
