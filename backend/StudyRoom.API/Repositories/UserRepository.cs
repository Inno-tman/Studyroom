using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _context;

    public UserRepository(AppDbContext context) => _context = context;

    public async Task<User?> GetByIdAsync(Guid id) =>
        await _context.Users.FindAsync(id);

    public async Task<User?> GetByUsernameAsync(string username) =>
        await _context.Users.FirstOrDefaultAsync(u => u.Username == username);

    public async Task<User?> GetByEmailAsync(string email) =>
        await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

    public async Task<User?> GetByRefreshTokenAsync(string refreshToken) =>
        await _context.Users.FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);

    public async Task AddAsync(User user)
    {
        await _context.Users.AddAsync(user);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(User user)
    {
        _context.Users.Update(user);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> UsernameExistsAsync(string username) =>
        await _context.Users.AnyAsync(u => u.Username == username);

    public async Task<bool> EmailExistsAsync(string email) =>
        await _context.Users.AnyAsync(u => u.Email == email);

    public async Task<List<User>> SearchAsync(string query, Guid excludeId)
    {
        var q = query.Trim();
        return await _context.Users
            .Where(u => u.Id != excludeId)
            .Where(u =>
                u.Username.ToLower().Contains(q.ToLower())
                || u.Email.ToLower().Contains(q.ToLower())
                || (u.FirstName != null && u.FirstName.ToLower().Contains(q.ToLower()))
                || (u.LastName != null && u.LastName.ToLower().Contains(q.ToLower()))
                || (u.SchoolName != null && u.SchoolName.ToLower().Contains(q.ToLower())))
            .OrderBy(u => u.Username)
            .Take(50)
            .ToListAsync();
    }

    public async Task<List<User>> GetAllAsync() => await _context.Users.AsNoTracking().ToListAsync();
}
