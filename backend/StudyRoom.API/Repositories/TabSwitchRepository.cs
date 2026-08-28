using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface ITabSwitchRepository
{
    Task AddEventAsync(TabSwitchEvent evt);
    Task<int> GetSwitchCountAsync(Guid sessionId);
    Task<int> GetAwayCountAsync(Guid sessionId);
    /// <summary>Completed distractions: a "left" that is matched by a later "returned".</summary>
    Task<int> GetRoundTripsAsync(Guid sessionId);
}

public class TabSwitchRepository : ITabSwitchRepository
{
    private readonly AppDbContext _context;

    public TabSwitchRepository(AppDbContext context) => _context = context;

    public async Task AddEventAsync(TabSwitchEvent evt)
    {
        await _context.TabSwitchEvents.AddAsync(evt);
        await _context.SaveChangesAsync();
    }

    public async Task<int> GetSwitchCountAsync(Guid sessionId) =>
        await _context.TabSwitchEvents
            .CountAsync(e => e.SessionId == sessionId && e.EventType == "left");

    public async Task<int> GetAwayCountAsync(Guid sessionId) =>
        await _context.TabSwitchEvents
            .CountAsync(e => e.SessionId == sessionId);

    public async Task<int> GetRoundTripsAsync(Guid sessionId)
    {
        var events = await _context.TabSwitchEvents
            .Where(e => e.SessionId == sessionId)
            .OrderBy(e => e.OccurredAt)
            .Select(e => e.EventType)
            .ToListAsync();

        int roundTrips = 0;
        bool away = false;
        foreach (var type in events)
        {
            if (type == "left" && !away)
            {
                away = true;
            }
            else if (type == "returned" && away)
            {
                roundTrips++;
                away = false;
            }
        }
        return roundTrips;
    }
}
