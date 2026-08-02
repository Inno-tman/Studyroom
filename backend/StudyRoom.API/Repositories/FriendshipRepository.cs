using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class FriendshipRepository : IFriendshipRepository
{
    private readonly AppDbContext _context;

    public FriendshipRepository(AppDbContext context) => _context = context;

    public async Task<Friendship?> GetByIdAsync(Guid id) =>
        await _context.Friendships.FirstOrDefaultAsync(f => f.Id == id);

    public async Task<Friendship?> GetBetweenAsync(Guid userIdA, Guid userIdB) =>
        await _context.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == userIdA && f.AddresseeId == userIdB)
            || (f.RequesterId == userIdB && f.AddresseeId == userIdA));

    public async Task<List<Friendship>> GetFriendIdsAsync(Guid userId)
    {
        var accepted = await _context.Friendships
            .Where(f => f.Status == "Accepted" && (f.RequesterId == userId || f.AddresseeId == userId))
            .ToListAsync();
        return accepted;
    }

    public async Task<List<Friendship>> GetIncomingAsync(Guid userId) =>
        await _context.Friendships
            .Where(f => f.AddresseeId == userId && f.Status == "Pending")
            .Include(f => f.Requester)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

    public async Task<List<Friendship>> GetOutgoingAsync(Guid userId) =>
        await _context.Friendships
            .Where(f => f.RequesterId == userId && f.Status == "Pending")
            .Include(f => f.Addressee)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

    public async Task AddAsync(Friendship friendship)
    {
        await _context.Friendships.AddAsync(friendship);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Friendship friendship)
    {
        _context.Friendships.Update(friendship);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Friendship friendship)
    {
        _context.Friendships.Remove(friendship);
        await _context.SaveChangesAsync();
    }
}
