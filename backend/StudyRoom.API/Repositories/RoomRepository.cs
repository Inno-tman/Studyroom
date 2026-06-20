using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class RoomRepository : IRoomRepository
{
    private readonly AppDbContext _context;

    public RoomRepository(AppDbContext context) => _context = context;

    public async Task<List<Room>> GetAllAsync(string? search, string? subject)
    {
        var query = _context.Rooms
            .Include(r => r.Creator)
            .Include(r => r.Members)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(r => r.Name.Contains(search) || (r.Description != null && r.Description.Contains(search)));

        if (!string.IsNullOrWhiteSpace(subject))
            query = query.Where(r => r.Subject == subject);

        return await query.OrderByDescending(r => r.CreatedAt).ToListAsync();
    }

    public async Task<Room?> GetByIdAsync(Guid id) =>
        await _context.Rooms
            .Include(r => r.Creator)
            .Include(r => r.Members)
            .FirstOrDefaultAsync(r => r.Id == id);

    public async Task<List<Room>> GetRecentRoomsAsync(Guid userId, int count = 5) =>
        await _context.RoomMembers
            .Where(rm => rm.UserId == userId)
            .Include(rm => rm.Room).ThenInclude(r => r.Creator)
            .Include(rm => rm.Room).ThenInclude(r => r.Members)
            .OrderByDescending(rm => rm.JoinedAt)
            .Select(rm => rm.Room!)
            .Take(count)
            .ToListAsync();

    public async Task AddAsync(Room room)
    {
        await _context.Rooms.AddAsync(room);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Room room)
    {
        _context.Rooms.Update(room);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Room room)
    {
        _context.Rooms.Remove(room);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> IsMemberAsync(Guid roomId, Guid userId) =>
        await _context.RoomMembers.AnyAsync(rm => rm.RoomId == roomId && rm.UserId == userId);

    public async Task AddMemberAsync(RoomMember member)
    {
        await _context.RoomMembers.AddAsync(member);
        await _context.SaveChangesAsync();
    }

    public async Task RemoveMemberAsync(Guid roomId, Guid userId)
    {
        var member = await _context.RoomMembers.FirstOrDefaultAsync(rm => rm.RoomId == roomId && rm.UserId == userId);
        if (member != null)
        {
            _context.RoomMembers.Remove(member);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<List<User>> GetMembersAsync(Guid roomId) =>
        await _context.RoomMembers
            .Where(rm => rm.RoomId == roomId)
            .Include(rm => rm.User)
            .Select(rm => rm.User!)
            .ToListAsync();

    public async Task<int> GetMemberCountAsync(Guid roomId) =>
        await _context.RoomMembers.CountAsync(rm => rm.RoomId == roomId);

    public async Task<RoomMember?> GetMembershipAsync(Guid roomId, Guid userId) =>
        await _context.RoomMembers.FirstOrDefaultAsync(rm => rm.RoomId == roomId && rm.UserId == userId);

    public async Task<List<Room>> GetUserRoomsAsync(Guid userId) =>
        await _context.RoomMembers
            .Where(rm => rm.UserId == userId)
            .Include(rm => rm.Room).ThenInclude(r => r.Creator)
            .Include(rm => rm.Room).ThenInclude(r => r.Members)
            .Select(rm => rm.Room!)
            .ToListAsync();
}
