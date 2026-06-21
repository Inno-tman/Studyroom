using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class AiConversationRepository : IAiConversationRepository
{
    private readonly AppDbContext _db;

    public AiConversationRepository(AppDbContext db) => _db = db;

    public async Task<AiConversation> CreateConversationAsync(Guid userId, string? roomId, string? subject, bool isResearchMode, string? phase)
    {
        var conv = new AiConversation
        {
            UserId = userId,
            RoomId = roomId,
            Subject = subject,
            IsResearchMode = isResearchMode,
            CurrentPhase = phase
        };
        _db.AiConversations.Add(conv);
        await _db.SaveChangesAsync();
        return conv;
    }

    public async Task<AiMessage> AddMessageAsync(Guid conversationId, string role, string content, string? referencesJson)
    {
        var msg = new AiMessage
        {
            ConversationId = conversationId,
            Role = role,
            Content = content,
            ReferencesJson = referencesJson
        };
        _db.AiMessages.Add(msg);

        var conv = await _db.AiConversations.FindAsync(conversationId);
        if (conv != null) conv.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return msg;
    }

    public async Task<List<AiConversation>> GetUserConversationsAsync(Guid userId, int limit = 10)
    {
        return await _db.AiConversations
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<AiConversation?> GetConversationWithMessagesAsync(Guid conversationId)
    {
        return await _db.AiConversations
            .Include(c => c.Messages.OrderBy(m => m.CreatedAt))
            .FirstOrDefaultAsync(c => c.Id == conversationId);
    }

    public async Task DeleteConversationAsync(Guid conversationId)
    {
        var conv = await _db.AiConversations.FindAsync(conversationId);
        if (conv != null)
        {
            _db.AiConversations.Remove(conv);
            await _db.SaveChangesAsync();
        }
    }

    public async Task UpdatePhaseAsync(Guid conversationId, string phase)
    {
        var conv = await _db.AiConversations.FindAsync(conversationId);
        if (conv != null)
        {
            conv.CurrentPhase = phase;
            conv.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    public async Task ClearConversationMessagesAsync(Guid conversationId)
    {
        var msgs = await _db.AiMessages.Where(m => m.ConversationId == conversationId).ToListAsync();
        _db.AiMessages.RemoveRange(msgs);
        var conv = await _db.AiConversations.FindAsync(conversationId);
        if (conv != null)
        {
            conv.CurrentPhase = null;
            conv.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();
    }
}
