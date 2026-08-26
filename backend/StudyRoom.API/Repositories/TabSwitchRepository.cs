using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface ITabSwitchRepository
{
    Task AddEventAsync(TabSwitchEvent evt);
    Task<int> GetSwitchCountAsync(Guid sessionId);
    Task<int> GetAwayCountAsync(Guid sessionId);
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
}
