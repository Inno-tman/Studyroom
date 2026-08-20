using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using StudyRoom.API.Models;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/youtube")]
[Authorize]
[EnableRateLimiting("search")]
public class YoutubeController : ControllerBase
{
    private readonly IHttpClientFactory _http;
    private readonly IOptions<YoutubeSettings> _settings;

    public YoutubeController(IHttpClientFactory http, IOptions<YoutubeSettings> settings)
    {
        _http = http;
        _settings = settings;
    }

    /// <summary>Searches YouTube videos via the Data API v3 (key stays server-side).</summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, [FromQuery] int max = 12)
    {
        var key = _settings.Value.ApiKey;
        if (string.IsNullOrWhiteSpace(key))
            return Ok(new { configured = false, items = Array.Empty<object>() });

        if (string.IsNullOrWhiteSpace(q) || q.Length > 120)
            return BadRequest("Provide a search query.");

        var url = $"https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults={Math.Clamp(max, 1, 24)}&q={Uri.EscapeDataString(q)}&key={Uri.EscapeDataString(key)}";

        using var client = _http.CreateClient();
        var resp = await client.GetAsync(url);
        if (!resp.IsSuccessStatusCode)
            return StatusCode((int)resp.StatusCode, new { configured = true, error = "YouTube search failed. Check the API key." });

        var body = await resp.Content.ReadFromJsonAsync<YoutubeSearchResponse>();
        var items = body?.Items
            ?.Where(i => i?.Id?.VideoId is not null)
            .Select<YoutubeSearchItem, object>(i => new
            {
                id = i.Id!.VideoId,
                title = i.Snippet?.Title ?? "Untitled",
                channel = i.Snippet?.ChannelTitle ?? "",
                thumbnail = i.Snippet?.Thumbnails?.Medium?.Url
                    ?? i.Snippet?.Thumbnails?.High?.Url
                    ?? i.Snippet?.Thumbnails?.Default?.Url
                    ?? ""
            })
            .ToList() ?? new List<object>();

        return Ok(new { configured = true, items });
    }
}

public class YoutubeSearchResponse
{
    public List<YoutubeSearchItem>? Items { get; set; }
}

public class YoutubeSearchItem
{
    public YoutubeSearchId? Id { get; set; }
    public YoutubeSnippet? Snippet { get; set; }
}

public class YoutubeSearchId
{
    public string? VideoId { get; set; }
}

public class YoutubeSnippet
{
    public string? Title { get; set; }
    public string? ChannelTitle { get; set; }
    public YoutubeThumbnails? Thumbnails { get; set; }
}

public class YoutubeThumbnails
{
    public YoutubeThumbnail? Default { get; set; }
    public YoutubeThumbnail? Medium { get; set; }
    public YoutubeThumbnail? High { get; set; }
}

public class YoutubeThumbnail
{
    public string? Url { get; set; }
}