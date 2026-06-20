using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using StudyRoom.API.DTOs.AI;

namespace StudyRoom.API.Services;

public class AiSettings
{
    public string Provider { get; set; } = "openai";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gpt-4o-mini";
    public string Endpoint { get; set; } = "https://api.openai.com/v1/chat/completions";
    public int MaxTokens { get; set; } = 1024;
}

public class AIAcademicService : IAIAcademicService
{
    private readonly HttpClient _http;
    private readonly AiSettings _settings;
    private readonly ILogger<AIAcademicService> _logger;

    public AIAcademicService(HttpClient http, IOptions<AiSettings> settings, ILogger<AIAcademicService> logger)
    {
        _http = http;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<AcademicResponseDto> AskAsync(AcademicQueryDto query)
    {
        var subjectContext = !string.IsNullOrWhiteSpace(query.Subject)
            ? $"The user is studying: {query.Subject}.\n"
            : "";

        var notesContext = !string.IsNullOrWhiteSpace(query.Context)
            ? $"Additional context from the study room notes:\n{query.Context}\n"
            : "";

        var systemPrompt = $"""
You are an academic tutor AI in a collaborative study platform called StudyRoom. 
Your role is to help students understand concepts, solve problems, and learn effectively.

{subjectContext}{notesContext}
Guidelines:
- Explain concepts clearly with examples when helpful
- Break down complex problems step by step
- Encourage critical thinking rather than just giving answers
- If asked about code, provide well-structured examples
- For math, use clear notation
- Keep responses focused and educational
- If you don't know something, be honest about it
""";

        var payload = new
        {
            model = _settings.Model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = query.Question }
            },
            max_tokens = _settings.MaxTokens,
            temperature = 0.7
        };

        try
        {
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            if (!string.IsNullOrEmpty(_settings.ApiKey))
                _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey);

            var response = await _http.PostAsync(_settings.Endpoint, content);
            response.EnsureSuccessStatusCode();

            var responseJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseJson);

            var answer = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "I'm sorry, I couldn't generate a response.";

            return new AcademicResponseDto
            {
                Answer = answer,
                Subject = query.Subject,
                CreatedAt = DateTime.UtcNow
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "AI provider request failed");

            return new AcademicResponseDto
            {
                Answer = GenerateFallbackResponse(query.Question, query.Subject),
                Subject = query.Subject
            };
        }
    }

    private static string GenerateFallbackResponse(string question, string? subject)
    {
        var q = question.ToLowerInvariant();

        if (q.Contains("derivative") || q.Contains("calculus"))
            return "To find a derivative, use the power rule: d/dx[x^n] = nx^(n-1). For example, the derivative of x² is 2x. Would you like me to walk through a specific problem?";

        if (q.Contains("integration") || q.Contains("integral"))
            return "Integration is the reverse of differentiation. The integral of x^n dx = x^(n+1)/(n+1) + C (where n ≠ -1). Try applying this to your problem.";

        if (q.Contains("newton") || q.Contains("force") || q.Contains("physics"))
            return "Newton's Second Law: F = ma. The net force on an object equals its mass times its acceleration. Need help applying it?";

        if (q.Contains("binary") || q.Contains("tree") || q.Contains("algorithm"))
            return "A binary tree is a hierarchical data structure where each node has at most two children. Common operations include insertion, deletion, and traversal (in-order, pre-order, post-order).";

        if (q.Contains("hello") || q.Contains("hi "))
            return "Hello! I'm your StudyRoom academic assistant. What subject are you studying today? I can help with math, science, programming, and more.";

        return "Great question! To provide the most helpful response, could you narrow down the specific topic or concept you're studying? I can assist with mathematics, physics, chemistry, biology, computer science, literature, and more.";
    }
}
