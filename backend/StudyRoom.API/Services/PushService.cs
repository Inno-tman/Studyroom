using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using StudyRoom.API.Data;
using StudyRoom.API.Models;
using WebPush;
using StoredSubscription = StudyRoom.API.Models.PushSubscription;

namespace StudyRoom.API.Services;

public class PushService : IPushService
{
    private readonly AppDbContext _context;
    private readonly VapidSettings _vapid;
    private readonly VapidDetails _vapidDetails;
    private readonly ILogger<PushService> _logger;

    public PushService(AppDbContext context, IOptions<VapidSettings> vapid, ILogger<PushService> logger)
    {
        _context = context;
        _vapid = vapid.Value;
        _logger = logger;
        _vapidDetails = new VapidDetails(_vapid.Subject, _vapid.PublicKey, _vapid.PrivateKey);
    }

    public async Task SaveSubscriptionAsync(Guid userId, PushSubscriptionData data, string? userAgent)
    {
        var existing = await _context.PushSubscriptions
            .FirstOrDefaultAsync(p => p.Endpoint == data.Endpoint);
        if (existing != null)
        {
            existing.UserId = userId;
            existing.P256dh = data.P256dh;
            existing.Auth = data.Auth;
            existing.UserAgent = userAgent;
            await _context.SaveChangesAsync();
            return;
        }

        _context.PushSubscriptions.Add(new StoredSubscription
        {
            UserId = userId,
            Endpoint = data.Endpoint,
            P256dh = data.P256dh,
            Auth = data.Auth,
            UserAgent = userAgent
        });
        await _context.SaveChangesAsync();
    }

    public async Task RemoveSubscriptionAsync(string endpoint)
    {
        var existing = await _context.PushSubscriptions
            .FirstOrDefaultAsync(p => p.Endpoint == endpoint);
        if (existing != null)
        {
            _context.PushSubscriptions.Remove(existing);
            await _context.SaveChangesAsync();
        }
    }

    public async Task SendToUserAsync(Guid userId, string title, string body, string? icon = null, string? link = null, Dictionary<string, object?>? extra = null)
    {
        if (string.IsNullOrWhiteSpace(_vapid.PublicKey) || string.IsNullOrWhiteSpace(_vapid.PrivateKey))
            return;

        var subscriptions = await _context.PushSubscriptions
            .Where(p => p.UserId == userId)
            .ToListAsync();

        foreach (var sub in subscriptions)
        {
            try
            {
                var client = new WebPushClient();
                var payloadData = new Dictionary<string, object?>
                {
                    ["title"] = title,
                    ["body"] = body,
                    ["icon"] = icon ?? "/icons/icon-192x192.png",
                    ["link"] = link
                };
                if (extra != null)
                    foreach (var kv in extra)
                        payloadData[kv.Key] = kv.Value;

                var payload = System.Text.Json.JsonSerializer.Serialize(payloadData);

                await client.SendNotificationAsync(
                    new WebPush.PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth),
                    payload,
                    _vapidDetails);
            }
            catch (WebPushException ex)
            {
                if (ex.StatusCode == System.Net.HttpStatusCode.Gone || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    _context.PushSubscriptions.Remove(sub);
                    continue;
                }
                _logger.LogDebug("Push failed for endpoint: {Message}", ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogDebug("Push error: {Message}", ex.Message);
            }
        }

        if (_context.ChangeTracker.HasChanges())
            await _context.SaveChangesAsync();
    }
}

public class PushSubscriptionData
{
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
}