using StudyRoom.API.DTOs.Social;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class FriendService : IFriendService
{
    private readonly IUserRepository _userRepo;
    private readonly IFriendshipRepository _friendRepo;
    private readonly IRoomRepository _roomRepo;

    public FriendService(IUserRepository userRepo, IFriendshipRepository friendRepo, IRoomRepository roomRepo)
    {
        _userRepo = userRepo;
        _friendRepo = friendRepo;
        _roomRepo = roomRepo;
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

    public async Task<List<UserSearchResultDto>> SuggestUsersAsync(Guid userId, int count)
    {
        var me = await _userRepo.GetByIdAsync(userId);
        if (me == null) return new List<UserSearchResultDto>();

        var allUsers = await _userRepo.GetAllAsync();
        var myFriendships = await _friendRepo.GetAcceptedAsync(userId);
        var allAccepted = await _friendRepo.GetAllAcceptedAsync();
        var pending = await _friendRepo.GetPendingAsync(userId);
        var roomMap = await _roomRepo.GetMembershipMapAsync();

        var myRoomIds = roomMap.TryGetValue(userId, out var myRooms) ? myRooms : new HashSet<Guid>();
        var myFriendIds = myFriendships
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToHashSet();

        var adjacency = new Dictionary<Guid, HashSet<Guid>>();
        foreach (var f in allAccepted)
        {
            if (!adjacency.TryGetValue(f.RequesterId, out var set1))
                adjacency[f.RequesterId] = set1 = new HashSet<Guid>();
            set1.Add(f.AddresseeId);
            if (!adjacency.TryGetValue(f.AddresseeId, out var set2))
                adjacency[f.AddresseeId] = set2 = new HashSet<Guid>();
            set2.Add(f.RequesterId);
        }

        var connectedIds = pending
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .Concat(myFriendIds)
            .ToHashSet();

        var myAge = me.BirthDate.HasValue ? AgeOf(me.BirthDate.Value) : (int?)null;
        var myInterests = SplitTokens(me.Interests);

        var candidates = allUsers
            .Where(u => u.Id != userId && !connectedIds.Contains(u.Id))
            .Select(u =>
            {
                var theirFriends = adjacency.TryGetValue(u.Id, out var s) ? s : new HashSet<Guid>();
                var mutual = theirFriends.Count(f => myFriendIds.Contains(f));

                var sameSchool = !string.IsNullOrWhiteSpace(me.SchoolName)
                    && !string.IsNullOrWhiteSpace(u.SchoolName)
                    && me.SchoolName.Equals(u.SchoolName, StringComparison.OrdinalIgnoreCase);

                var sameLocation = !string.IsNullOrWhiteSpace(me.Location)
                    && !string.IsNullOrWhiteSpace(u.Location)
                    && me.Location.Equals(u.Location, StringComparison.OrdinalIgnoreCase);

                var theirRooms = roomMap.TryGetValue(u.Id, out var r) ? r : new HashSet<Guid>();
                var sharedRooms = theirRooms.Intersect(myRoomIds).Count();

                var ageNear = myAge.HasValue && u.BirthDate.HasValue
                    && Math.Abs(myAge.Value - AgeOf(u.BirthDate.Value)) <= 3;

                var sameMajor = !string.IsNullOrWhiteSpace(me.Major)
                    && !string.IsNullOrWhiteSpace(u.Major)
                    && me.Major.Equals(u.Major, StringComparison.OrdinalIgnoreCase);

                var theirInterests = SplitTokens(u.Interests);
                var interestOverlap = theirInterests.Count(i => myInterests.Contains(i, StringComparer.OrdinalIgnoreCase));

                var score = (mutual * 100)
                    + (sameSchool ? 25 : 0)
                    + (sameLocation ? 20 : 0)
                    + (sharedRooms * 10)
                    + (ageNear ? 15 : 0)
                    + (sameMajor ? 12 : 0)
                    + (interestOverlap * 8);

                var reason = BuildReason(mutual, sameSchool, sameLocation, sharedRooms, ageNear, sameMajor, interestOverlap);
                return (u, mutual, sharedRooms, reason, score);
            })
            .Where(c => c.score > 0)
            .OrderByDescending(c => c.score)
            .ThenBy(c => c.u.Username)
            .Take(count)
            .ToList();

        var result = new List<UserSearchResultDto>();
        foreach (var c in candidates)
        {
            result.Add(new UserSearchResultDto
            {
                Id = c.u.Id,
                Username = c.u.Username,
                DisplayName = BuildDisplayName(c.u),
                AvatarUrl = c.u.AvatarUrl,
                SchoolName = c.u.SchoolName,
                Location = c.u.Location,
                Relationship = "None",
                MutualCount = c.mutual,
                SharedRoomCount = c.sharedRooms,
                Reason = c.reason
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

    private static int AgeOf(DateTime birthDate)
    {
        var today = DateTime.UtcNow;
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age;
    }

    private static List<string> SplitTokens(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return new List<string>();
        return value.Split(',', ';', '\n', '\r')
            .Select(t => t.Trim())
            .Where(t => t.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string BuildReason(int mutual, bool sameSchool, bool sameLocation, int sharedRooms, bool ageNear, bool sameMajor, int interestOverlap)
    {
        var parts = new List<string>();
        if (mutual > 0) parts.Add($"{mutual} mutual {(mutual == 1 ? "friend" : "friends")}");
        if (sameSchool) parts.Add("same school");
        if (sameLocation) parts.Add("nearby");
        if (sharedRooms > 0) parts.Add($"{sharedRooms} shared {(sharedRooms == 1 ? "room" : "rooms")}");
        if (ageNear) parts.Add("similar age");
        if (sameMajor) parts.Add("same major");
        if (interestOverlap > 0) parts.Add($"{interestOverlap} shared {(interestOverlap == 1 ? "interest" : "interests")}");
        return parts.Count > 0 ? string.Join(" · ", parts) : "May know each other";
    }
}
