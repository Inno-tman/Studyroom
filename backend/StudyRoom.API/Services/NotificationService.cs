using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.DTOs.Notifications;
using StudyRoom.API.Hubs;
using StudyRoom.API.Models;

namespace StudyRoom.API.Services;

public class NotificationService : INotificationService
{
    private readonly AppDbContext _context;
    private readonly IHubContext<StudyRoomHub> _hub;

    public NotificationService(AppDbContext context, IHubContext<StudyRoomHub> hub)
    {
        _context = context;
        _hub = hub;
    }

    public async Task<NotificationDto> CreateAsync(Guid userId, string type, string title, string body,
        string icon = "notifications", Guid? actorId = null, string? actorName = null, string? actorAvatarUrl = null, string? link = null)
    {
        var notification = new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Body = body,
            Icon = icon,
            ActorId = actorId,
            ActorName = actorName ?? string.Empty,
            ActorAvatarUrl = actorAvatarUrl,
            Link = link
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        var dto = Map(notification);

        await _hub.Clients.Group(UserGroup(userId)).SendAsync("ReceiveNotification", dto);
        return dto;
    }

    public async Task<NotificationListDto> GetForUserAsync(Guid userId, int take = 50)
    {
        var items = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .ToListAsync();

        return new NotificationListDto
        {
            Items = items.Select(Map).ToList(),
            UnreadCount = items.Count(n => !n.IsRead)
        };
    }

    public async Task<int> GetUnreadCountAsync(Guid userId) =>
        await _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);

    public async Task<bool> MarkReadAsync(Guid notificationId, Guid userId)
    {
        var notification = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);
        if (notification == null) return false;

        notification.IsRead = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task MarkAllReadAsync(Guid userId)
    {
        var unread = await _context.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
        foreach (var n in unread) n.IsRead = true;
        if (unread.Count > 0) await _context.SaveChangesAsync();
    }

    private static string UserGroup(Guid userId) => $"user_{userId}";

    private static NotificationDto Map(Notification n) => new()
    {
        Id = n.Id,
        Type = n.Type,
        Title = n.Title,
        Body = n.Body,
        Icon = n.Icon,
        ActorId = n.ActorId,
        ActorName = n.ActorName,
        ActorAvatarUrl = n.ActorAvatarUrl,
        Link = n.Link,
        IsRead = n.IsRead,
        CreatedAt = n.CreatedAt
    };
}