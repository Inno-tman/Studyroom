using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using StudyRoom.API.Models;

namespace StudyRoom.API.Services;

public class LiveKitTokenResult
{
    public string Url { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
}

public interface ILiveKitService
{
    LiveKitTokenResult CreateToken(string roomName, string identity, string displayName, bool canPublish);
}

public class LiveKitService : ILiveKitService
{
    private readonly LivekitSettings _settings;

    public LiveKitService(IOptions<LivekitSettings> settings) => _settings = settings.Value;

    public LiveKitTokenResult CreateToken(string roomName, string identity, string displayName, bool canPublish)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey) || string.IsNullOrWhiteSpace(_settings.ApiSecret))
            throw new InvalidOperationException("LiveKit API key or API secret is not configured. Set Livekit:ApiKey and Livekit:ApiSecret in appsettings.json or environment variables.");

        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        var grants = new Dictionary<string, object>
        {
            ["room"] = roomName,
            ["roomJoin"] = true,
            ["canPublish"] = canPublish,
            ["canSubscribe"] = true,
            ["canPublishData"] = true,
            ["canUpdateOwnMetadata"] = true,
            ["canPublishSources"] = new[] { "camera", "microphone", "screen_share", "screen_share_audio" }
        };

        var claims = new List<Claim>
        {
            new Claim("iss", _settings.ApiKey),
            new Claim("sub", _settings.ApiKey),
            new Claim("nbf", (now - 10).ToString()),
            new Claim("exp", (now + 3600).ToString()),
            new Claim("jti", Guid.NewGuid().ToString("N")),
            new Claim("name", displayName),
            new Claim("video", JsonSerializer.Serialize(grants), "JSON")
        };

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.ApiSecret));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
        var header = new JwtHeader(credentials);

        var payload = new JwtPayload();
        foreach (var claim in claims)
            payload.AddClaim(claim);

        var token = new JwtSecurityToken(header, payload);
        var encoded = new JwtSecurityTokenHandler().WriteToken(token);

        return new LiveKitTokenResult
        {
            Url = _settings.Url,
            Token = encoded
        };
    }
}