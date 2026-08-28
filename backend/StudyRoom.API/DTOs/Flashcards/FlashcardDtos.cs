namespace StudyRoom.API.DTOs.Flashcards;

public class FlashcardDeckDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public int CardCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class FlashcardDto
{
    public Guid Id { get; set; }
    public string Front { get; set; } = "";
    public string Back { get; set; } = "";
}

public class FlashcardDeckDetailDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public List<FlashcardDto> Cards { get; set; } = new();
}

public class CreateFlashcardDeckDto
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
}

public class UpsertFlashcardsDto
{
    public List<FlashcardDto> Cards { get; set; } = new();
}

public class GenerateFlashcardsRequestDto
{
    public string Content { get; set; } = "";
    public int Count { get; set; } = 12;
    public string? Focus { get; set; }
}

public class GenerateFlashcardsResultDto
{
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public List<FlashcardDto> Cards { get; set; } = new();
    public string SuggestedTitle { get; set; } = "";
}