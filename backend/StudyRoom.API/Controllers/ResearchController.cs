using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.AI;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/research")]
[Authorize]
public class ResearchController : ControllerBase
{
    private readonly IResearchService _research;
    private readonly IAIAcademicService _ai;

    public ResearchController(IResearchService research, IAIAcademicService ai)
    {
        _research = research;
        _ai = ai;
    }

    [HttpPost("search")]
    public async Task<IActionResult> SearchPapers([FromBody] PaperSearchDto dto)
    {
        var result = await _research.SearchPapersAsync(dto.Query, dto.Limit);
        return Ok(result);
    }

    [HttpPost("proposal")]
    public async Task<IActionResult> GenerateProposal([FromBody] ResearchProposalRequestDto dto)
    {
        var result = await _research.GenerateProposalAsync(dto);
        return Ok(result);
    }

    [HttpPost("paper")]
    public async Task<IActionResult> GetPaperDetails([FromBody] PaperUrlDto dto)
    {
        var result = await _research.GetPaperDetailsAsync(dto.Url);
        if (result == null) return NotFound("Paper not found");
        return Ok(result);
    }
}

public class PaperUrlDto
{
    public string Url { get; set; } = string.Empty;
}
