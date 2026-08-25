using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ReportGenerator.Wpf.Services;

public class GroqService : IGroqService
{
    private readonly HttpClient _httpClient;
    private string _baseUrl = "https://api.groq.com/openai/v1";

    public GroqService()
    {
        _httpClient = new HttpClient();
    }

    public void SetBaseUrl(string url)
    {
        _baseUrl = url.TrimEnd('/');
    }

    public async Task<string> GenerateSqlAsync(string prompt, string schema, string apiKey, string? model = null)
    {
        var requestModel = model ?? "llama-3.3-70b-versatile";

        var systemPrompt = $@"You are a SQL query generator. Given the following database schema, generate a SQL query that answers the user's question.

Database Schema:
{schema}

IMPORTANT RULES:
1. Return ONLY the raw SQL query text, no markdown, no backticks, no explanations
2. Use standard SQL syntax compatible with most databases
3. Use proper table and column names exactly as shown in the schema
4. Do not use any schema prefixes (like dbo.) unless the schema shows them
5. Use TOP for SQL Server, LIMIT for PostgreSQL/MySQL/SQLite when limiting results
6. If the user asks for a count, use COUNT(*) with appropriate GROUP BY
7. Always add a reasonable LIMIT or TOP (max 1000 rows) to the query";

        var payload = new
        {
            model = requestModel,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = prompt }
            },
            temperature = 0.1,
            max_tokens = 2000
        };

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/chat/completions");
        request.Headers.Add("Authorization", $"Bearer {apiKey}");
        request.Content = JsonContent.Create(payload);

        try
        {
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadFromJsonAsync<GroqResponse>();

            if (json?.Choices == null || json.Choices.Length == 0)
                throw new Exception("No response from AI");

            var content = json.Choices[0].Message.Content.Trim();

            if (content.StartsWith("```"))
            {
                var lines = content.Split('\n');
                content = string.Join("\n", lines
                    .SkipWhile(l => l.StartsWith("```"))
                    .Reverse()
                    .SkipWhile(l => l.StartsWith("```"))
                    .Reverse());
            }

            return content.Trim();
        }
        catch (HttpRequestException ex)
        {
            throw new Exception($"API request failed: {ex.Message}", ex);
        }
    }

    private class GroqResponse
    {
        [JsonPropertyName("choices")]
        public GroqChoice[]? Choices { get; set; }
    }

    private class GroqChoice
    {
        [JsonPropertyName("message")]
        public GroqMessage Message { get; set; } = new();
    }

    private class GroqMessage
    {
        [JsonPropertyName("content")]
        public string Content { get; set; } = "";
    }
}
