using StudyRoom.API.DTOs.AI;

namespace StudyRoom.API.Services;

public interface IAIAcademicService
{
    Task<AcademicResponseDto> AskAsync(AcademicQueryDto query);
}
