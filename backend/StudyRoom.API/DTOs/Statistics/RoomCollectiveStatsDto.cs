namespace StudyRoom.API.DTOs.Statistics;

public class RoomCollectiveStatsDto
{
    public decimal TotalMinutes { get; set; }
    public int TotalSessions { get; set; }
    public int MemberCount { get; set; }
    public decimal GoalMinutes { get; set; }
    public decimal Progress => GoalMinutes > 0 ? Math.Min(100, TotalMinutes / GoalMinutes * 100) : 0;
}
