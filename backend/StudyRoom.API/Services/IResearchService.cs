using StudyRoom.API.DTOs.AI;

namespace StudyRoom.API.Services;

public interface IResearchService
{
    Task<PaperSearchResultDto> SearchPapersAsync(string query, int limit = 10);
    Task<ResearchProposalResponseDto> GenerateProposalAsync(ResearchProposalRequestDto request);
    Task<PaperReference?> GetPaperDetailsAsync(string paperUrl);
}
