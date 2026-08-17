using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using StudyRoom.API.Models;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/youtube")]
[Authorize]
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
                thumbnail = i.Snippet?.Thumbnails?.Default?.Url ?? ""
            })
            .ToList() ?? new List<object>();

        return Ok(new { configured = true, items });
    }

    /// <summary>
    /// Resolves a direct audio-stream URL for a video via yt-dlp so the app can play
    /// background audio (screen off / app backgrounded) without YouTube's iframe.
    /// </summary>
    [HttpGet("audio")]
    public async Task<IActionResult> Audio([FromQuery] string id, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(id) || !Regex.IsMatch(id, "^[A-Za-z0-9_-]{11}$"))
            return BadRequest(new { error = "Invalid video id." });

        var psi = new ProcessStartInfo
        {
            FileName = "yt-dlp",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };
        psi.ArgumentList.Add("-f");
        psi.ArgumentList.Add("bestaudio[ext=m4a]/bestaudio/best");
        psi.ArgumentList.Add("-g");
        psi.ArgumentList.Add("--no-playlist");
        psi.ArgumentList.Add("--no-warnings");
        psi.ArgumentList.Add($"https://www.youtube.com/watch?v={id}");

        using var proc = new Process { StartInfo = psi };
        if (!proc.Start())
            return StatusCode(502, new { error = "yt-dlp is not available on the server." });

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        try
        {
            var outputTask = proc.StandardOutput.ReadToEndAsync(timeout.Token);
            var errorTask = proc.StandardError.ReadToEndAsync(timeout.Token);
            await proc.WaitForExitAsync(timeout.Token);

            var url = (await outputTask).Split('\n', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.Trim();
            if (string.IsNullOrWhiteSpace(url))
            {
                var err = (await errorTask).Trim();
                return StatusCode(502, new { error = "Could not resolve an audio stream for this video." + (err.Length > 0 ? " " + err.Split('\n').Last().Trim() : "") });
            }
            return Ok(new { url });
        }
        catch (OperationCanceledException)
        {
            try { proc.Kill(entireProcessTree: true); } catch { }
            return StatusCode(504, new { error = "Timed out resolving the audio stream." });
        }
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
}

public class YoutubeThumbnail
{
    public string? Url { get; set; }
}