using System;
using System.Collections.Concurrent;

namespace StudyRoom.API.Services;

/// <summary>In-memory tracker of live SignalR connections per user (count-based, multi-tab/multi-device safe).</summary>
public class PresenceService : IPresenceService
{
    private readonly ConcurrentDictionary<Guid, int> _connections = new();

    public int Increment(Guid userId)
    {
        return _connections.AddOrUpdate(userId, 1, (_, current) => current + 1);
    }

    public int Decrement(Guid userId)
    {
        var remaining = _connections.AddOrUpdate(userId, 0, (_, current) => Math.Max(0, current - 1));
        if (remaining == 0)
            _connections.TryRemove(userId, out _);
        return remaining;
    }

    public bool IsOnline(Guid userId) => _connections.TryGetValue(userId, out var count) && count > 0;

    public int OnlineCount(Guid userId) => _connections.TryGetValue(userId, out var count) ? count : 0;
}