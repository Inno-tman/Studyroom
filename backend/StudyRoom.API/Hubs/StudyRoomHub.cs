using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using StudyRoom.API.DTOs.Messages;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Hubs;

[Authorize]
public class StudyRoomHub : Hub
{
    private readonly IMessageRepository _messageRepo;
    private readonly IRoomRepository _roomRepo;
    private readonly IStudySessionRepository _sessionRepo;
    private readonly IDirectMessageRepository _dmRepo;
    private static readonly Dictionary<string, string> _onlineUsers = new();
    private static readonly Dictionary<string, string> _userGroups = new();

    public StudyRoomHub(
        IMessageRepository messageRepo,
        IRoomRepository roomRepo,
        IStudySessionRepository sessionRepo,
        IDirectMessageRepository dmRepo)
    {
        _messageRepo = messageRepo;
        _roomRepo = roomRepo;
        _sessionRepo = sessionRepo;
        _dmRepo = dmRepo;
    }

    private Guid UserId => Guid.Parse(Context.User!.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string Username => Context.User!.FindFirstValue(ClaimTypes.Name)!;

    public async Task JoinRoom(string roomId)
    {
        var connectionId = Context.ConnectionId;
        var groupName = GetGroupName(roomId);

        await Groups.AddToGroupAsync(connectionId, groupName);
        _onlineUsers[connectionId] = roomId;

        await Clients.Group(groupName).SendAsync("UserJoined", new
        {
            userId = UserId.ToString(),
            username = Username
        });

        await UpdateOnlineUsers(roomId);
    }

    public async Task LeaveRoom(string roomId)
    {
        var groupName = GetGroupName(roomId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _onlineUsers.Remove(Context.ConnectionId);

        await Clients.Group(groupName).SendAsync("UserLeft", new
        {
            userId = UserId.ToString(),
            username = Username
        });

        await UpdateOnlineUsers(roomId);
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

        var dto = new MessageDto
        {
            Id = message.Id,
            RoomId = message.RoomId,
            UserId = message.UserId,
            Username = Username,
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
    }

    public override async Task OnConnectedAsync()
    {
        var group = GetUserGroup(UserId.ToString());
        if (!_userGroups.ContainsKey(UserId.ToString()))
            _userGroups[UserId.ToString()] = group;

        await Groups.AddToGroupAsync(Context.ConnectionId, group);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_onlineUsers.TryGetValue(Context.ConnectionId, out var roomId))
        {
            _onlineUsers.Remove(Context.ConnectionId);
            await Clients.Group(GetGroupName(roomId)).SendAsync("UserLeft", new
            {
                userId = UserId.ToString(),
                username = Username
            });
            await UpdateOnlineUsers(roomId);
        }

        await base.OnDisconnectedAsync(exception);
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
