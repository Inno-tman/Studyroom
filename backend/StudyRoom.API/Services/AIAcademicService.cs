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
    public string Model { get; set; } = "llama-3.3-70b-versatile";
    public string Endpoint { get; set; } = "https://api.groq.com/openai/v1/chat/completions";
    public int MaxTokens { get; set; } = 4096;
}

public class AIAcademicService : IAIAcademicService
{
    private readonly HttpClient _http;
    private readonly AiSettings _settings;
    private readonly ILogger<AIAcademicService> _logger;
    private readonly IResearchService _research;
    private static readonly SemaphoreSlim _rateGate = new(1, 1);
    private static DateTime _lastRequestTime = DateTime.MinValue;

    private static readonly string[] ResearchPhases =
    {
        "Phase 1: Research Introduction — Provide background context, significance, and scope of the research area",
        "Phase 2: Problem Statement — Define the specific research problem, identify gaps in existing literature, and state research questions or hypotheses",
        "Phase 3: Literature Review — Summarize and synthesize relevant existing work, identify theoretical frameworks, and establish the foundation for your research",
        "Phase 4: Research Methodology — Describe research design, data collection methods, analysis techniques, and any ethical considerations",
        "Phase 5: Expected Outcomes — Discuss anticipated results, contributions to the field, and potential implications",
        "Phase 6: Timeline & Milestones — Provide a project schedule with key deliverables and evaluation criteria"
    };

    public AIAcademicService(HttpClient http, IOptions<AiSettings> settings, ILogger<AIAcademicService> logger, IResearchService research)
    {
        _http = http;
        _settings = settings.Value;
        _logger = logger;
        _research = research;
    }

    public async Task<AcademicResponseDto> AskAsync(AcademicQueryDto query)
    {
        if (query.ResearchMode)
            return await HandleResearchQuery(query);

        return await HandleGeneralQuery(query);
    }

    private async Task<AcademicResponseDto> HandleGeneralQuery(AcademicQueryDto query)
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

        var result = await CallAiProvider(systemPrompt, query.Question, query.Subject, query.PreviousMessages);
        result.CreatedAt = DateTime.UtcNow;
        return result;
    }

    private async Task<AcademicResponseDto> HandleResearchQuery(AcademicQueryDto query)
    {
        var userMessage = query.Question;
        var currentPhase = query.ResearchPhase ?? "Phase 1: Research Introduction";

        var phaseIndex = Array.FindIndex(ResearchPhases, p => p.StartsWith(currentPhase));
        if (phaseIndex < 0) phaseIndex = 0;

        var nextPhase = phaseIndex < ResearchPhases.Length - 1
            ? ResearchPhases[phaseIndex + 1].Split(" — ")[0]
            : null;

        var allPhases = ResearchPhases.Select((p, i) => new ResearchPhase
        {
            Phase = p.Split(" — ")[0],
            Description = p.Split(" — ")[1],
            Completed = i < phaseIndex
        }).ToList();

        var papers = await _research.SearchPapersAsync(userMessage, 5);

        var papersContext = papers.Papers.Count > 0
            ? "\nRelevant academic papers found:\n" + string.Join("\n", papers.Papers.Select((p, i) =>
                $"{i + 1}. \"{p.Title}\" by {p.Authors} ({p.Year})" +
                (p.Venue != null ? $" — {p.Venue}" : "") +
                (p.CitationCount != null ? $" — Cited: {p.CitationCount}" : "") +
                (p.Url != null ? $"\n   URL: {p.Url}" : "")))
            : "\n(No specific papers found for this query. The AI will provide general academic guidance.)";

        var systemPrompt = $"""
You are an academic research assistant AI in StudyRoom. Your role is to help users conduct academic research using proper research methodology.

Current Research Phase: {currentPhase}
{allPhases.FirstOrDefault(p => p.Phase == currentPhase)?.Description ?? ""}

{papersContext}

Research Methodology Guidelines:
1. Follow the standard academic research process step by step
2. Cite specific academic papers when making claims (use the references provided above)
3. Format citations as [Author, Year] at minimum
4. Maintain academic tone and rigor
5. If the user asks to move to the next phase, provide a smooth transition
6. Always provide complete, well-structured responses appropriate for the current phase
7. Include a references section at the end citing all papers mentioned

The full research process:
{string.Join("\n", ResearchPhases.Select(p => "- " + p))}
""";

        var result = await CallAiProvider(systemPrompt, userMessage, query.Subject, query.PreviousMessages);

        return new AcademicResponseDto
        {
            Answer = result.Answer,
            Subject = query.Subject,
            CreatedAt = DateTime.UtcNow,
            IsResearchMode = true,
            CurrentPhase = currentPhase.Split(" — ")[0],
            NextPhase = nextPhase,
            References = papers.Papers,
            ResearchOutline = allPhases,
            IsError = result.IsError,
            ErrorMessage = result.ErrorMessage
        };
    }

    private async Task<AcademicResponseDto> CallAiProvider(string systemPrompt, string userMessage, string? subject, List<DTOs.AI.PreviousMessageDto>? history = null)
    {
        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };

        if (history != null)
        {
            var recent = history.Count > 10
                ? history.Skip(history.Count - 10).ToList()
                : history;
            foreach (var msg in recent)
            {
                messages.Add(new { role = msg.Role, content = msg.Content });
            }
        }

        messages.Add(new { role = "user", content = userMessage });

        var payload = new
        {
            model = _settings.Model,
            messages = messages.ToArray(),
            max_tokens = _settings.MaxTokens,
            temperature = 0.7
        };

        if (!string.IsNullOrEmpty(_settings.ApiKey))
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(90));

        await _rateGate.WaitAsync(cts.Token);
        try
        {
            var sinceLast = DateTime.UtcNow - _lastRequestTime;
            if (sinceLast.TotalSeconds < 2.5)
                await Task.Delay(TimeSpan.FromSeconds(2.5) - sinceLast, cts.Token);
            _lastRequestTime = DateTime.UtcNow;
        }
        finally { _rateGate.Release(); }

        string? lastError = null;
        for (var attempt = 0; attempt <= 2; attempt++)
        {
            if (attempt > 0)
                await Task.Delay(2000 * attempt, cts.Token);

            cts.Token.ThrowIfCancellationRequested();

            try
            {
                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var reqCts = CancellationTokenSource.CreateLinkedTokenSource(cts.Token);
                reqCts.CancelAfter(TimeSpan.FromSeconds(30));
                var response = await _http.PostAsync(_settings.Endpoint, content, reqCts.Token);

                if ((int)response.StatusCode == 429)
                {
                    lastError = "rate limited";
                    var retryAfter = response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 10;
                    _logger.LogWarning("Groq rate limited (429). Waiting {Seconds}s before retry.", retryAfter);
                    await Task.Delay(TimeSpan.FromSeconds(Math.Min(retryAfter, 15)), cts.Token);
                    continue;
                }

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
                    Subject = subject,
                    CreatedAt = DateTime.UtcNow
                };
            }
            catch (OperationCanceledException)
            {
                lastError = "timed out";
                _logger.LogWarning("AI provider request timed out (attempt {Attempt}/3)", attempt + 1);
            }
            catch (HttpRequestException ex)
            {
                lastError = ex.Message;
                _logger.LogWarning(ex, "AI provider attempt {Attempt}/3 failed.", attempt + 1);
            }
        }

        var errMsg = lastError switch
        {
            "rate limited" => "AI service is rate limited. Please wait a minute and try again.",
            "timed out" => "AI service timed out. Groq may be overloaded — please wait a moment and try again.",
            _ => $"AI service unavailable. Please wait a moment and try again. ({lastError})"
        };
        return new AcademicResponseDto
        {
            Answer = GenerateFallbackResponse(userMessage, subject),
            Subject = subject,
            IsError = true,
            ErrorMessage = errMsg
        };
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

        if (q.Contains("hello") || q.Contains("hi ") || q == "hi")
            return "Hello! I'm your StudyRoom academic assistant. What subject are you studying today? I can help with math, science, programming, and more.";

        return "Great question! To provide the most helpful response, could you narrow down the specific topic or concept you're studying? I can assist with mathematics, physics, chemistry, biology, computer science, literature, and more.";
    }
}
