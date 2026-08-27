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
    Task<string?> CreateStudyEventAsync(Guid userId, string title, DateTime start, DateTime end, string? description);
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

    public async Task<string?> CreateStudyEventAsync(Guid userId, string title, DateTime start, DateTime end, string? description)
    {
        var connections = await _context.CalendarConnections
            .Where(c => c.UserId == userId && c.AutoSync)
            .ToListAsync();

        foreach (var conn in connections)
        {
            try
            {
                await RefreshTokenIfNeededAsync(conn);
                if (conn.Provider == "google")
                    await CreateGoogleEventAsync(conn, title, start, end, description);
                else if (conn.Provider == "microsoft")
                    await CreateMicrosoftEventAsync(conn, title, start, end, description);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[calendar] Failed to create event for provider {Provider}", conn.Provider);
            }
        }

        return "synced";
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

    private async Task CreateGoogleEventAsync(CalendarConnection conn, string title, DateTime start, DateTime end, string? description)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", conn.AccessToken);

        var calId = conn.CalendarId ?? "primary";
        var evt = new
        {
            summary = title,
            description = description ?? "Study session synced from StudyRoom",
            start = new { dateTime = start.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" },
            end = new { dateTime = end.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" },
            transparency = "transparent"
        };

        var json = JsonSerializer.Serialize(evt);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"https://www.googleapis.com/calendar/v3/calendars/{calId}/events", content);
        resp.EnsureSuccessStatusCode();
    }

    private async Task CreateMicrosoftEventAsync(CalendarConnection conn, string title, DateTime start, DateTime end, string? description)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", conn.AccessToken);

        var evt = new
        {
            subject = title,
            body = new { contentType = "text", content = description ?? "Study session synced from StudyRoom" },
            start = new { dateTime = start.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" },
            end = new { dateTime = end.ToString("yyyy-MM-ddTHH:mm:ssZ"), timeZone = "UTC" },
            isAllDay = false,
            showAs = "free"
        };

        var json = JsonSerializer.Serialize(evt);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync("https://graph.microsoft.com/v1.0/me/events", content);
        resp.EnsureSuccessStatusCode();
    }
}
