using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Google.Apis.Auth;
using ReportGenerator.Wpf.Models;

namespace ReportGenerator.Wpf.Services;

public class GoogleAuthService : IGoogleAuthService
{
    private const string AuthEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
    private const string TokenEndpoint = "https://oauth2.googleapis.com/token";
    private static readonly string[] Scopes = { "openid", "profile", "email" };

    private readonly HttpClient _httpClient = new();

    public async Task<GoogleUser?> SignInAsync(string clientId)
    {
        if (string.IsNullOrWhiteSpace(clientId))
            throw new InvalidOperationException("Google Client ID is not configured. Create a Desktop OAuth client in Google Cloud Console and paste its Client ID.");

        var verifier = GenerateCodeVerifier();
        var challenge = Base64UrlEncode(SHA256.HashData(Encoding.UTF8.GetBytes(verifier)));
        var state = Guid.NewGuid().ToString("N");

        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var redirectUri = $"http://127.0.0.1:{port}/oauth2callback";

        var authUrl = $"{AuthEndpoint}?" +
            $"client_id={Uri.EscapeDataString(clientId)}&" +
            $"redirect_uri={Uri.EscapeDataString(redirectUri)}&" +
            "response_type=code&" +
            $"scope={Uri.EscapeDataString(string.Join(" ", Scopes))}&" +
            $"state={state}&" +
            $"code_challenge={challenge}&" +
            "code_challenge_method=S256";

        Process.Start(new ProcessStartInfo(authUrl) { UseShellExecute = true });

        var code = await WaitForCallbackAsync(listener, state);
        if (string.IsNullOrEmpty(code))
            return null;

        var idToken = await ExchangeCodeForIdTokenAsync(clientId, code, verifier, redirectUri);
        if (string.IsNullOrEmpty(idToken))
            return null;

        return await ValidateAndMapAsync(idToken, clientId);
    }

    private static async Task<string?> WaitForCallbackAsync(TcpListener listener, string expectedState)
    {
        try
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var buffer = new byte[8192];
            var read = await stream.ReadAsync(buffer, 0, buffer.Length);
            var request = Encoding.UTF8.GetString(buffer, 0, read);
            var requestLine = request.Split("\r\n")[0];
            var pathAndQuery = requestLine.Split(' ')[1];

            var query = new Uri($"http://localhost{pathAndQuery}").Query.TrimStart('?');
            var pairs = query.Split('&')
                .Where(p => p.Contains('='))
                .Select(p => p.Split('=', 2))
                .ToDictionary(a => a[0], a => Uri.UnescapeDataString(a[1]));

            var error = pairs.GetValueOrDefault("error");
            var code = pairs.GetValueOrDefault("code");
            var state = pairs.GetValueOrDefault("state");

            string html;
            if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code) || state != expectedState)
            {
                html = "<html><body style='font-family:sans-serif;text-align:center;padding:60px;'><h2>Sign-in failed</h2><p>You can close this window and try again.</p></body></html>";
                code = null!;
            }
            else
            {
                html = "<html><body style='font-family:sans-serif;text-align:center;padding:60px;'><h2>Sign-in successful!</h2><p>You can close this window and return to the app.</p></body></html>";
            }

            var body = Encoding.UTF8.GetBytes(html);
            var header = Encoding.UTF8.GetBytes(
                $"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n");
            await stream.WriteAsync(header, 0, header.Length);
            await stream.WriteAsync(body, 0, body.Length);
            await stream.FlushAsync();

            return code;
        }
        catch
        {
            return null;
        }
    }

    private async Task<string?> ExchangeCodeForIdTokenAsync(string clientId, string code, string verifier, string redirectUri)
    {
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = clientId,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code",
            ["code_verifier"] = verifier
        });

        var response = await _httpClient.PostAsync(TokenEndpoint, content);
        if (!response.IsSuccessStatusCode)
            return null;

        using var json = await response.Content.ReadAsStreamAsync();
        var doc = await JsonDocument.ParseAsync(json);
        return doc.RootElement.TryGetProperty("id_token", out var idTokenProp)
            ? idTokenProp.GetString()
            : null;
    }

    private static async Task<GoogleUser?> ValidateAndMapAsync(string idToken, string clientId)
    {
        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { clientId }
                });

            return new GoogleUser
            {
                GoogleId = payload.Subject,
                Email = payload.Email,
                FirstName = payload.GivenName ?? string.Empty,
                LastName = payload.FamilyName ?? string.Empty,
                Picture = payload.Picture ?? string.Empty,
                DisplayName = string.IsNullOrWhiteSpace(payload.Name)
                    ? payload.Email
                    : payload.Name
            };
        }
        catch
        {
            return null;
        }
    }

    private static string GenerateCodeVerifier()
    {
        var bytes = new byte[48];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Base64UrlEncode(bytes);
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    public void SignOut()
    {
        // Nothing persisted in memory to clear beyond caller state.
    }
}
