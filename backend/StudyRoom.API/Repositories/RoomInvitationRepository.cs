using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class RoomInvitationRepository : IRoomInvitationRepository
{
    private readonly AppDbContext _context;

    public RoomInvitationRepository(AppDbContext context) => _context = context;

    public async Task<RoomInvitation?> GetByIdAsync(Guid id) =>
        await _context.RoomInvitations
            .Include(i => i.Room)
            .Include(i => i.Inviter)
            .Include(i => i.Invitee)
            .FirstOrDefaultAsync(i => i.Id == id);

    public async Task<RoomInvitation?> GetPendingAsync(Guid roomId, Guid inviteeId) =>
        await _context.RoomInvitations.FirstOrDefaultAsync(i =>
            i.RoomId == roomId && i.InviteeId == inviteeId && i.Status == "Pending");

    public async Task<List<RoomInvitation>> GetIncomingAsync(Guid inviteeId) =>
        await _context.RoomInvitations
            .Where(i => i.InviteeId == inviteeId && i.Status == "Pending")
            .Include(i => i.Room)
            .Include(i => i.Inviter)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

    public async Task<List<RoomInvitation>> GetForRoomAsync(Guid roomId) =>
        await _context.RoomInvitations
            .Where(i => i.RoomId == roomId)
            .Include(i => i.Invitee)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

    public async Task AddAsync(RoomInvitation invitation)
    {
        await _context.RoomInvitations.AddAsync(invitation);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(RoomInvitation invitation)
    {
        _context.RoomInvitations.Update(invitation);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(RoomInvitation invitation)
    {
        _context.RoomInvitations.Remove(invitation);
        await _context.SaveChangesAsync();
    }
}
