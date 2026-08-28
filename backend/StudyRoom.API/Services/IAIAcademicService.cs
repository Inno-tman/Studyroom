using StudyRoom.API.DTOs.AI;
using StudyRoom.API.DTOs.Flashcards;

namespace StudyRoom.API.Services;

public interface IAIAcademicService
{
    Task<AcademicResponseDto> AskAsync(AcademicQueryDto query);

    Task<GameContentDto> GenerateGameContentAsync(GameContentRequestDto request);

    Task<GenerateFlashcardsResultDto> GenerateFlashcardsAsync(GenerateFlashcardsRequestDto request);
}
