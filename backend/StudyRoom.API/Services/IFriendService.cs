using StudyRoom.API.DTOs.Social;

namespace StudyRoom.API.Services;

public interface IFriendService
{
    Task<List<UserSearchResultDto>> SearchUsersAsync(string query, Guid userId);
    Task<List<UserSearchResultDto>> SuggestUsersAsync(Guid userId, int count = 20);
    Task<List<FriendRequestDto>> GetFriendsAsync(Guid userId);
    Task<List<FriendRequestDto>> GetIncomingRequestsAsync(Guid userId);
    Task<List<FriendRequestDto>> GetOutgoingRequestsAsync(Guid userId);
    Task<List<PresenceStatusDto>> GetFriendPresenceAsync(Guid userId);
    Task<List<PresenceStatusDto>> GetPresenceForUsersAsync(List<Guid> userIds);
    Task SendRequestAsync(Guid fromUserId, Guid toUserId);
    Task AcceptRequestAsync(Guid requestId, Guid userId);
    Task DeleteRequestAsync(Guid requestId, Guid userId);
    Task RemoveFriendAsync(Guid userId, Guid friendId);
}
