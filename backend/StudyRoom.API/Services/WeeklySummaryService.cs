using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public interface IWeeklySummaryService
{
    Task GenerateSummaryAsync(Guid userId);
}

public class WeeklySummaryService : IWeeklySummaryService
{
    private readonly AppDbContext _context;
    private readonly IStudySessionRepository _sessionRepo;
    private readonly INotificationService _notificationService;

    public WeeklySummaryService(
        AppDbContext context,
        IStudySessionRepository sessionRepo,
        INotificationService notificationService)
    {
        _context = context;
        _sessionRepo = sessionRepo;
        _notificationService = notificationService;
    }

    public async Task GenerateSummaryAsync(Guid userId)
    {
        var minutes = await _sessionRepo.GetWeeklyStudyMinutesAsync(userId);
        var sessions = await _context.StudySessions
            .CountAsync(s => s.UserId == userId && s.Completed && s.IsVerified
                && s.CreatedAt >= DateTime.UtcNow.AddDays(-7));
        var streak = await _sessionRepo.GetCurrentStreakAsync(userId);

        var topRoomQuery = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified
                && s.CreatedAt >= DateTime.UtcNow.AddDays(-7))
            .GroupBy(s => s.RoomId)
            .OrderByDescending(g => g.Sum(s => s.DurationMinutes))
            .Select(g => new { RoomId = g.Key, Minutes = g.Sum(s => s.DurationMinutes) })
            .FirstOrDefaultAsync();

        string? topRoomName = null;
        if (topRoomQuery != null)
        {
            var room = await _context.Rooms.FindAsync(topRoomQuery.RoomId);
            topRoomName = room?.Name;
        }

        var hours = Math.Floor(minutes / 60);
        var mins = Math.Round(minutes % 60);

        var body = $"You studied {hours}h {mins}m across {sessions} sessions this week." +
                   (streak > 0 ? $" Current streak: {streak} days." : "") +
                   (topRoomName != null ? $" Most active in: {topRoomName}." : "");

        await _notificationService.CreateAsync(
            userId,
            "weekly_summary",
            "Weekly Study Summary",
            body,
            icon: "bar_chart",
            link: "/dashboard");
    }
}

public class WeeklySummaryWorker : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<WeeklySummaryWorker> _logger;

    public WeeklySummaryWorker(IServiceProvider services, ILogger<WeeklySummaryWorker> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Hourly sweep: each user gets their summary when it reaches Sunday at
        // 20:00 in their own time zone (instead of one global Sunday 20:00 UTC).
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _services.CreateScope();
                var summaryService = scope.ServiceProvider.GetRequiredService<IWeeklySummaryService>();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var users = await context.Users
                    .Select(u => new { u.Id, u.TimeZoneId })
                    .ToListAsync(stoppingToken);

                var nowUtc = DateTime.UtcNow;
                foreach (var user in users)
                {
                    var tz = ResolveTz(user.TimeZoneId);
                    var localNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz);
                    if (localNow.DayOfWeek != DayOfWeek.Sunday || localNow.Hour != 20) continue;

                    // Guard against duplicate summaries (e.g. after a restart
                    // within the same delivery hour).
                    var alreadySent = await context.Notifications.AnyAsync(n =>
                        n.UserId == user.Id && n.Type == "weekly_summary" && n.CreatedAt >= nowUtc.AddHours(-24), stoppingToken);
                    if (alreadySent) continue;

                    await summaryService.GenerateSummaryAsync(user.Id);
                }
                _logger.LogInformation("[weekly-summary] Sweep complete for {Count} users", users.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[weekly-summary] Failed to send summaries");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private static TimeZoneInfo ResolveTz(string? timeZoneId)
    {
        if (!string.IsNullOrWhiteSpace(timeZoneId))
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }
}
