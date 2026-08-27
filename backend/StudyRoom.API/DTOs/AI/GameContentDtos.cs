namespace StudyRoom.API.DTOs.AI;

public class GameContentRequestDto
{
    public string Game { get; set; } = string.Empty;

    public int Count { get; set; } = 10;

    public string? Topic { get; set; }

    public string? Difficulty { get; set; }
}

public class GameContentDto
{
    public bool Ok { get; set; }

    public string? Error { get; set; }

    public string? Topic { get; set; }

    public string? Difficulty { get; set; }

    public List<GameQuizItemDto> Quiz { get; set; } = new();

    public List<GameTrueFalseItemDto> TrueFalse { get; set; } = new();

    public List<GameMemoryItemDto> Memory { get; set; } = new();

    public List<string> Words { get; set; } = new();

    public List<GameMathItemDto> Math { get; set; } = new();
}

public class GameQuizItemDto
{
    public string Question { get; set; } = string.Empty;

    public List<string> Options { get; set; } = new();

    public int Answer { get; set; }

    public string? Category { get; set; }
}

public class GameTrueFalseItemDto
{
    public string Statement { get; set; } = string.Empty;

    public bool IsTrue { get; set; }
}

public class GameMemoryItemDto
{
    public string Term { get; set; } = string.Empty;

    public string Definition { get; set; } = string.Empty;
}

public class GameMathItemDto
{
    public string Text { get; set; } = string.Empty;

    public double Answer { get; set; }
}