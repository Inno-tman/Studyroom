using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.AI;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public class AIAcademicController : ControllerBase
{
    private readonly IAIAcademicService _aiService;

    public AIAcademicController(IAIAcademicService aiService) => _aiService = aiService;

    [HttpPost("ask")]
    public async Task<IActionResult> Ask([FromBody] AcademicQueryDto query)
    {
        var result = await _aiService.AskAsync(query);
        return Ok(result);
    }
}
