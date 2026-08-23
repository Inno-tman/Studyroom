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
    private readonly IUserStatsRepository _statsRepo;
    private readonly ITimerScheduler _timerScheduler;

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
        IUserRepository userRepo,
        IUserStatsRepository statsRepo,
        ITimerScheduler timerScheduler)
    {
        _messageRepo = messageRepo;
        _roomRepo = roomRepo;
        _sessionRepo = sessionRepo;
        _dmRepo = dmRepo;
        _userRepo = userRepo;
        _statsRepo = statsRepo;
        _timerScheduler = timerScheduler;
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

    // ── Call lifecycle ────────────────────────────────────────
    private static readonly Dictionary<string, CallState> _calls = new();

    public async Task Ring(string calleeId, string callId, string callType = "audio")
    {
        var callerId = UserId.ToString();
        if (callerId == calleeId) return;

        var user = _userRepo.GetByIdAsync(UserId).GetAwaiter().GetResult();

        lock (_calls)
        {
            if (_calls.Values.Any(c => c.CalleeId == calleeId && c.Status == "Ringing"))
                return; // already ringing someone

            _calls[callId] = new CallState
            {
                CallId = callId,
                CallerId = callerId,
                CallerName = Username,
                CallerAvatar = user?.AvatarUrl,
                CalleeId = calleeId,
                CallType = callType == "video" ? "video" : "audio",
                Status = "Ringing"
            };
        }

        await Clients.Group(GetUserGroup(calleeId)).SendAsync("IncomingCall", new
        {
            callId,
            callerId,
            callerName = Username,
            callerAvatar = user?.AvatarUrl,
            callType = callType == "video" ? "video" : "audio"
        });

        // Alert the callee even if their app is closed/backgrounded.
        await SendCallPushAsync(calleeId, callId, "Incoming call",
            $"{Username} is calling you.", new Dictionary<string, object?>
            {
                ["type"] = "incoming_call",
                ["callId"] = callId,
                ["callerId"] = callerId,
                ["callerName"] = Username,
                ["callerAvatar"] = user?.AvatarUrl,
                ["callType"] = callType == "video" ? "video" : "audio"
            });
    }

    public async Task AnswerCall(string callId)
    {
        var me = UserId.ToString();
        CallState call;
        lock (_calls)
        {
            if (!_calls.TryGetValue(callId, out call)) return;
            if (call.CalleeId != me) return;
            call.Status = "Active";
        }

        await Clients.Group(GetUserGroup(call.CallerId)).SendAsync("CallAccepted", new
        {
            callId,
            calleeId = me,
            calleeName = Username,
            calleeAvatar = (await _userRepo.GetByIdAsync(UserId))?.AvatarUrl
        });
    }

    public async Task DeclineCall(string callId)
    {
        var me = UserId.ToString();
        CallState call;
        lock (_calls)
        {
            if (!_calls.TryGetValue(callId, out call)) return;
            if (call.CalleeId != me) return;
            _calls.Remove(callId);
        }

        await Clients.Group(GetUserGroup(call.CallerId)).SendAsync("CallDeclined", new
        {
            callId
        });
        await SendCallPushAsync(call.CallerId, callId, "Call declined", $"{call.CallerName}'s call was declined.", new Dictionary<string, object?>
        {
            ["type"] = "call_closed",
            ["callId"] = callId
        });
    }

    public async Task CancelCall(string callId)
    {
        var me = UserId.ToString();
        CallState call;
        lock (_calls)
        {
            if (!_calls.TryGetValue(callId, out call)) return;
            if (call.CallerId != me) return;
            _calls.Remove(callId);
        }

        await Clients.Group(GetUserGroup(call.CalleeId)).SendAsync("CallCancelled", new
        {
            callId
        });
        await SendCallPushAsync(call.CalleeId, callId, "Call cancelled", $"{call.CallerName} cancelled the call.", new Dictionary<string, object?>
        {
            ["type"] = "call_closed",
            ["callId"] = callId
        });
    }

    public async Task EndCall(string callId)
    {
        CallState call;
        lock (_calls)
        {
            if (_calls.TryGetValue(callId, out call)) _calls.Remove(callId);
        }
        if (call == null) return;

        await Clients.Group(GetUserGroup(call.CallerId)).SendAsync("CallEnded", new { callId });
        await Clients.Group(GetUserGroup(call.CalleeId)).SendAsync("CallEnded", new { callId });
        await SendCallPushAsync(call.CallerId, callId, "Call ended", $"Your call with {call.CallerName} ended.", new Dictionary<string, object?>
        {
            ["type"] = "call_closed",
            ["callId"] = callId
        });
        await SendCallPushAsync(call.CalleeId, callId, "Call ended", $"Your call with {call.CallerName} ended.", new Dictionary<string, object?>
        {
            ["type"] = "call_closed",
            ["callId"] = callId
        });
    }

    /// <summary>Sends a web push notification to a user via a scoped PushService.</summary>
    private async Task SendCallPushAsync(string userId, string callId, string title, string body, Dictionary<string, object?> extra)
    {
        try
        {
            using var pushScope = Context.GetHttpContext()!.RequestServices.CreateScope();
            var pushService = pushScope.ServiceProvider.GetRequiredService<IPushService>();
            await pushService.SendToUserAsync(Guid.Parse(userId), title, body, link: "/", extra: extra);
        }
        catch { }
    }

    // ── WebRTC signaling relay ──────────────────────────────
    /// <summary>Relays an SDP offer from the caller to the callee.</summary>
    public async Task SendOffer(string callId, string sdp)
    {
        var me = UserId.ToString();
        CallState call;
        lock (_calls)
        {
            if (!_calls.TryGetValue(callId, out call)) return;
            call.Offer = sdp; // store so the callee can fetch it after opening from a push
        }
        var peer = call.CallerId == me ? call.CalleeId : call.CallerId;
        if (peer == me) return;

        await Clients.Group(GetUserGroup(peer)).SendAsync("WebRtcOffer", new
        {
            callId,
            sdp
        });
    }

    /// <summary>Lets the callee fetch the stored offer when they open the app from a push.</summary>
    public Task<object?> GetCallOffer(string callId)
    {
        var me = UserId.ToString();
        CallState call;
        lock (_calls)
        {
            if (!_calls.TryGetValue(callId, out call)) return Task.FromResult<object?>(null);
        }
        if (call.CalleeId != me && call.CallerId != me) return Task.FromResult<object?>(null);
        if (string.IsNullOrEmpty(call.Offer)) return Task.FromResult<object?>(null);

        return Task.FromResult<object?>(new { callId, sdp = call.Offer });
    }

    /// <summary>Returns any ringing call for the current user (callee side).</summary>
    public Task<object?> GetActiveCall()
    {
        var me = UserId.ToString();
        lock (_calls)
        {
            var call = _calls.Values.FirstOrDefault(c => c.CalleeId == me && c.Status == "Ringing");
            if (call == null) return Task.FromResult<object?>(null);

            return Task.FromResult<object?>(new
            {
                callId = call.CallId,
                callerId = call.CallerId,
                callerName = call.CallerName,
                callerAvatar = call.CallerAvatar,
                callType = call.CallType
            });
        }
    }

    /// <summary>Relays an SDP answer from the callee to the caller.</summary>
    public async Task SendAnswer(string callId, string sdp)
    {
        var me = UserId.ToString();
        CallState call;
        lock (_calls)
        {
            if (!_calls.TryGetValue(callId, out call)) return;
        }
        var peer = call.CallerId == me ? call.CalleeId : call.CallerId;
        if (peer == me) return;

        await Clients.Group(GetUserGroup(peer)).SendAsync("WebRtcAnswer", new
        {
            callId,
            sdp
        });
    }

    /// <summary>Relays an ICE candidate to the peer.</summary>
    public async Task SendIceCandidate(string callId, string candidate)
    {
        var me = UserId.ToString();
        CallState call;
        lock (_calls)
        {
            if (!_calls.TryGetValue(callId, out call)) return;
            if (call.IceCandidates.Count < 50) call.IceCandidates.Add(candidate); // store for resume-after-push
        }
        var peer = call.CallerId == me ? call.CalleeId : call.CallerId;
        if (peer == me) return;

        await Clients.Group(GetUserGroup(peer)).SendAsync("WebRtcIceCandidate", new
        {
            callId,
            candidate
        });
    }

    /// <summary>Lets the callee fetch ICE candidates buffered while they were offline.</summary>
    public Task<object?> GetCallIceCandidates(string callId)
    {
        var me = UserId.ToString();
        CallState call;
        lock (_calls)
        {
            if (!_calls.TryGetValue(callId, out call)) return Task.FromResult<object?>(null);
        }
        if (call.CalleeId != me && call.CallerId != me) return Task.FromResult<object?>(null);

        return Task.FromResult<object?>(new { callId, candidates = call.IceCandidates.ToArray() });
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

        // Reuse an in-progress session if one exists (handles resume / auto-start of
        // the same phase); otherwise start a fresh one.
        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var existing = sessions.FirstOrDefault(s => !s.Completed);
        if (existing != null)
        {
            existing.RoomId = Guid.Parse(roomId);
            existing.StartedAt = DateTime.UtcNow;
            await _sessionRepo.UpdateAsync(existing);
        }
        else
        {
            await _sessionRepo.AddAsync(new StudySession
            {
                UserId = UserId,
                RoomId = Guid.Parse(roomId),
                DurationMinutes = durationMinutes,
                StartedAt = DateTime.UtcNow,
                Completed = false
            });
        }

        _timerScheduler.ScheduleFocus(UserId, Guid.Parse(roomId), durationMinutes);
    }

    public async Task StartBreak(string roomId, int durationMinutes, bool isLong)
    {
        await Clients.Group(GetGroupName(roomId)).SendAsync("TimerStarted", new
        {
            roomId,
            durationMinutes,
            isBreak = true,
            isLong,
            startedBy = Username,
            startedAt = DateTime.UtcNow
        });

        _timerScheduler.ScheduleBreak(UserId, Guid.Parse(roomId), durationMinutes, isLong);
    }

    public async Task PauseTimer(string roomId)
    {
        await Clients.Group(GetGroupName(roomId)).SendAsync("TimerPaused", new
        {
            roomId,
            pausedBy = Username
        });

        await FinalizeActiveSessionAsync();
        _timerScheduler.Cancel(UserId);
    }

    public async Task ResetTimer(string roomId)
    {
        await Clients.Group(GetGroupName(roomId)).SendAsync("TimerReset", new
        {
            roomId,
            resetBy = Username
        });

        await FinalizeActiveSessionAsync();
        _timerScheduler.Cancel(UserId);
    }

    public async Task TimerCompleted(string roomId)
    {
        await Clients.Group(GetGroupName(roomId)).SendAsync("TimerCompleted", new
        {
            roomId,
            completedBy = Username
        });

        await FinalizeActiveSessionAsync();
    }

    private async Task FinalizeActiveSessionAsync()
    {
        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var latest = sessions.FirstOrDefault(s => !s.Completed);
        if (latest != null)
        {
            latest.DurationMinutes = ComputeElapsedMinutes(latest);
            latest.Completed = true;
            await _sessionRepo.UpdateAsync(latest);
            await _statsRepo.RefreshAsync(UserId);
        }
    }

    private static decimal ComputeElapsedMinutes(StudySession s)
    {
        var start = s.StartedAt ?? s.CreatedAt;
        var minutes = (DateTime.UtcNow - start).TotalMinutes;
        return Math.Round((decimal)Math.Max(0, minutes), 2);
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

        // Clean up any calls this user is part of.
        var callsToClose = new List<(string PeerId, string CallId)>();
        lock (_calls)
        {
            foreach (var kv in _calls.ToList())
            {
                if (kv.Value.CallerId == uid || kv.Value.CalleeId == uid)
                {
                    _calls.Remove(kv.Key);
                    if (kv.Value.CallerId != uid) callsToClose.Add((kv.Value.CallerId, kv.Key));
                    if (kv.Value.CalleeId != uid) callsToClose.Add((kv.Value.CalleeId, kv.Key));
                }
            }
        }
        foreach (var (peerId, callId) in callsToClose)
        {
            await Clients.Group(GetUserGroup(peerId)).SendAsync("CallEnded", new { callId });
            await SendCallPushAsync(peerId, callId, "Call ended", "The call ended.", new Dictionary<string, object?>
            {
                ["type"] = "call_closed",
                ["callId"] = callId
            });
        }

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

public class CallState
{
    public string CallId { get; set; } = "";
    public string CallerId { get; set; } = "";
    public string CallerName { get; set; } = "";
    public string? CallerAvatar { get; set; }
    public string CalleeId { get; set; } = "";
    public string Status { get; set; } = "Ringing";
    public string CallType { get; set; } = "audio";
    public string? Offer { get; set; }
    public List<string> IceCandidates { get; set; } = new();
}
