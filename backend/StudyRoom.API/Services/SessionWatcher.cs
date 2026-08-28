using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

namespace StudyRoom.API.Services;

/// <summary>
/// Periodically checks for orphaned focus sessions (user closed tab without
/// finalizing) and auto-completes them with actual elapsed time.
/// </summary>
public class SessionWatcher : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SessionWatcher> _logger;

    public SessionWatcher(IServiceScopeFactory scopeFactory, ILogger<SessionWatcher> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                await FinalizeStaleSessionsAsync();
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[session-watcher] error during sweep");
            }
        }
    }

    private async Task FinalizeStaleSessionsAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var sessionRepo = scope.ServiceProvider.GetRequiredService<IStudySessionRepository>();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var stale = await sessionRepo.GetStaleSessionsAsync(DateTime.UtcNow.AddHours(-6));

        foreach (var session in stale)
        {
            var start = session.StartedAt ?? session.CreatedAt;
            var elapsed = (DateTime.UtcNow - start).TotalMinutes;
            var minutes = Math.Round((decimal)Math.Max(0, elapsed), 2);

            // Atomic claim: only this sweep flips the session if it is still open.
            var claimed = await context.StudySessions
                .Where(s => s.Id == session.Id && !s.Completed)
                .ExecuteUpdateAsync(set => set
                    .SetProperty(s => s.Completed, true)
                    .SetProperty(s => s.DurationMinutes, minutes)
                    .SetProperty(s => s.IsVerified, false)
                    .SetProperty(s => s.VerifiedReason, "idle_timeout")
                    .SetProperty(s => s.AwardProcessed, true));
            if (claimed == 0) continue;

            _logger.LogInformation("[session-watcher] auto-finalized session {SessionId} user={UserId} elapsed={Minutes}m",
                session.Id, session.UserId, minutes);

            await notifications.CreateAsync(
                session.UserId, "timer", "Session auto-finalized",
                $"Your focus session was auto-finalized after {Math.Round((double)minutes)} minutes (you were away).",
                icon: "timer", link: "/dashboard");
        }
    }
}
