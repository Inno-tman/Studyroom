using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.Flashcards;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/flashcards")]
[Authorize]
public class FlashcardsController : ControllerBase
{
    private readonly IFlashcardService _flashcardService;
    private readonly IAIAcademicService _aiService;

    public FlashcardsController(IFlashcardService flashcardService, IAIAcademicService aiService)
    {
        _flashcardService = flashcardService;
        _aiService = aiService;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetDecks()
    {
        var decks = await _flashcardService.GetDecksAsync(UserId);
        return Ok(decks);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetDeck(Guid id)
    {
        var deck = await _flashcardService.GetDeckAsync(UserId, id);
        if (deck == null) return NotFound(new { error = "Deck not found" });
        return Ok(deck);
    }

    [HttpPost]
    public async Task<IActionResult> CreateDeck([FromBody] CreateFlashcardDeckDto dto)
    {
        var deck = await _flashcardService.CreateDeckAsync(UserId, dto);
        return Ok(deck);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDeck(Guid id, [FromBody] CreateFlashcardDeckDto dto)
    {
        var deck = await _flashcardService.UpdateDeckAsync(UserId, id, dto);
        if (deck == null) return NotFound(new { error = "Deck not found" });
        return Ok(deck);
    }

    [HttpPut("{id}/cards")]
    public async Task<IActionResult> ReplaceCards(Guid id, [FromBody] UpsertFlashcardsDto dto)
    {
        var deck = await _flashcardService.ReplaceCardsAsync(UserId, id, dto.Cards);
        if (deck == null) return NotFound(new { error = "Deck not found" });
        return Ok(deck);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDeck(Guid id)
    {
        var deleted = await _flashcardService.DeleteDeckAsync(UserId, id);
        if (!deleted) return NotFound(new { error = "Deck not found" });
        return Ok(new { success = true });
    }

    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] GenerateFlashcardsRequestDto dto)
    {
        var result = await _aiService.GenerateFlashcardsAsync(dto);
        return Ok(result);
    }
}