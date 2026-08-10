using StudyRoom.API.DTOs.Notifications;

namespace StudyRoom.API.Services;

public interface INotificationService
{
    Task<NotificationDto> CreateAsync(Guid userId, string type, string title, string body,
        string icon = "notifications", Guid? actorId = null, string? actorName = null, string? actorAvatarUrl = null, string? link = null);
    Task<NotificationListDto> GetForUserAsync(Guid userId, int take = 50);
    Task<int> GetUnreadCountAsync(Guid userId);
    Task<bool> MarkReadAsync(Guid notificationId, Guid userId);
    Task MarkAllReadAsync(Guid userId);
}