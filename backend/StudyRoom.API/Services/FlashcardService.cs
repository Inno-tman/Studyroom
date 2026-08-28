using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.DTOs.Flashcards;
using StudyRoom.API.Models;

namespace StudyRoom.API.Services;

public interface IFlashcardService
{
    Task<List<FlashcardDeckDto>> GetDecksAsync(Guid userId);
    Task<FlashcardDeckDetailDto?> GetDeckAsync(Guid userId, Guid deckId);
    Task<FlashcardDeckDto> CreateDeckAsync(Guid userId, CreateFlashcardDeckDto dto);
    Task<FlashcardDeckDto?> UpdateDeckAsync(Guid userId, Guid deckId, CreateFlashcardDeckDto dto);
    Task<bool> DeleteDeckAsync(Guid userId, Guid deckId);
    Task<FlashcardDeckDetailDto?> ReplaceCardsAsync(Guid userId, Guid deckId, List<FlashcardDto> cards, string? title = null);
}

public class FlashcardService : IFlashcardService
{
    private readonly AppDbContext _context;

    public FlashcardService(AppDbContext context) => _context = context;

    public async Task<List<FlashcardDeckDto>> GetDecksAsync(Guid userId) =>
        await _context.FlashcardDecks
            .Where(d => d.UserId == userId)
            .OrderByDescending(d => d.UpdatedAt)
            .Select(d => new FlashcardDeckDto
            {
                Id = d.Id,
                Title = d.Title,
                Description = d.Description,
                CardCount = d.Cards.Count,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt
            })
            .ToListAsync();

    public async Task<FlashcardDeckDetailDto?> GetDeckAsync(Guid userId, Guid deckId)
    {
        var deck = await _context.FlashcardDecks
            .Include(d => d.Cards)
            .FirstOrDefaultAsync(d => d.Id == deckId && d.UserId == userId);
        if (deck == null) return null;

        return new FlashcardDeckDetailDto
        {
            Id = deck.Id,
            Title = deck.Title,
            Description = deck.Description,
            Cards = deck.Cards
                .OrderBy(c => c.CreatedAt)
                .Select(c => new FlashcardDto { Id = c.Id, Front = c.Front, Back = c.Back })
                .ToList()
        };
    }

    public async Task<FlashcardDeckDto> CreateDeckAsync(Guid userId, CreateFlashcardDeckDto dto)
    {
        var deck = new FlashcardDeck
        {
            UserId = userId,
            Title = string.IsNullOrWhiteSpace(dto.Title) ? "Untitled deck" : dto.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim()
        };
        _context.FlashcardDecks.Add(deck);
        await _context.SaveChangesAsync();

        return new FlashcardDeckDto
        {
            Id = deck.Id,
            Title = deck.Title,
            Description = deck.Description,
            CardCount = 0,
            CreatedAt = deck.CreatedAt,
            UpdatedAt = deck.UpdatedAt
        };
    }

    public async Task<FlashcardDeckDto?> UpdateDeckAsync(Guid userId, Guid deckId, CreateFlashcardDeckDto dto)
    {
        var deck = await _context.FlashcardDecks.FirstOrDefaultAsync(d => d.Id == deckId && d.UserId == userId);
        if (deck == null) return null;

        deck.Title = string.IsNullOrWhiteSpace(dto.Title) ? deck.Title : dto.Title.Trim();
        deck.Description = string.IsNullOrWhiteSpace(dto.Description) ? deck.Description : dto.Description.Trim();
        deck.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return new FlashcardDeckDto
        {
            Id = deck.Id,
            Title = deck.Title,
            Description = deck.Description,
            CardCount = await _context.Flashcards.CountAsync(c => c.DeckId == deck.Id),
            CreatedAt = deck.CreatedAt,
            UpdatedAt = deck.UpdatedAt
        };
    }

    public async Task<bool> DeleteDeckAsync(Guid userId, Guid deckId)
    {
        var deck = await _context.FlashcardDecks.FirstOrDefaultAsync(d => d.Id == deckId && d.UserId == userId);
        if (deck == null) return false;

        _context.FlashcardDecks.Remove(deck);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<FlashcardDeckDetailDto?> ReplaceCardsAsync(Guid userId, Guid deckId, List<FlashcardDto> cards, string? title = null)
    {
        var deck = await _context.FlashcardDecks.FirstOrDefaultAsync(d => d.Id == deckId && d.UserId == userId);
        if (deck == null) return null;

        var cleaned = (cards ?? new List<FlashcardDto>())
            .Where(c => !string.IsNullOrWhiteSpace(c.Front) && !string.IsNullOrWhiteSpace(c.Back))
            .Select(c => new Flashcard
            {
                Id = Guid.NewGuid(),
                DeckId = deck.Id,
                Front = c.Front.Trim(),
                Back = c.Back.Trim()
            })
            .ToList();

        var existing = await _context.Flashcards.Where(c => c.DeckId == deck.Id).ToListAsync();
        _context.Flashcards.RemoveRange(existing);
        await _context.SaveChangesAsync();

        if (cleaned.Count > 0)
            await _context.Flashcards.AddRangeAsync(cleaned);

        if (!string.IsNullOrWhiteSpace(title))
            deck.Title = title.Trim();
        deck.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return new FlashcardDeckDetailDto
        {
            Id = deck.Id,
            Title = deck.Title,
            Description = deck.Description,
            Cards = cleaned.Select(c => new FlashcardDto { Id = c.Id, Front = c.Front, Back = c.Back }).ToList()
        };
    }
}