using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
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
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        var grants = new JsonObject
        {
            ["room"] = roomName,
            ["roomJoin"] = true,
            ["canPublish"] = canPublish,
            ["canSubscribe"] = true,
            ["canPublishData"] = true,
            ["canUpdateOwnMetadata"] = true,
            ["canPublishSources"] = new JsonArray("camera", "microphone", "screen_share", "screen_share_audio")
        };

        var payload = new JwtPayload
        {
            ["iss"] = _settings.ApiKey,
            ["sub"] = _settings.ApiKey,
            ["nbf"] = now - 10,
            ["exp"] = now + 3600,
            ["jti"] = Guid.NewGuid().ToString("N"),
            ["name"] = displayName,
            ["video"] = JsonNode.Parse(grants.ToJsonString())
        };

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.ApiSecret));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
        var header = new JwtHeader(credentials);

        var token = new JwtSecurityToken(header, payload);
        var encoded = new JwtSecurityTokenHandler().WriteToken(token);

        return new LiveKitTokenResult
        {
            Url = _settings.Url,
            Token = encoded
        };
    }
}