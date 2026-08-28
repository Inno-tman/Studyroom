using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using StudyRoom.API.Hubs;
using StudyRoom.API.Services;

namespace StudyRoom.API.Services;

/// <summary>
/// In-process scheduler that fires a study timer's completion (finalizes the
/// session, refreshes stats, and pushes a notification) at the scheduled
/// wall-clock end time, independent of whether the client tab is still open.
/// Timers are keyed by (user, room) so a user can run one focus timer per room.
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

    private readonly ConcurrentDictionary<string, Entry> _schedules = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private System.Timers.Timer? _timer;

    public TimerScheduler(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    private static string Key(Guid userId, Guid? roomId) => $"{userId}:{roomId?.ToString() ?? "*"}";

    public void ScheduleFocus(Guid userId, Guid? roomId, int durationMinutes) =>
        _schedules[Key(userId, roomId)] = new Entry
        {
            UserId = userId,
            RoomId = roomId,
            IsBreak = false,
            IsLong = false,
            EndTime = DateTime.UtcNow.AddMinutes(durationMinutes)
        };

    public void ScheduleBreak(Guid userId, Guid? roomId, int durationMinutes, bool isLong) =>
        _schedules[Key(userId, roomId)] = new Entry
        {
            UserId = userId,
            RoomId = roomId,
            IsBreak = true,
            IsLong = isLong,
            EndTime = DateTime.UtcNow.AddMinutes(durationMinutes)
        };

    public void Cancel(Guid userId, Guid? roomId = null)
    {
        if (roomId.HasValue)
        {
            _schedules.TryRemove(Key(userId, roomId), out _);
            return;
        }
        foreach (var key in _schedules.Keys.Where(k => k.StartsWith(userId + ":")))
            _schedules.TryRemove(key, out _);
    }

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
            var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
            var finalizer = scope.ServiceProvider.GetRequiredService<ISessionFinalizerService>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<TimerScheduler>>();

            if (!entry.IsBreak)
            {
                var finalized = await finalizer.FinalizeActiveAsync(entry.UserId, entry.RoomId);

                if (entry.RoomId.HasValue)
                {
                    await hub.Clients.Group("room_" + entry.RoomId.Value)
                        .SendAsync("TimerCompleted", new { roomId = entry.RoomId, completedBy = (string?)null });
                }

                await hub.Clients.User(entry.UserId.ToString())
                    .SendAsync("TimerEnded", new { phase = "focus", isLong = false });

                if (finalized != null)
                {
                    await notifications.CreateAsync(
                        entry.UserId, "timer", "Focus session complete",
                        "Nice work! Take a breather.", icon: "timer", link: "/dashboard");
                }
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
        catch (Exception ex)
        {
            // Best-effort: a failed notification must not crash the scheduler loop.
            try
            {
                using var errorScope = _scopeFactory.CreateScope();
                errorScope.ServiceProvider.GetRequiredService<ILogger<TimerScheduler>>()
                    .LogError(ex, "[timer-scheduler] FireAsync failed for user={UserId} isBreak={IsBreak} room={RoomId}", entry.UserId, entry.IsBreak, entry.RoomId);
            }
            catch { }
        }
    }

    public void Dispose() => _timer?.Dispose();
}