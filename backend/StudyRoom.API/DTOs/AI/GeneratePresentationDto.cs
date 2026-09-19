namespace StudyRoom.API.DTOs.AI;

public class GeneratePresentationRequestDto
{
    public string Text { get; set; } = string.Empty;
    public int MaxSlides { get; set; } = 10;
}

public class PresentationSlideDto
{
    public string Title { get; set; } = string.Empty;
    public List<string> Content { get; set; } = new();
}

public class GeneratePresentationDto
{
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public string? Title { get; set; }
    public List<PresentationSlideDto> Slides { get; set; } = new();
}
