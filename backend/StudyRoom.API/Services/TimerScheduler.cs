using System.Collections.Concurrent;
using System.Timers;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using StudyRoom.API.Hubs;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

/// <summary>
/// In-process scheduler that fires a study timer's completion (marks the session,
/// refreshes stats, and pushes a notification) at the scheduled wall-clock end time,
/// independent of whether the client tab is still open.
/// </summary>
public class TimerScheduler : ITimerScheduler, IHostedService, IDisposable
{
    private class Entry
    {
        public Guid UserId { get; set; }
        public Guid? RoomId { get; set; }
        public bool IsBreak { get; set; }
        public bool IsLong { get; set; }
        public DateTime EndTime { get; set; }
    }

    private readonly ConcurrentDictionary<Guid, Entry> _schedules = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private System.Timers.Timer? _timer;

    public TimerScheduler(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    public void ScheduleFocus(Guid userId, Guid? roomId, int durationMinutes) =>
        _schedules[userId] = new Entry
        {
            UserId = userId,
            RoomId = roomId,
            IsBreak = false,
            IsLong = false,
            EndTime = DateTime.UtcNow.AddMinutes(durationMinutes)
        };

    public void ScheduleBreak(Guid userId, Guid? roomId, int durationMinutes, bool isLong) =>
        _schedules[userId] = new Entry
        {
            UserId = userId,
            RoomId = roomId,
            IsBreak = true,
            IsLong = isLong,
            EndTime = DateTime.UtcNow.AddMinutes(durationMinutes)
        };

    public void Cancel(Guid userId) => _schedules.TryRemove(userId, out _);

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _timer = new System.Timers.Timer(1000);
        _timer.Elapsed += (_, _) => ProcessDue();
        _timer.AutoReset = true;
        _timer.Start();
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _timer?.Stop();
        return Task.CompletedTask;
    }

    private void ProcessDue()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _schedules)
        {
            if (kvp.Value.EndTime <= now && _schedules.TryRemove(kvp.Key, out var entry))
            {
                _ = FireAsync(entry);
            }
        }
    }

    private async Task FireAsync(Entry entry)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var hub = scope.ServiceProvider.GetRequiredService<IHubContext<StudyRoomHub>>();
            var sessionRepo = scope.ServiceProvider.GetRequiredService<IStudySessionRepository>();
            var statsRepo = scope.ServiceProvider.GetRequiredService<IUserStatsRepository>();
            var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

            if (!entry.IsBreak)
            {
                // Mark the latest in-progress focus session complete and refresh stats,
                // so study time + streak stay accurate even if the tab was closed.
                var sessions = await sessionRepo.GetByUserIdAsync(entry.UserId);
                var latest = sessions.FirstOrDefault(s => !s.Completed);
                if (latest != null)
                {
                    latest.Completed = true;
                    await sessionRepo.UpdateAsync(latest);
                    await statsRepo.RefreshAsync(entry.UserId);
                }

                if (entry.RoomId.HasValue)
                {
                    await hub.Clients.Group("room_" + entry.RoomId.Value)
                        .SendAsync("TimerCompleted", new { roomId = entry.RoomId, completedBy = (string?)null });
                }

                await hub.Clients.User(entry.UserId.ToString())
                    .SendAsync("TimerEnded", new { phase = "focus", isLong = false });

                await notifications.CreateAsync(
                    entry.UserId, "timer", "Focus session complete",
                    "Nice work! Take a breather.", icon: "timer", link: "/dashboard");
            }
            else
            {
                await hub.Clients.User(entry.UserId.ToString())
                    .SendAsync("TimerEnded", new { phase = "break", isLong = entry.IsLong });

                await notifications.CreateAsync(
                    entry.UserId,
                    "timer",
                    entry.IsLong ? "Long break complete" : "Break complete",
                    "Time to get back to focus.", icon: "timer", link: "/dashboard");
            }
        }
        catch
        {
            // Best-effort: a failed notification must not crash the scheduler loop.
        }
    }

    public void Dispose() => _timer?.Dispose();
}
