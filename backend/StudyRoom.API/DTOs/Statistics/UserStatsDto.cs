namespace StudyRoom.API.DTOs.Statistics;

public class UserStatsDto
{
    public decimal TotalStudyHours { get; set; }
    public int SessionsCompleted { get; set; }
    public int DailyStreak { get; set; }
    public decimal WeeklyStudyMinutes { get; set; }
    public decimal WeeklyStudyHours { get; set; }
}
