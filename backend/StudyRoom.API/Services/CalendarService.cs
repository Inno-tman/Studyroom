using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Services;

public interface ICalendarService
{
    Task<CalendarConnection?> GetConnectionAsync(Guid userId, string provider);
    Task<List<CalendarConnection>> GetAllConnectionsAsync(Guid userId);
    Task<CalendarConnection> SaveConnectionAsync(Guid userId, string provider, string accessToken, string? refreshToken, DateTime expiresAt, string? calendarId, string? calendarName);
    Task DisconnectAsync(Guid connectionId, Guid userId);
    Task UpdateAutoSyncAsync(Guid connectionId, bool autoSync, Guid userId);
    Task CreateStudyEventAsync(Guid userId, Guid roomId, DateTime start, DateTime end);
    /// <summary>Creates one standalone event (manual user-triggered sync), no daily aggregation.</summary>
    Task CreateManualEventAsync(Guid userId, string title, DateTime start, DateTime end, string? description);
    Task<string?> RefreshTokenIfNeededAsync(CalendarConnection conn);
}

public class CalendarService : ICalendarService
{
    private readonly AppDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<CalendarService> _logger;

    public CalendarService(
        AppDbContext context,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<CalendarService> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<CalendarConnection?> GetConnectionAsync(Guid userId, string provider)
    {
        return await _context.CalendarConnections
            .FirstOrDefaultAsync(c => c.UserId == userId && c.Provider == provider);
    }

    public async Task<List<CalendarConnection>> GetAllConnectionsAsync(Guid userId)
    {
        return await _context.CalendarConnections
            .Where(c => c.UserId == userId)
            .ToListAsync();
    }

    public async Task<CalendarConnection> SaveConnectionAsync(Guid userId, string provider, string accessToken, string? refreshToken, DateTime expiresAt, string? calendarId, string? calendarName)
    {
        var existing = await GetConnectionAsync(userId, provider);
        if (existing != null)
        {
            existing.AccessToken = accessToken;
            existing.RefreshToken = refreshToken ?? existing.RefreshToken;
            existing.TokenExpiresAt = expiresAt;
            existing.CalendarId = calendarId ?? existing.CalendarId;
            existing.CalendarName = calendarName ?? existing.CalendarName;
            await _context.SaveChangesAsync();
            return existing;
        }

        var conn = new CalendarConnection
        {
            UserId = userId,
            Provider = provider,
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            TokenExpiresAt = expiresAt,
            CalendarId = calendarId,
            CalendarName = calendarName,
            AutoSync = true
        };
        _context.CalendarConnections.Add(conn);
        await _context.SaveChangesAsync();
        return conn;
    }

    public async Task DisconnectAsync(Guid connectionId, Guid userId)
    {
        var conn = await _context.CalendarConnections
            .FirstOrDefaultAsync(c => c.Id == connectionId && c.UserId == userId);
        if (conn != null)
        {
            _context.CalendarConnections.Remove(conn);
            await _context.SaveChangesAsync();
        }
    }

    public async Task UpdateAutoSyncAsync(Guid connectionId, bool autoSync, Guid userId)
    {
        var conn = await _context.CalendarConnections
            .FirstOrDefaultAsync(c => c.Id == connectionId && c.UserId == userId);
        if (conn != null)
        {
            conn.AutoSync = autoSync;
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Aggregates study time into ONE calendar event per day per connected
    /// calendar. The first completed session of a day creates the event;
    /// subsequent sessions extend its end time to the latest session end.
    /// </summary>
    public async Task CreateStudyEventAsync(Guid userId, Guid roomId, DateTime start, DateTime end)
    {
        var connections = await _context.CalendarConnections
            .Where(c => c.UserId == userId && c.AutoSync)
            .ToListAsync();
        if (connections.Count == 0) return;

        var room = await _context.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == roomId);
        var roomName = room?.Name ?? "";
        var title = string.IsNullOrEmpty(roomName)
            ? "Study Session"
            : $"Study: {roomName}";
        var description = $"Aggregated study time on {start.Date:MMM d, yyyy} synced from StudyRoom";
        var dayUtc = start.Date;

        foreach (var conn in connections)
        {
            try
            {
                await RefreshTokenIfNeededAsync(conn);
                if (conn.Provider == "google")
                    await UpsertGoogleEventAsync(conn, userId, title, description, dayUtc, start, end);
                else if (conn.Provider == "microsoft")
                    await UpsertMicrosoftEventAsync(conn, userId, title, description, dayUtc, start, end);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[calendar] Failed to sync aggregate event for provider {Provider}", conn.Provider);
            }
        }
    }

private async Task UpsertGoogleEventAsync(CalendarConnection conn, Guid userId, string title, string description, DateTime dayUtc, DateTime start, DateTime end)
    {
        var calId = conn.CalendarId ?? "primary";
        var marker = await _context.CalendarStudyEvents
            .FirstOrDefaultAsync(m => m.UserId == userId && m.Provider == "google" && m.CalendarId == calId && m.DayUtc == dayUtc);

        if (marker != null)
        {
            await PatchGoogleEventEndAsync(conn, calId, marker.EventProviderId, end);
            marker.LastEndUtc = end;
            await _context.SaveChangesAsync();
            return;
        }

        var eventId = await CreateGoogleEventAsync(conn, calId, title, description, start, end);
        if (string.IsNullOrEmpty(eventId)) return;
        _context.CalendarStudyEvents.Add(new Models.CalendarStudyEvent
        {
            UserId = userId,
            Provider = "google",
            CalendarId = calId,
            DayUtc = dayUtc,
            EventProviderId = eventId,
            LastEndUtc = end
        });
        await _context.SaveChangesAsync();
    }

    private async Task UpsertMicrosoftEventAsync(CalendarConnection conn, Guid userId, string title, string description, DateTime dayUtc, DateTime start, DateTime end)
    {
        var calId = conn.CalendarId ?? "primary";
        var marker = await _context.CalendarStudyEvents
            .FirstOrDefaultAsync(m => m.UserId == userId && m.Provider == "microsoft" && m.CalendarId == calId && m.DayUtc == dayUtc);

        if (marker != null)
        {
            await PatchMicrosoftEventEndAsync(conn, marker.EventProviderId, end);
            marker.LastEndUtc = end;
            await _context.SaveChangesAsync();
            return;
        }

        var eventId = await CreateMicrosoftEventAsync(conn, title, description, start, end);
        if (string.IsNullOrEmpty(eventId)) return;
        _context.CalendarStudyEvents.Add(new Models.CalendarStudyEvent
        {
            UserId = userId,
            Provider = "microsoft",
            CalendarId = calId,
            DayUtc = dayUtc,
            EventProviderId = eventId,
            LastEndUtc = end
        });
        await _context.SaveChangesAsync();
    }

    private async Task<string?> PatchGoogleEventEndAsync(CalendarConnection conn, string calId, string eventId, DateTime end)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", conn.AccessToken);

        var body = new { end = new { dateTime = end.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" } };
        var req = new HttpRequestMessage(HttpMethod.Patch, $"https://www.googleapis.com/calendar/v3/calendars/{calId}/events/{eventId}")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };
        var resp = await client.SendAsync(req);
        resp.EnsureSuccessStatusCode();
        return eventId;
    }

    private async Task<string?> PatchMicrosoftEventEndAsync(CalendarConnection conn, string eventId, DateTime end)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", conn.AccessToken);

        var body = new { end = new { dateTime = end.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" } };
        var req = new HttpRequestMessage(HttpMethod.Patch, $"https://graph.microsoft.com/v1.0/me/events/{eventId}")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };
        var resp = await client.SendAsync(req);
        resp.EnsureSuccessStatusCode();
        return eventId;
    }

    public async Task CreateManualEventAsync(Guid userId, string title, DateTime start, DateTime end, string? description)
    {
        var connections = await _context.CalendarConnections
            .Where(c => c.UserId == userId && c.AutoSync)
            .ToListAsync();
        if (connections.Count == 0) return;

        foreach (var conn in connections)
        {
            try
            {
                await RefreshTokenIfNeededAsync(conn);
                if (conn.Provider == "google")
                    await CreateGoogleEventAsync(conn, conn.CalendarId ?? "primary", title, description ?? "", start, end);
                else if (conn.Provider == "microsoft")
                    await CreateMicrosoftEventAsync(conn, title, description ?? "", start, end);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[calendar] Manual sync failed for provider {Provider}", conn.Provider);
            }
        }
    }

    public async Task<string?> RefreshTokenIfNeededAsync(CalendarConnection conn)
    {
        if (conn.TokenExpiresAt > DateTime.UtcNow.AddMinutes(5))
            return conn.AccessToken;

        if (string.IsNullOrEmpty(conn.RefreshToken))
            return null;

        if (conn.Provider == "google")
            return await RefreshGoogleTokenAsync(conn);
        else if (conn.Provider == "microsoft")
            return await RefreshMicrosoftTokenAsync(conn);

        return null;
    }

    private async Task<string?> RefreshGoogleTokenAsync(CalendarConnection conn)
    {
        var client = _httpClientFactory.CreateClient();
        var clientId = _config["GoogleCalendar:ClientId"];
        var clientSecret = _config["GoogleCalendar:ClientSecret"];

        var body = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("client_id", clientId ?? ""),
            new KeyValuePair<string, string>("client_secret", clientSecret ?? ""),
            new KeyValuePair<string, string>("refresh_token", conn.RefreshToken!),
            new KeyValuePair<string, string>("grant_type", "refresh_token")
        });

        var resp = await client.PostAsync("https://oauth2.googleapis.com/token", body);
        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.TryGetProperty("access_token", out var at))
        {
            conn.AccessToken = at.GetString() ?? conn.AccessToken;
            var expiresIn = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 3600;
            conn.TokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn);
            await _context.SaveChangesAsync();
            return conn.AccessToken;
        }

        _logger.LogWarning("[calendar] Google token refresh failed: {Json}", json);
        return null;
    }

    private async Task<string?> RefreshMicrosoftTokenAsync(CalendarConnection conn)
    {
        var client = _httpClientFactory.CreateClient();
        var clientId = _config["MicrosoftCalendar:ClientId"];
        var clientSecret = _config["MicrosoftCalendar:ClientSecret"];
        var tenantId = _config["MicrosoftCalendar:TenantId"] ?? "common";

        var body = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("client_id", clientId ?? ""),
            new KeyValuePair<string, string>("client_secret", clientSecret ?? ""),
            new KeyValuePair<string, string>("refresh_token", conn.RefreshToken!),
            new KeyValuePair<string, string>("grant_type", "refresh_token"),
            new KeyValuePair<string, string>("scope", "Calendars.ReadWrite")
        });

        var resp = await client.PostAsync($"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token", body);
        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.TryGetProperty("access_token", out var at))
        {
            conn.AccessToken = at.GetString() ?? conn.AccessToken;
            var expiresIn = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 3600;
            conn.TokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn);
            await _context.SaveChangesAsync();
            return conn.AccessToken;
        }

        _logger.LogWarning("[calendar] Microsoft token refresh failed: {Json}", json);
        return null;
    }

    private async Task<string?> CreateGoogleEventAsync(CalendarConnection conn, string calId, string title, string description, DateTime start, DateTime end)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", conn.AccessToken);

        var evt = new
        {
            summary = title,
            description,
            start = new { dateTime = start.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" },
            end = new { dateTime = end.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" },
            transparency = "transparent"
        };

        var json = JsonSerializer.Serialize(evt);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"https://www.googleapis.com/calendar/v3/calendars/{calId}/events", content);
        resp.EnsureSuccessStatusCode();

        var result = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(result);
        return doc.RootElement.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
    }

    private async Task<string?> CreateMicrosoftEventAsync(CalendarConnection conn, string title, string description, DateTime start, DateTime end)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", conn.AccessToken);

        var evt = new
        {
            subject = title,
            body = new { contentType = "text", content = description },
            start = new { dateTime = start.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" },
            end = new { dateTime = end.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" },
            isAllDay = false,
            showAs = "free"
        };

        var json = JsonSerializer.Serialize(evt);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync("https://graph.microsoft.com/v1.0/me/events", content);
        resp.EnsureSuccessStatusCode();

        var result = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(result);
        return doc.RootElement.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
    }
}
