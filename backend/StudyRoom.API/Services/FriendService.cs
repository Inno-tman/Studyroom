using StudyRoom.API.DTOs.Social;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class FriendService : IFriendService
{
    private readonly IUserRepository _userRepo;
    private readonly IFriendshipRepository _friendRepo;

    public FriendService(IUserRepository userRepo, IFriendshipRepository friendRepo)
    {
        _userRepo = userRepo;
        _friendRepo = friendRepo;
    }

    public async Task<List<UserSearchResultDto>> SearchUsersAsync(string query, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(query)) return new List<UserSearchResultDto>();

        var users = await _userRepo.SearchAsync(query, userId);
        var result = new List<UserSearchResultDto>();

        foreach (var u in users)
        {
            var rel = await _friendRepo.GetBetweenAsync(userId, u.Id);
            result.Add(new UserSearchResultDto
            {
                Id = u.Id,
                Username = u.Username,
                DisplayName = BuildDisplayName(u),
                AvatarUrl = u.AvatarUrl,
                SchoolName = u.SchoolName,
                Relationship = rel == null ? "None"
                    : rel.Status == "Accepted" ? "Friends"
                    : rel.RequesterId == userId ? "RequestSent"
                    : "RequestReceived",
                RelationshipId = rel?.Id
            });
        }

        return result;
    }

    public async Task<List<FriendRequestDto>> GetFriendsAsync(Guid userId)
    {
        var rels = await _friendRepo.GetFriendIdsAsync(userId);
        var result = new List<FriendRequestDto>();

        foreach (var rel in rels)
        {
            var other = rel.RequesterId == userId ? rel.Addressee : rel.Requester;
            if (other == null) continue;
            result.Add(MapFriend(other, rel.Id));
        }

        return result;
    }

    public async Task<List<FriendRequestDto>> GetIncomingRequestsAsync(Guid userId)
    {
        var rels = await _friendRepo.GetIncomingAsync(userId);
        return rels
            .Where(r => r.Requester != null)
            .Select(r => MapFriend(r.Requester!, r.Id))
            .ToList();
    }

    public async Task SendRequestAsync(Guid fromUserId, Guid toUserId)
    {
        if (fromUserId == toUserId)
            throw new InvalidOperationException("You cannot add yourself.");

        if (await _userRepo.GetByIdAsync(toUserId) == null)
            throw new KeyNotFoundException("User not found.");

        var existing = await _friendRepo.GetBetweenAsync(fromUserId, toUserId);
        if (existing != null)
        {
            if (existing.Status == "Accepted")
                throw new InvalidOperationException("Already friends.");
            if (existing.Status == "Pending")
                throw new InvalidOperationException("Friend request already pending.");
        }

        await _friendRepo.AddAsync(new Friendship
        {
            RequesterId = fromUserId,
            AddresseeId = toUserId,
            Status = "Pending"
        });
    }

    public async Task AcceptRequestAsync(Guid requestId, Guid userId)
    {
        var rel = await _friendRepo.GetByIdAsync(requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        if (rel.AddresseeId != userId)
            throw new UnauthorizedAccessException("Not allowed.");

        rel.Status = "Accepted";
        await _friendRepo.UpdateAsync(rel);
    }

    public async Task DeleteRequestAsync(Guid requestId, Guid userId)
    {
        var rel = await _friendRepo.GetByIdAsync(requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        if (rel.RequesterId != userId && rel.AddresseeId != userId)
            throw new UnauthorizedAccessException("Not allowed.");

        await _friendRepo.DeleteAsync(rel);
    }

    public async Task RemoveFriendAsync(Guid userId, Guid friendId)
    {
        var rel = await _friendRepo.GetBetweenAsync(userId, friendId)
            ?? throw new KeyNotFoundException("Not friends.");

        await _friendRepo.DeleteAsync(rel);
    }

    private static FriendRequestDto MapFriend(User u, Guid relId) => new()
    {
        Id = relId,
        UserId = u.Id,
        Username = u.Username,
        DisplayName = BuildDisplayName(u),
        AvatarUrl = u.AvatarUrl,
        SchoolName = u.SchoolName
    };

    private static string BuildDisplayName(User u)
    {
        if (string.IsNullOrWhiteSpace(u.FirstName) && string.IsNullOrWhiteSpace(u.LastName))
            return u.Username;
        return $"{u.FirstName} {u.LastName}".Trim();
    }
}
