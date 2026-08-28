using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("FlashcardDecks")]
public class FlashcardDeck
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    [Required, MaxLength(120)]
    public string Title { get; set; } = "";

    [MaxLength(500)]
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    public ICollection<Flashcard> Cards { get; set; } = new List<Flashcard>();
}

[Table("Flashcards")]
public class Flashcard
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid DeckId { get; set; }

    [Required, MaxLength(2000)]
    public string Front { get; set; } = "";

    [Required, MaxLength(4000)]
    public string Back { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(DeckId))]
    public FlashcardDeck? Deck { get; set; }
}