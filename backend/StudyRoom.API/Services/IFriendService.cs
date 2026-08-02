using StudyRoom.API.DTOs.Social;

namespace StudyRoom.API.Services;

public interface IFriendService
{
    Task<List<UserSearchResultDto>> SearchUsersAsync(string query, Guid userId);
    Task<List<FriendRequestDto>> GetFriendsAsync(Guid userId);
    Task<List<FriendRequestDto>> GetIncomingRequestsAsync(Guid userId);
    Task SendRequestAsync(Guid fromUserId, Guid toUserId);
    Task AcceptRequestAsync(Guid requestId, Guid userId);
    Task DeleteRequestAsync(Guid requestId, Guid userId);
    Task RemoveFriendAsync(Guid userId, Guid friendId);
}
