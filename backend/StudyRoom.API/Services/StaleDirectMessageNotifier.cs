using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class StaleDirectMessageNotifier : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TimeSpan _staleAfter = TimeSpan.FromHours(12);

    public StaleDirectMessageNotifier(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        do
        {
            try
            {
                await ProcessAsync(stoppingToken);
            }
            catch
            {
                // swallow: a polling failure should not kill the background loop
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var dmRepo = scope.ServiceProvider.GetRequiredService<IDirectMessageRepository>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var olderThan = DateTime.UtcNow.Subtract(_staleAfter);
        var stale = await dmRepo.GetStaleUnreadAsync(olderThan);

        foreach (var message in stale)
        {
            var senderName = BuildDisplayName(message.Sender);
            await notificationService.CreateAsync(
                message.ReceiverId,
                "stale_message",
                "Message waiting",
                $"{senderName} left a message for you to read.",
                icon: "chat",
                actorId: message.SenderId,
                actorName: senderName,
                actorAvatarUrl: message.Sender?.AvatarUrl,
                link: "/messages");
        }

        if (stale.Count > 0)
        {
            await dmRepo.MarkNotificationSentAsync(stale.Select(m => m.Id));
        }
    }

    private static string BuildDisplayName(Models.User? u)
    {
        if (u == null) return "Someone";
        if (string.IsNullOrWhiteSpace(u.FirstName) && string.IsNullOrWhiteSpace(u.LastName))
            return u.Username;
        return $"{u.FirstName} {u.LastName}".Trim();
    }
}