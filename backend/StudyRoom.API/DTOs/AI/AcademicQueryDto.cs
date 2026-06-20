using System.ComponentModel.DataAnnotations;

namespace StudyRoom.API.DTOs.AI;

public class AcademicQueryDto
{
    [Required, MaxLength(2000)]
    public string Question { get; set; } = string.Empty;

    public string? Subject { get; set; }

    public string? Context { get; set; }

    public bool ResearchMode { get; set; }

    public string? ResearchPhase { get; set; }
}

public class AcademicResponseDto
{
    public string Answer { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsResearchMode { get; set; }
    public string? CurrentPhase { get; set; }
    public string? NextPhase { get; set; }
    public List<PaperReference>? References { get; set; }
    public List<ResearchPhase>? ResearchOutline { get; set; }
}

public class PaperReference
{
    public string Title { get; set; } = string.Empty;
    public string Authors { get; set; } = string.Empty;
    public int Year { get; set; }
    public string? Venue { get; set; }
    public string? Url { get; set; }
    public string? Abstract { get; set; }
    public string? CitationCount { get; set; }
}

public class ResearchPhase
{
    public string Phase { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool Completed { get; set; }
}

public class PaperSearchDto
{
    [Required, MaxLength(500)]
    public string Query { get; set; } = string.Empty;

    public int Limit { get; set; } = 10;
}

public class PaperSearchResultDto
{
    public List<PaperReference> Papers { get; set; } = new();
    public int TotalResults { get; set; }
}

public class ResearchProposalRequestDto
{
    [Required, MaxLength(500)]
    public string Topic { get; set; } = string.Empty;

    public string? Subject { get; set; }
}

public class ResearchProposalResponseDto
{
    public string Topic { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public List<ResearchPhase> Phases { get; set; } = new();
    public string CurrentPhase { get; set; } = string.Empty;
    public string CurrentPhaseContent { get; set; } = string.Empty;
    public List<PaperReference>? References { get; set; }
    public string? FullProposal { get; set; }
}
