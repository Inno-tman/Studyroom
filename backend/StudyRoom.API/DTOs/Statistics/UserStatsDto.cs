namespace StudyRoom.API.DTOs.Statistics;

public class UserStatsDto
{
    public int TotalStudyHours { get; set; }
    public int SessionsCompleted { get; set; }
    public int DailyStreak { get; set; }
    public int WeeklyStudyMinutes { get; set; }
}
