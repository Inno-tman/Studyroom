namespace StudyRoom.API.DTOs.Statistics;

public class UserStatsDto
{
    public decimal TotalStudyMinutes { get; set; }
    public int SessionsCompleted { get; set; }
    public int DailyStreak { get; set; }
    public decimal WeeklyStudyMinutes { get; set; }
}
