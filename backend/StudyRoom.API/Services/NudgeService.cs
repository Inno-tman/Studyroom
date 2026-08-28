using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public interface INudgeService
{
    Task SendDailyNudgesAsync();
    Task SendRoomQuietAlertsAsync();
    Task SendWeeklyAccountabilityPairingAsync();
    Task SendScheduleRemindersAsync();
}

public class NudgeService : INudgeService
{
    private readonly AppDbContext _context;
    private readonly IStudySessionRepository _sessionRepo;
    private readonly INotificationService _notificationService;
    private readonly ILogger<NudgeService> _logger;

    public NudgeService(
        AppDbContext context,
        IStudySessionRepository sessionRepo,
        INotificationService notificationService,
        ILogger<NudgeService> logger)
    {
        _context = context;
        _sessionRepo = sessionRepo;
        _notificationService = notificationService;
        _logger = logger;
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

    /// <summary>Start of the user's local calendar day, converted to UTC.</summary>
    private static DateTime LocalDayStartUtc(string? timeZoneId, DateTime utcNow)
    {
        var tz = ResolveTz(timeZoneId);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz);
        var localMidnight = localNow.Date;
        if (tz == TimeZoneInfo.Utc || localMidnight.Kind == DateTimeKind.Utc)
            return localMidnight;
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(localMidnight, DateTimeKind.Unspecified), tz);
    }

    /// <summary>
    /// Phase 5a — Smart Nudge: when it is ~8 PM in the user's own time zone, if
    /// there is no VERIFIED session today, send a personalized nudge with streak
    /// info. (Previously this fired at 8 PM UTC for everyone and counted any
    /// completed session, so it nudged users who had already studied.)
    /// </summary>
    public async Task SendDailyNudgesAsync()
    {
        var nowUtc = DateTime.UtcNow;
        var users = await _context.Users.ToListAsync();

        foreach (var user in users)
        {
            var tz = ResolveTz(user.TimeZoneId);
            var localNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz);
            if (localNow.Hour != 20) continue;

            var dayStartUtc = LocalDayStartUtc(user.TimeZoneId, nowUtc);
            var studiedToday = await _context.StudySessions
                .AnyAsync(s => s.UserId == user.Id && s.Completed && s.IsVerified && s.CreatedAt >= dayStartUtc);

            if (studiedToday) continue;

            var streak = await _sessionRepo.GetCurrentStreakAsync(user.Id);
            var totalMinutes = await _sessionRepo.GetTotalStudyMinutesAsync(user.Id);

            string body;
            if (streak > 0)
            {
                body = $"You have a {streak}-day streak going! Don't break it — even 15 minutes counts.";
            }
            else if (totalMinutes > 0)
            {
                body = "You haven't studied today. Jump into a room and keep the momentum going!";
            }
            else
            {
                body = "Ready to start your study journey? Join a room and begin your first session!";
            }

            await _notificationService.CreateAsync(
                user.Id,
                "nudge",
                "Don't forget to study today",
                body,
                icon: "notifications_active",
                link: "/rooms");

            _logger.LogInformation("[nudge] Sent daily nudge to user {UserId}", user.Id);
        }
    }

    /// <summary>
    /// Phase 5b — Room Quiet Alert: at the room host's local quiet hours (every
    /// 6h), if the room has had no verified sessions in 24h, notify the host.
    /// </summary>
    public async Task SendRoomQuietAlertsAsync()
    {
        var nowUtc = DateTime.UtcNow;
        var cutoff = nowUtc.AddHours(-24);

        var rooms = await _context.Rooms.ToListAsync();
        var hostIds = rooms.Select(r => r.CreatedBy).Distinct().ToList();
        var hosts = await _context.Users
            .Where(u => hostIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        foreach (var room in rooms)
        {
            var hostTz = hosts.TryGetValue(room.CreatedBy, out var host)
                ? ResolveTz(host.TimeZoneId)
                : TimeZoneInfo.Utc;
            var localNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, hostTz);
            if (localNow.Hour % 6 != 0) continue;

            var hadActivity = await _context.StudySessions
                .AnyAsync(s => s.RoomId == room.Id && s.Completed && s.IsVerified && s.CreatedAt >= cutoff);

            if (hadActivity) continue;

            // notify the room host
            await _notificationService.CreateAsync(
                room.CreatedBy,
                "social",
                $"Your room \"{room.Name}\" is quiet",
                $"No one has studied in {room.Name} for 24 hours. Start a session to get things going!",
                icon: "campaign",
                link: $"/rooms/{room.Id}");

            _logger.LogInformation("[nudge] Sent quiet alert for room {RoomId}", room.Id);
        }
    }

    /// <summary>
    /// Phase 5c — Weekly Accountability Pairing: On Mondays, pair users who share
    /// rooms but aren't already friends, and suggest they study together.
    /// </summary>
    public async Task SendWeeklyAccountabilityPairingAsync()
    {
        var cutoff = DateTime.UtcNow.AddDays(-7);

        // Find users who were active this week
        var activeUserIds = await _context.StudySessions
            .Where(s => s.Completed && s.IsVerified && s.CreatedAt >= cutoff)
            .Select(s => s.UserId)
            .Distinct()
            .ToListAsync();

        if (activeUserIds.Count < 2) return;

        // Find room memberships for active users
        var memberships = await _context.RoomMembers
            .Where(rm => activeUserIds.Contains(rm.UserId))
            .GroupBy(rm => rm.RoomId)
            .Where(g => g.Count() >= 2)
            .Select(g => new { RoomId = g.Key, UserIds = g.Select(rm => rm.UserId).ToList() })
            .ToListAsync();

        var alreadyNotified = new HashSet<string>();

        foreach (var room in memberships)
        {
            for (int i = 0; i < room.UserIds.Count; i++)
            {
                for (int j = i + 1; j < room.UserIds.Count; j++)
                {
                    var a = room.UserIds[i];
                    var b = room.UserIds[j];
                    var pairKey = string.Compare(a.ToString(), b.ToString()) < 0
                        ? $"{a}:{b}" : $"{b}:{a}";

                    if (alreadyNotified.Contains(pairKey)) continue;
                    alreadyNotified.Add(pairKey);

                    // Check if they're already friends
                    var alreadyFriends = await _context.Friendships.AnyAsync(f =>
                        f.Status == "Accepted" &&
                        ((f.RequesterId == a && f.AddresseeId == b) ||
                         (f.RequesterId == b && f.AddresseeId == a)));

                    if (alreadyFriends) continue;

                    var roommate = await _context.Users.FindAsync(b);
                    if (roommate == null) continue;

                    await _notificationService.CreateAsync(
                        a,
                        "social",
                        "Accountability partner suggestion",
                        $"You and {roommate.Username} both study actively. Consider pairing up for accountability!",
                        icon: "handshake",
                        link: "/rooms/" + room.RoomId);
                }
            }
        }

        _logger.LogInformation("[nudge] Sent {Count} accountability pairings", alreadyNotified.Count);
    }

    /// <summary>
    /// Phase 13a — Schedule-based reminders: check users' PreferredStudyDays/Hours
    /// and send a reminder 30 minutes before their preferred study window starts.
    /// </summary>
    public async Task SendScheduleRemindersAsync()
    {
        var nowUtc = DateTime.UtcNow;

        var users = await _context.Users
            .Where(u => u.PreferredStudyDays != null && u.PreferredStudyHours != null)
            .ToListAsync();

        foreach (var user in users)
        {
            var tz = ResolveTz(user.TimeZoneId);
            var localNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz);
            var dayNames = new[] { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
            var today = dayNames[(int)localNow.DayOfWeek];
            var currentMinutes = localNow.Hour * 60 + localNow.Minute;

            var days = (user.PreferredStudyDays ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries);
            if (!days.Contains(today)) continue;

            var windows = (user.PreferredStudyHours ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries);
            foreach (var window in windows)
            {
                var parts = window.Split('-', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length != 2) continue;
                if (!TimeSpan.TryParse(parts[0], out var start) || !TimeSpan.TryParse(parts[1], out var end)) continue;

                var startMinutes = (int)start.TotalMinutes;
                var reminderMinutes = startMinutes - 30;

                // Send reminder if we're within 5 minutes of the reminder time.
                if (currentMinutes >= reminderMinutes && currentMinutes <= reminderMinutes + 5)
                {
                    // Check if user already studied today (verified sessions only).
                    var dayStartUtc = LocalDayStartUtc(user.TimeZoneId, nowUtc);
                    var studiedToday = await _context.StudySessions.AnyAsync(s =>
                        s.UserId == user.Id && s.Completed && s.IsVerified &&
                        s.CreatedAt >= dayStartUtc);

                    if (!studiedToday)
                    {
                        await _notificationService.CreateAsync(
                            user.Id,
                            "reminder",
                            "Study time approaching!",
                            $"Your study session starts at {parts[0].Trim()}. Ready to focus?",
                            icon: "alarm",
                            link: "/rooms");
                    }
                }
            }
        }
    }
}

public class NudgeWorker : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<NudgeWorker> _logger;

    public NudgeWorker(IServiceProvider services, ILogger<NudgeWorker> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Run all nudge checks hourly; each service decides based on each
        // user's local time whether to actually send.
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;

            try
            {
                using var scope = _services.CreateScope();
                var nudgeService = scope.ServiceProvider.GetRequiredService<INudgeService>();

                // Daily nudge fires when it's ~8 PM in the user's time zone.
                await nudgeService.SendDailyNudgesAsync();

                // Room quiet alerts fire at the host's local 0, 6, 12, 18.
                await nudgeService.SendRoomQuietAlertsAsync();

                // Accountability pairing on Mondays at 9 AM UTC.
                if (now.DayOfWeek == DayOfWeek.Monday && now.Hour == 9)
                {
                    await nudgeService.SendWeeklyAccountabilityPairingAsync();
                }

                // Schedule reminders every hour, evaluated in the user's time zone.
                await nudgeService.SendScheduleRemindersAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[nudge] Error running nudge checks");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
