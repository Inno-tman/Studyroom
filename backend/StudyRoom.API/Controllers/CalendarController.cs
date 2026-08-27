using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/calendar")]
[Authorize]
public class CalendarController : ControllerBase
{
    private readonly ICalendarService _calendarService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;

    public CalendarController(
        ICalendarService calendarService,
        IHttpClientFactory httpClientFactory,
        IConfiguration config)
    {
        _calendarService = calendarService;
        _httpClientFactory = httpClientFactory;
        _config = config;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("connections")]
    public async Task<IActionResult> GetConnections()
    {
        var connections = await _calendarService.GetAllConnectionsAsync(UserId);
        return Ok(connections.Select(c => new
        {
            id = c.Id,
            provider = c.Provider,
            calendarName = c.CalendarName,
            autoSync = c.AutoSync,
            connectedAt = c.ConnectedAt
        }));
    }

    [HttpGet("google/auth-url")]
    public IActionResult GetGoogleAuthUrl([FromQuery] string redirectUri)
    {
        var clientId = _config["GoogleCalendar:ClientId"];
        var scopes = "https://www.googleapis.com/auth/calendar.events";
        var url = $"https://accounts.google.com/o/oauth2/v2/auth?" +
            $"client_id={clientId}&" +
            $"redirect_uri={Uri.EscapeDataString(redirectUri)}&" +
            $"response_type=code&" +
            $"scope={Uri.EscapeDataString(scopes)}&" +
            $"access_type=offline&" +
            $"prompt=consent";
        return Ok(new { url });
    }

    [HttpPost("google/callback")]
    public async Task<IActionResult> GoogleCallback([FromBody] GoogleCallbackRequest request)
    {
        var client = _httpClientFactory.CreateClient();
        var clientId = _config["GoogleCalendar:ClientId"];
        var clientSecret = _config["GoogleCalendar:ClientSecret"];

        var body = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("code", request.Code),
            new KeyValuePair<string, string>("client_id", clientId ?? ""),
            new KeyValuePair<string, string>("client_secret", clientSecret ?? ""),
            new KeyValuePair<string, string>("redirect_uri", request.RedirectUri),
            new KeyValuePair<string, string>("grant_type", "authorization_code")
        });

        var resp = await client.PostAsync("https://oauth2.googleapis.com/token", body);
        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (!root.TryGetProperty("access_token", out var at))
            return BadRequest(new { error = "Token exchange failed" });

        var accessToken = at.GetString()!;
        var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 3600;

        // Get primary calendar
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        var calResp = await client.GetAsync("https://www.googleapis.com/calendar/v3/users/me/calendarList/primary");
        string? calendarId = null;
        string? calendarName = null;
        if (calResp.IsSuccessStatusCode)
        {
            var calJson = await calResp.Content.ReadAsStringAsync();
            using var calDoc = JsonDocument.Parse(calJson);
            calendarId = calDoc.RootElement.TryGetProperty("id", out var cid) ? cid.GetString() : "primary";
            calendarName = calDoc.RootElement.TryGetProperty("summary", out var cn) ? cn.GetString() : "Google Calendar";
        }

        var conn = await _calendarService.SaveConnectionAsync(
            UserId, "google", accessToken, refreshToken,
            DateTime.UtcNow.AddSeconds(expiresIn), calendarId, calendarName);

        return Ok(new { connected = true, calendarName = conn.CalendarName });
    }

    [HttpGet("microsoft/auth-url")]
    public IActionResult GetMicrosoftAuthUrl([FromQuery] string redirectUri)
    {
        var clientId = _config["MicrosoftCalendar:ClientId"];
        var tenantId = _config["MicrosoftCalendar:TenantId"] ?? "common";
        var scopes = "Calendars.ReadWrite";
        var url = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize?" +
            $"client_id={clientId}&" +
            $"redirect_uri={Uri.EscapeDataString(redirectUri)}&" +
            $"response_type=code&" +
            $"scope={Uri.EscapeDataString(scopes)}&" +
            $"response_mode=query";
        return Ok(new { url });
    }

    [HttpPost("microsoft/callback")]
    public async Task<IActionResult> MicrosoftCallback([FromBody] MicrosoftCallbackRequest request)
    {
        var client = _httpClientFactory.CreateClient();
        var clientId = _config["MicrosoftCalendar:ClientId"];
        var clientSecret = _config["MicrosoftCalendar:ClientSecret"];
        var tenantId = _config["MicrosoftCalendar:TenantId"] ?? "common";

        var body = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("code", request.Code),
            new KeyValuePair<string, string>("client_id", clientId ?? ""),
            new KeyValuePair<string, string>("client_secret", clientSecret ?? ""),
            new KeyValuePair<string, string>("redirect_uri", request.RedirectUri),
            new KeyValuePair<string, string>("grant_type", "authorization_code"),
            new KeyValuePair<string, string>("scope", "Calendars.ReadWrite")
        });

        var resp = await client.PostAsync($"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token", body);
        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (!root.TryGetProperty("access_token", out var at))
            return BadRequest(new { error = "Token exchange failed" });

        var accessToken = at.GetString()!;
        var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 3600;

        // Get default calendar
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        var calResp = await client.GetAsync("https://graph.microsoft.com/v1.0/me/calendar");
        string? calendarId = null;
        string? calendarName = null;
        if (calResp.IsSuccessStatusCode)
        {
            var calJson = await calResp.Content.ReadAsStringAsync();
            using var calDoc = JsonDocument.Parse(calJson);
            calendarId = calDoc.RootElement.TryGetProperty("id", out var cid) ? cid.GetString() : null;
            calendarName = calDoc.RootElement.TryGetProperty("name", out var cn) ? cn.GetString() : "Outlook Calendar";
        }

        var conn = await _calendarService.SaveConnectionAsync(
            UserId, "microsoft", accessToken, refreshToken,
            DateTime.UtcNow.AddSeconds(expiresIn), calendarId, calendarName);

        return Ok(new { connected = true, calendarName = conn.CalendarName });
    }

    [HttpPost("disconnect/{connectionId}")]
    public async Task<IActionResult> Disconnect(Guid connectionId)
    {
        await _calendarService.DisconnectAsync(connectionId, UserId);
        return Ok(new { disconnected = true });
    }

    [HttpPost("auto-sync")]
    public async Task<IActionResult> UpdateAutoSync([FromBody] AutoSyncRequest request)
    {
        await _calendarService.UpdateAutoSyncAsync(request.ConnectionId, request.Enabled, UserId);
        return Ok(new { updated = true });
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncNow([FromBody] SyncRequest request)
    {
        var result = await _calendarService.CreateStudyEventAsync(
            UserId, request.Title, request.Start, request.End, request.Description);
        return Ok(new { synced = true });
    }
}

public class GoogleCallbackRequest
{
    public string Code { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}

public class MicrosoftCallbackRequest
{
    public string Code { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}

public class AutoSyncRequest
{
    public Guid ConnectionId { get; set; }
    public bool Enabled { get; set; }
}

public class SyncRequest
{
    public string Title { get; set; } = string.Empty;
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string? Description { get; set; }
}
