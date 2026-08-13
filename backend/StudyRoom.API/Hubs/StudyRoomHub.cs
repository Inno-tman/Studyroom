using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using StudyRoom.API.DTOs.Messages;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;
using Microsoft.Extensions.DependencyInjection;

namespace StudyRoom.API.Hubs;

[Authorize]
public class StudyRoomHub : Hub
{
    private readonly IMessageRepository _messageRepo;
    private readonly IRoomRepository _roomRepo;
    private readonly IStudySessionRepository _sessionRepo;
    private readonly IDirectMessageRepository _dmRepo;
    private readonly IUserRepository _userRepo;

    // Room-scoped: connectionId -> roomId
    private static readonly Dictionary<string, string> _onlineUsers = new();
    private static readonly Dictionary<string, string> _userGroups = new();

    // Global presence: userId -> joined room ids (multiple connections per user)
    private static readonly Dictionary<string, HashSet<string>> _presenceRooms = new();
    private static readonly Dictionary<string, string> _presenceUsername = new();
    private static readonly Dictionary<string, string> _presenceAvatar = new();
    private static readonly Dictionary<string, int> _presenceConnections = new();

    public StudyRoomHub(
        IMessageRepository messageRepo,
        IRoomRepository roomRepo,
        IStudySessionRepository sessionRepo,
        IDirectMessageRepository dmRepo,
        IUserRepository userRepo)
    {
        _messageRepo = messageRepo;
        _roomRepo = roomRepo;
        _sessionRepo = sessionRepo;
        _dmRepo = dmRepo;
        _userRepo = userRepo;
    }

    private Guid UserId => Guid.Parse(Context.User!.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string Username => Context.User!.FindFirstValue(ClaimTypes.Name)!;

    public async Task JoinRoom(string roomId)
    {
        var connectionId = Context.ConnectionId;
        var groupName = GetGroupName(roomId);

        await Groups.AddToGroupAsync(connectionId, groupName);
        _onlineUsers[connectionId] = roomId;

        var uid = UserId.ToString();
        var username = Username;

        lock (_presenceRooms)
        {
            if (!_presenceRooms.TryGetValue(uid, out var rooms))
            {
                rooms = new HashSet<string>();
                _presenceRooms[uid] = rooms;
                _presenceUsername[uid] = username;
            }
            rooms.Add(roomId);
        }

        await SeedPresenceAvatar();

        await Clients.Group(groupName).SendAsync("UserJoined", new
        {
            userId = uid,
            username
        });

        await UpdateOnlineUsers(roomId);
    }

    public async Task LeaveRoom(string roomId)
    {
        var groupName = GetGroupName(roomId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _onlineUsers.Remove(Context.ConnectionId);

        var uid = UserId.ToString();
        lock (_presenceRooms)
        {
            if (_presenceRooms.TryGetValue(uid, out var rooms))
                rooms.Remove(roomId);
        }

        await Clients.Group(groupName).SendAsync("UserLeft", new
        {
            userId = uid,
            username = Username
        });

        await UpdateOnlineUsers(roomId);
    }

    /// <summary>Returns live online people across ALL rooms the caller is a member of.</summary>
    public Task<List<object>> GetPresence()
    {
        var me = UserId.ToString();

        // Rooms the caller belongs to
        var myRooms = new HashSet<string>();
        lock (_presenceRooms)
        {
            if (_presenceRooms.TryGetValue(me, out var rooms))
                foreach (var r in rooms) myRooms.Add(r);
        }

        var result = new List<object>();
        if (myRooms.Count == 0) return Task.FromResult(result);

        lock (_presenceRooms)
        {
            foreach (var kv in _presenceRooms)
            {
                if (kv.Key == me) continue;
                var sharedRooms = kv.Value.Where(r => myRooms.Contains(r)).ToList();
                if (sharedRooms.Count == 0) continue;

                _presenceUsername.TryGetValue(kv.Key, out var uname);
                _presenceAvatar.TryGetValue(kv.Key, out var avatar);
                result.Add(new
                {
                    userId = kv.Key,
                    username = uname ?? kv.Key,
                    avatarUrl = avatar,
                    roomIds = sharedRooms
                });
            }
        }
        return Task.FromResult(result);
    }

    public async Task SendMessage(string roomId, string content)
    {
        var message = new Message
        {
            RoomId = Guid.Parse(roomId),
            UserId = UserId,
            Content = content
        };

        await _messageRepo.AddAsync(message);

        var user = await _userRepo.GetByIdAsync(UserId);

        var dto = new MessageDto
        {
            Id = message.Id,
            RoomId = message.RoomId,
            UserId = message.UserId,
            Username = Username,
            AvatarUrl = user?.AvatarUrl,
            Content = message.Content,
            CreatedAt = message.CreatedAt
        };

        await Clients.Group(GetGroupName(roomId)).SendAsync("ReceiveMessage", dto);
    }

    public async Task StartTimer(string roomId, int durationMinutes)
    {
        await Clients.Group(GetGroupName(roomId)).SendAsync("TimerStarted", new
        {
            roomId,
            durationMinutes,
            startedBy = Username,
            startedAt = DateTime.UtcNow
        });

        var session = new StudySession
        {
            UserId = UserId,
            RoomId = Guid.Parse(roomId),
            DurationMinutes = durationMinutes,
            Completed = false
        };

        await _sessionRepo.AddAsync(session);
    }

    public async Task PauseTimer(string roomId)
    {
        await Clients.Group(GetGroupName(roomId)).SendAsync("TimerPaused", new
        {
            roomId,
            pausedBy = Username
        });
    }

    public async Task ResetTimer(string roomId)
    {
        await Clients.Group(GetGroupName(roomId)).SendAsync("TimerReset", new
        {
            roomId,
            resetBy = Username
        });
    }

    public async Task TimerCompleted(string roomId)
    {
        await Clients.Group(GetGroupName(roomId)).SendAsync("TimerCompleted", new
        {
            roomId,
            completedBy = Username
        });

        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var latest = sessions.FirstOrDefault();
        if (latest != null)
        {
            latest.Completed = true;
        }
    }

    public async Task UpdateNotes(string roomId, string content)
    {
        await Clients.Group(GetGroupName(roomId)).SendAsync("NotesUpdated", new
        {
            roomId,
            content,
            updatedBy = Username,
            updatedAt = DateTime.UtcNow
        });
    }

    public async Task SendDirectMessage(string receiverId, string content)
    {
        var receiver = Guid.Parse(receiverId);
        var message = await _dmRepo.AddAsync(new Models.DirectMessage
        {
            SenderId = UserId,
            ReceiverId = receiver,
            Content = content
        });

        var dto = new
        {
            id = message.Id,
            senderId = UserId.ToString(),
            senderName = Username,
            receiverId = receiverId,
            content = message.Content,
            createdAt = message.CreatedAt
        };

        await Clients.Group(GetUserGroup(receiverId)).SendAsync("ReceiveDirectMessage", dto);
        await Clients.Group(GetUserGroup(UserId.ToString())).SendAsync("ReceiveDirectMessage", dto);

        using (var pushScope = Context.GetHttpContext()!.RequestServices.CreateScope())
        {
            var pushService = pushScope.ServiceProvider.GetRequiredService<IPushService>();
            await pushService.SendToUserAsync(receiver, "New message", $"You have a new message from {Username}.", link: "/messages");
        }
    }

    public async Task DeleteDirectMessage(string messageId)
    {
        var id = Guid.Parse(messageId);

        using var scope = Context.GetHttpContext()!.RequestServices.CreateScope();
        var dmRepo = scope.ServiceProvider.GetRequiredService<IDirectMessageRepository>();
        var message = await dmRepo.GetByIdAsync(id);

        if (message == null)
        {
            await Clients.Caller.SendAsync("MessageDeleted", messageId);
            return;
        }

        if (message.SenderId != UserId) return;

        await dmRepo.DeleteAsync(id);

        var groupA = GetUserGroup(message.SenderId.ToString());
        var groupB = GetUserGroup(message.ReceiverId.ToString());
        await Clients.Groups(new[] { groupA, groupB }).SendAsync("MessageDeleted", messageId);
    }

    public override async Task OnConnectedAsync()
    {
        var group = GetUserGroup(UserId.ToString());
        if (!_userGroups.ContainsKey(UserId.ToString()))
            _userGroups[UserId.ToString()] = group;

        await Groups.AddToGroupAsync(Context.ConnectionId, group);
        lock (_presenceConnections)
            _presenceConnections[UserId.ToString()] = _presenceConnections.GetValueOrDefault(UserId.ToString()) + 1;
        await SeedPresenceAvatar();
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var uid = UserId.ToString();
        if (_onlineUsers.TryGetValue(Context.ConnectionId, out var roomId))
        {
            _onlineUsers.Remove(Context.ConnectionId);
            lock (_presenceRooms)
            {
                if (_presenceRooms.TryGetValue(uid, out var rooms))
                    rooms.Remove(roomId);
            }
            await Clients.Group(GetGroupName(roomId)).SendAsync("UserLeft", new
            {
                userId = uid,
                username = Username
            });
            await UpdateOnlineUsers(roomId);
        }

        lock (_presenceConnections)
        {
            _presenceConnections[uid] = Math.Max(0, _presenceConnections.GetValueOrDefault(uid) - 1);
            // No live connections left -> drop this user entirely from presence.
            if (_presenceConnections[uid] == 0)
            {
                _presenceConnections.Remove(uid);
                _presenceRooms.Remove(uid);
                _presenceUsername.Remove(uid);
                _presenceAvatar.Remove(uid);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    private async Task SeedPresenceAvatar()
    {
        var uid = UserId.ToString();
        var user = await _userRepo.GetByIdAsync(UserId);
        if (user != null)
            _presenceAvatar[uid] = user.AvatarUrl ?? "";
    }

    private async Task UpdateOnlineUsers(string roomId)
    {
        var onlineIds = _onlineUsers
            .Where(kv => kv.Value == roomId)
            .Select(kv => kv.Key)
            .ToList();

        var usernames = new List<string>();
        foreach (var connId in onlineIds)
        {
            if (Clients.Client(connId) != null)
                usernames.Add(Username);
        }

        await Clients.Group(GetGroupName(roomId)).SendAsync("OnlineUsers", usernames.Distinct().ToList());
    }

    private static string GetGroupName(string roomId) => $"room_{roomId}";

    private static string GetUserGroup(string userId) => $"user_{userId}";
}
