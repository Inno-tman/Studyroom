namespace StudyRoom.API.Services;

public interface IPushService
{
    Task SaveSubscriptionAsync(Guid userId, PushSubscriptionData data, string? userAgent);
    Task RemoveSubscriptionAsync(string endpoint);
    Task SendToUserAsync(Guid userId, string title, string body, string? icon = null, string? link = null);
}