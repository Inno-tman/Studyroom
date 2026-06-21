using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.AI;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public class AIAcademicController : ControllerBase
{
    private readonly IAIAcademicService _aiService;
    private readonly IAiConversationRepository _convRepo;

    public AIAcademicController(IAIAcademicService aiService, IAiConversationRepository convRepo)
    {
        _aiService = aiService;
        _convRepo = convRepo;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("ask")]
    public async Task<IActionResult> Ask([FromBody] AcademicQueryDto query)
    {
        var result = await _aiService.AskAsync(query);

        if (query.ConversationId.HasValue)
        {
            try
            {
                await _convRepo.AddMessageAsync(query.ConversationId.Value, "user", query.Question, null);
                await _convRepo.AddMessageAsync(query.ConversationId.Value, "assistant", result.Answer, null);
                if (result.CurrentPhase != null)
                    await _convRepo.UpdatePhaseAsync(query.ConversationId.Value, result.CurrentPhase);
                result.ConversationId = query.ConversationId.Value;
            }
            catch (Exception ex)
            {
                var logger = HttpContext.RequestServices.GetRequiredService<ILogger<AIAcademicController>>();
                logger.LogWarning(ex, "Failed to persist AI conversation messages");
            }
        }

        return Ok(result);
    }

    [HttpPost("conversations")]
    public async Task<IActionResult> CreateConversation([FromBody] CreateConversationDto dto)
    {
        var conv = await _convRepo.CreateConversationAsync(UserId, null, dto.Subject, dto.ResearchMode, dto.Phase);
        return Ok(new { conv.Id, conv.Subject, conv.IsResearchMode, conv.CurrentPhase, conv.CreatedAt });
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations([FromQuery] int limit = 20)
    {
        var convs = await _convRepo.GetUserConversationsAsync(UserId, limit);
        var result = convs.Select(c => new
        {
            c.Id, c.Subject, c.IsResearchMode, c.CurrentPhase, c.CreatedAt, c.UpdatedAt,
            MessageCount = c.Messages?.Count ?? 0
        });
        return Ok(result);
    }

    [HttpGet("conversations/{id}")]
    public async Task<IActionResult> GetConversation(Guid id)
    {
        var conv = await _convRepo.GetConversationWithMessagesAsync(id);
        if (conv == null || conv.UserId != UserId) return NotFound();
        return Ok(new
        {
            conv.Id, conv.Subject, conv.IsResearchMode, conv.CurrentPhase, conv.CreatedAt,
            Messages = conv.Messages.Select(m => new
            {
                m.Id, m.Role, m.Content, m.CreatedAt
            })
        });
    }

    [HttpDelete("conversations/{id}")]
    public async Task<IActionResult> DeleteConversation(Guid id)
    {
        var conv = await _convRepo.GetConversationWithMessagesAsync(id);
        if (conv == null || conv.UserId != UserId) return NotFound();
        await _convRepo.DeleteConversationAsync(id);
        return NoContent();
    }
}

public class CreateConversationDto
{
    public string? Subject { get; set; }
    public bool ResearchMode { get; set; }
    public string? Phase { get; set; }
}
