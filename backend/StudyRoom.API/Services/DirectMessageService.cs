using StudyRoom.API.DTOs.Social;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class DirectMessageService : IDirectMessageService
{
    private readonly IDirectMessageRepository _dmRepo;
    private readonly IFriendshipRepository _friendRepo;
    private readonly IUserRepository _userRepo;

    public DirectMessageService(
        IDirectMessageRepository dmRepo,
        IFriendshipRepository friendRepo,
        IUserRepository userRepo)
    {
        _dmRepo = dmRepo;
        _friendRepo = friendRepo;
        _userRepo = userRepo;
    }

    public async Task<DirectMessageDto> SendAsync(Guid senderId, Guid receiverId, string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            throw new InvalidOperationException("Message content is required.");

        if (senderId == receiverId)
            throw new InvalidOperationException("You cannot message yourself.");

        var receiver = await _userRepo.GetByIdAsync(receiverId)
            ?? throw new KeyNotFoundException("User not found.");

        var friendship = await _friendRepo.GetBetweenAsync(senderId, receiverId);
        if (friendship == null || friendship.Status != "Accepted")
            throw new UnauthorizedAccessException("You can only message friends.");

        var message = await _dmRepo.AddAsync(new DirectMessage
        {
            SenderId = senderId,
            ReceiverId = receiverId,
            Content = content.Trim()
        });

        return new DirectMessageDto
        {
            Id = message.Id,
            SenderId = senderId,
            SenderName = "",
            ReceiverId = receiverId,
            Content = message.Content,
            CreatedAt = message.CreatedAt
        };
    }

    public async Task<List<DirectMessageDto>> GetConversationAsync(Guid userA, Guid userB)
    {
        var messages = await _dmRepo.GetConversationAsync(userA, userB);
        await _dmRepo.MarkReadAsync(userA, userB);
        return messages.Select(Map).ToList();
    }

    public async Task<List<ConversationDto>> GetConversationsAsync(Guid userId)
    {
        var recent = await _dmRepo.GetRecentAsync(userId);
        var grouped = recent
            .GroupBy(m => m.SenderId == userId ? m.ReceiverId : m.SenderId)
            .OrderByDescending(g => g.Max(m => m.CreatedAt))
            .ToList();

        var unreadMap = recent
            .Where(m => m.ReceiverId == userId && !m.IsRead)
            .GroupBy(m => m.SenderId)
            .ToDictionary(g => g.Key, g => g.Count());

        var result = new List<ConversationDto>();
        var seen = new HashSet<Guid>();

        foreach (var group in grouped)
        {
            var otherUserId = group.Key;
            if (otherUserId == userId) continue;

            var other = await _userRepo.GetByIdAsync(otherUserId);
            if (other == null) continue;

            seen.Add(otherUserId);
            var last = group.First();
            result.Add(new ConversationDto
            {
                UserId = other.Id,
                DisplayName = BuildDisplayName(other),
                Username = other.Username,
                AvatarUrl = other.AvatarUrl,
                LastMessage = last.Content,
                LastMessageAt = last.CreatedAt,
                UnreadCount = unreadMap.GetValueOrDefault(otherUserId)
            });
        }

        var friendships = await _friendRepo.GetFriendIdsAsync(userId);
        foreach (var rel in friendships)
        {
            var friendId = rel.RequesterId == userId ? rel.AddresseeId : rel.RequesterId;
            if (seen.Contains(friendId)) continue;

            var friend = await _userRepo.GetByIdAsync(friendId);
            if (friend == null) continue;

            seen.Add(friendId);
            result.Add(new ConversationDto
            {
                UserId = friend.Id,
                DisplayName = BuildDisplayName(friend),
                Username = friend.Username,
                AvatarUrl = friend.AvatarUrl,
                LastMessage = string.Empty,
                LastMessageAt = DateTime.MinValue
            });
        }

        return result.OrderByDescending(c => c.LastMessageAt).ToList();
    }

    public async Task<int> GetUnreadCountAsync(Guid userId) =>
        await _dmRepo.GetUnreadCountAsync(userId);

    public async Task DeleteAsync(Guid messageId, Guid userId)
    {
        var message = await _dmRepo.GetByIdAsync(messageId)
            ?? throw new KeyNotFoundException("Message not found.");

        if (message.SenderId != userId && message.ReceiverId != userId)
            throw new UnauthorizedAccessException("Not allowed to delete this message.");

        await _dmRepo.DeleteAsync(messageId);
    }

    private static DirectMessageDto Map(DirectMessage m) => new()
    {
        Id = m.Id,
        SenderId = m.SenderId,
        SenderName = BuildDisplayName(m.Sender),
        SenderAvatar = m.Sender?.AvatarUrl,
        ReceiverId = m.ReceiverId,
        Content = m.Content,
        CreatedAt = m.CreatedAt
    };

    private static string BuildDisplayName(User? u)
    {
        if (u == null) return "Unknown";
        if (string.IsNullOrWhiteSpace(u.FirstName) && string.IsNullOrWhiteSpace(u.LastName))
            return u.Username;
        return $"{u.FirstName} {u.LastName}".Trim();
    }
}
