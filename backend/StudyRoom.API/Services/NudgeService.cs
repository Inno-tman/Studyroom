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

    /// <summary>
    /// Phase 5a — Smart Nudge: At 8 PM UTC, check if each user has studied today.
    /// If not, send a personalized nudge with streak info.
    /// </summary>
    public async Task SendDailyNudgesAsync()
    {
        var today = DateTime.UtcNow.Date;
        var users = await _context.Users.ToListAsync();

        foreach (var user in users)
        {
            var studiedToday = await _context.StudySessions
                .AnyAsync(s => s.UserId == user.Id && s.Completed && s.CreatedAt >= today);

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
    /// Phase 5b — Room Quiet Alert: If a room has had no verified sessions in 24h,
    /// notify its host.
    /// </summary>
    public async Task SendRoomQuietAlertsAsync()
    {
        var cutoff = DateTime.UtcNow.AddHours(-24);

        var rooms = await _context.Rooms.ToListAsync();

        foreach (var room in rooms)
        {
            var hadActivity = await _context.StudySessions
                .AnyAsync(s => s.RoomId == room.Id && s.Completed && s.CreatedAt >= cutoff);

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
        var now = DateTime.UtcNow;
        var dayNames = new[] { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
        var today = dayNames[(int)now.DayOfWeek];
        var currentMinutes = now.Hour * 60 + now.Minute;

        var users = await _context.Users
            .Where(u => u.PreferredStudyDays != null && u.PreferredStudyHours != null)
            .ToListAsync();

        foreach (var user in users)
        {
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

                // Send reminder if we're within 5 minutes of the reminder time
                if (currentMinutes >= reminderMinutes && currentMinutes <= reminderMinutes + 5)
                {
                    // Check if user already studied today
                    var studiedToday = await _context.StudySessions.AnyAsync(s =>
                        s.UserId == user.Id && s.Completed && s.IsVerified &&
                        s.CreatedAt.Date == now.Date);

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
        // Run nudge checks every hour; the service itself decides whether to send
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;

            try
            {
                using var scope = _services.CreateScope();
                var nudgeService = scope.ServiceProvider.GetRequiredService<INudgeService>();

                // Daily nudge at 8 PM UTC
                if (now.Hour == 20)
                {
                    await nudgeService.SendDailyNudgesAsync();
                }

                // Room quiet alerts every 6 hours (0, 6, 12, 18)
                if (now.Hour % 6 == 0)
                {
                    await nudgeService.SendRoomQuietAlertsAsync();
                }

                // Accountability pairing on Mondays at 9 AM UTC
                if (now.DayOfWeek == DayOfWeek.Monday && now.Hour == 9)
                {
                    await nudgeService.SendWeeklyAccountabilityPairingAsync();
                }

                // Schedule reminders every hour
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
