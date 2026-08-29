using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using StudyRoom.API.DTOs.AI;
using StudyRoom.API.DTOs.Flashcards;

namespace StudyRoom.API.Services;

public class AiSettings
{
    public string Provider { get; set; } = "gemini";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gemini-2.5-flash";
    public int MaxTokens { get; set; } = 800;
}

public class AIAcademicService : IAIAcademicService
{
    private readonly HttpClient _http;
    private readonly AiSettings _settings;
    private readonly ILogger<AIAcademicService> _logger;
    private readonly IResearchService _research;

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

    public async Task<GameContentDto> GenerateGameContentAsync(GameContentRequestDto request)
    {
        var game = (request.Game ?? string.Empty).ToLowerInvariant();
        if (game is not ("quiz" or "truefalse" or "memory" or "scramble" or "math"))
            return new GameContentDto { Ok = false, Error = "Unknown game type." };

        try
        {
            var (system, user) = BuildGamePrompt(request, game);
            var raw = await CallGeminiRawAsync(system, user);
            var content = ParseGameContent(raw, game, Math.Clamp(request.Count, 1, 30));

            if (content == null)
                return new GameContentDto { Ok = false, Error = "The AI returned an unreadable response. Built-in questions used." };

            content.Ok = true;
            content.Topic = request.Topic;
            content.Difficulty = request.Difficulty;
            return content;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Game generation timed out for game={Game}.", game);
            return new GameContentDto { Ok = false, Error = "AI took too long to respond. Built-in questions used." };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Game generation failed for game={Game}.", game);
            return new GameContentDto
            {
                Ok = false,
                Error = ex.Message.Contains("not configured")
                    ? "AI is not configured yet. Built-in questions used."
                    : "AI is unavailable right now. Built-in questions used."
            };
        }
    }

    public async Task<GenerateFlashcardsResultDto> GenerateFlashcardsAsync(GenerateFlashcardsRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
            return new GenerateFlashcardsResultDto { Ok = false, Error = "No source content provided." };

        var count = Math.Clamp(request.Count, 3, 30);
        var focus = string.IsNullOrWhiteSpace(request.Focus) ? null : request.Focus.Trim();

        var content = request.Content.Trim();
        if (content.Length > 6000)
            content = content.Substring(0, 6000);

        try
        {
            var (system, user) = BuildFlashcardPrompt(content, count, focus);
            var raw = await CallGeminiRawAsync(system, user);
            var result = ParseFlashcards(raw, count);

            if (result == null)
                return new GenerateFlashcardsResultDto { Ok = false, Error = "The AI returned an unreadable response. Try again or add cards manually." };

            result.Ok = true;
            result.SuggestedTitle = focus ?? TrimToTitle(content);
            return result;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Flashcard generation timed out.");
            return new GenerateFlashcardsResultDto { Ok = false, Error = "AI took too long to respond. Try again or add cards manually." };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Flashcard generation failed.");
            return new GenerateFlashcardsResultDto
            {
                Ok = false,
                Error = ex.Message.Contains("not configured")
                    ? "AI is not configured yet. Add cards manually."
                    : "AI is unavailable right now. Add cards manually."
            };
        }
    }

    private static (string System, string User) BuildFlashcardPrompt(string content, int count, string? focus)
    {
        var brief = content.Length > 700 ? content.Substring(0, 700) + "…" : content;

        var system = $"""
You are an expert flashcard creator for a study app called ResVibe. You turn study material into clear, focused flashcards.
Rules:
- Create exactly {count} flashcards from the source notes.
- Front: a concise question, term, or prompt (under 160 characters).
- Back: a complete but concise answer/definition (under 500 characters).
- Cards must be genuinely useful for memorizing the material — cover distinct concepts, don't duplicate.
- Prefer English as the primary language; keep Math/Code snippets verbatim where present.
- {(!string.IsNullOrWhiteSpace(focus) ? $"Stay focused on: {focus}." : "Cover the most important concepts in the notes.")}
- Respond with ONLY valid JSON matching this schema, no markdown fences:
{"{\"cards\":[{\"front\":\"...\",\"back\":\"...\"}],\"title\":\"A short deck title\"}"}
""";

        var user = $"""
Source material (may be truncated):
---
{content}
---
Source preview:
{brief}
Generate {count} flashcards now.
""";

        return (system, user);
    }

    private static GenerateFlashcardsResultDto? ParseFlashcards(string raw, int count)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        if (start < 0 || end <= start) return null;
        raw = raw.Substring(start, end - start + 1);

        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;

            var result = new GenerateFlashcardsResultDto();
            if (root.TryGetProperty("title", out var title) && title.ValueKind == JsonValueKind.String)
                result.SuggestedTitle = title.GetString()?.Trim() ?? "";

            if (!root.TryGetProperty("cards", out var cards) || cards.ValueKind != JsonValueKind.Array)
                return null;

            foreach (var item in cards.EnumerateArray())
            {
                if (result.Cards.Count >= count) break;
                if (!item.TryGetProperty("front", out var f) || string.IsNullOrWhiteSpace(f.GetString())) continue;
                if (!item.TryGetProperty("back", out var b) || string.IsNullOrWhiteSpace(b.GetString())) continue;

                var front = f.GetString()!.Trim();
                var back = b.GetString()!.Trim();
                if (front.Length == 0 || back.Length == 0) continue;
                if (result.Cards.Any(c => string.Equals(c.Front, front, StringComparison.OrdinalIgnoreCase))) continue;

                result.Cards.Add(new FlashcardDto
                {
                    Front = front,
                    Back = back
                });
            }

            return result.Cards.Count > 0 ? result : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string TrimToTitle(string content)
    {
        var line = content.Split('\n').Select(l => l.Trim()).FirstOrDefault(l => l.Length > 0) ?? "Study deck";
        return line.Length > 60 ? line.Substring(0, 60).TrimEnd() : line;
    }

    private static (string System, string User) BuildGamePrompt(GameContentRequestDto request, string game)
    {
        var topic = string.IsNullOrWhiteSpace(request.Topic) ? null : request.Topic.Trim();
        var difficulty = string.IsNullOrWhiteSpace(request.Difficulty) ? "mixed" : request.Difficulty.Trim();
        var count = Math.Clamp(request.Count, 1, 30);

        var topicLine = topic != null ? $"Topic: {topic}\n" : "";
        var difficultyLine = $"Difficulty: {difficulty}\n";
        var freshLine = game switch
        {
            "quiz" => "Each question must be factually accurate and use a different topic/fact area unless a Topic was given.",
            "truefalse" => "Statements must be factually accurate and cover varied facts.",
            "memory" => "Each pair must match a single term with its concise definition.",
            "scramble" => "Words must be common, lowercase, and 4-10 letters with no spaces or hyphens.",
            "math" => "Each problem must be a self-contained word problem whose text does not reveal the numeric answer.",
            _ => "Content must be varied and factually correct."
        };

        var schema = game switch
        {
            "quiz" => "{\"quiz\":[{\"question\":\"Q?\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":<index of correct option, 0-based>,\"category\":\"subject\"}]}",
            "truefalse" => "{\"items\":[{\"statement\":\"...\",\"isTrue\":true|false}]}",
            "memory" => "{\"pairs\":[{\"term\":\"...\",\"definition\":\"...\"}]}",
            "scramble" => "{\"words\":[\"apple\",\"planet\",\"...\"]}",
            "math" => "{\"problems\":[{\"text\":\"...\",\"answer\":<numeric result, exact number>}]}",
            _ => "{}"
        };

        var system = $"""
You are an educational content generator for a study app called ResVibe. You create short, accurate, age-appropriate quiz material.
Rules:
- Always provide original, well-varied content. Never repeat facts or wording across items.
- Facts must be correct. Answer options for multiple choice must be plausible but clearly one is correct.
- {freshLine}
- Respond with ONLY valid JSON matching the requested schema. No explanations, no markdown fences.
""";

        var user = $"""
Generate {count} items.
{topicLine}{difficultyLine}
Expected JSON shape:
{schema}
""";

        return (system, user);
    }

    private static GameContentDto? ParseGameContent(string raw, string game, int count)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        if (start < 0 || end <= start) return null;
        raw = raw.Substring(start, end - start + 1);

        GameContentDto dto;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            dto = new GameContentDto();

            switch (game)
            {
                case "quiz":
                    if (!root.TryGetProperty("quiz", out var quizArr) || quizArr.ValueKind != JsonValueKind.Array)
                        return null;
                    foreach (var item in quizArr.EnumerateArray())
                    {
                        if (dto.Quiz.Count >= count) break;
                        if (!item.TryGetProperty("question", out var q) || string.IsNullOrWhiteSpace(q.GetString()))
                            continue;
                        if (!item.TryGetProperty("options", out var opts) || opts.ValueKind != JsonValueKind.Array || opts.GetArrayLength() < 3)
                            continue;
                        var options = opts.EnumerateArray()
                            .Select(o => o.GetString()?.Trim())
                            .Where(o => !string.IsNullOrWhiteSpace(o))
                            .Select(o => o!)
                            .ToList();
                        if (options.Count < 3) continue;
                        var answer = 0;
                        if (item.TryGetProperty("answer", out var a) && a.ValueKind == JsonValueKind.Number)
                            answer = a.GetInt32() >= 0 ? a.GetInt32() : 0;
                        answer = Math.Clamp(answer, 0, options.Count - 1);
                        dto.Quiz.Add(new GameQuizItemDto
                        {
                            Question = q.GetString()!.Trim(),
                            Options = options,
                            Answer = answer,
                            Category = item.TryGetProperty("category", out var cat) ? cat.GetString() : null
                        });
                    }
                    return dto.Quiz.Count > 0 ? dto : null;

                case "truefalse":
                    if (!root.TryGetProperty("items", out var tfArr) || tfArr.ValueKind != JsonValueKind.Array)
                        return null;
                    foreach (var item in tfArr.EnumerateArray())
                    {
                        if (dto.TrueFalse.Count >= count) break;
                        if (!item.TryGetProperty("statement", out var st) || string.IsNullOrWhiteSpace(st.GetString()))
                            continue;
                        var isTrue = item.TryGetProperty("isTrue", out var tv) && tv.ValueKind == JsonValueKind.True;
                        dto.TrueFalse.Add(new GameTrueFalseItemDto { Statement = st.GetString()!.Trim(), IsTrue = isTrue });
                    }
                    return dto.TrueFalse.Count > 0 ? dto : null;

                case "memory":
                    if (!root.TryGetProperty("pairs", out var pairs) || pairs.ValueKind != JsonValueKind.Array)
                        return null;
                    foreach (var item in pairs.EnumerateArray())
                    {
                        if (dto.Memory.Count >= count) break;
                        if (!item.TryGetProperty("term", out var tm) || string.IsNullOrWhiteSpace(tm.GetString()))
                            continue;
                        if (!item.TryGetProperty("definition", out var df) || string.IsNullOrWhiteSpace(df.GetString()))
                            continue;
                        dto.Memory.Add(new GameMemoryItemDto { Term = tm.GetString()!.Trim(), Definition = df.GetString()!.Trim() });
                    }
                    return dto.Memory.Count > 0 ? dto : null;

                case "scramble":
                    if (!root.TryGetProperty("words", out var words) || words.ValueKind != JsonValueKind.Array)
                        return null;
                    foreach (var w in words.EnumerateArray())
                    {
                        if (dto.Words.Count >= count) break;
                        var word = w.GetString()?.Trim().ToLowerInvariant();
                        if (string.IsNullOrWhiteSpace(word)) continue;
                        if (word.Any(char.IsWhiteSpace) || word.Any(ch => !char.IsLetter(ch))) continue;
                        if (word.Length < 4 || word.Length > 10) continue;
                        if (!dto.Words.Contains(word))
                            dto.Words.Add(word);
                    }
                    return dto.Words.Count > 0 ? dto : null;

                case "math":
                    if (!root.TryGetProperty("problems", out var probs) || probs.ValueKind != JsonValueKind.Array)
                        return null;
                    foreach (var item in probs.EnumerateArray())
                    {
                        if (dto.Math.Count >= count) break;
                        if (!item.TryGetProperty("text", out var tx) || string.IsNullOrWhiteSpace(tx.GetString()))
                            continue;
                        if (!item.TryGetProperty("answer", out var ans) || ans.ValueKind != JsonValueKind.Number)
                            continue;
                        dto.Math.Add(new GameMathItemDto
                        {
                            Text = tx.GetString()!.Trim(),
                            Answer = ans.GetDouble()
                        });
                    }
                    return dto.Math.Count > 0 ? dto : null;
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
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
You are an academic tutor AI in a collaborative study platform called ResVibe. 
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
You are an academic research assistant AI in ResVibe. Your role is to help users conduct academic research using proper research methodology.

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
        var messages = new List<DTOs.AI.PreviousMessageDto>();

        if (history != null)
        {
            var recent = history.Count > 10
                ? history.Skip(history.Count - 10).ToList()
                : history;
            messages.AddRange(recent);
        }

        messages.Add(new DTOs.AI.PreviousMessageDto { Role = "user", Content = userMessage });

        var preferred = _settings.Model;
        if (string.IsNullOrWhiteSpace(preferred) || !preferred.StartsWith("gemini", StringComparison.OrdinalIgnoreCase))
            preferred = "gemini-2.5-flash";

        // Gemini periodically retires models (e.g. gemini-2.0-flash was shut down in 2026).
        // Try the configured/preferred model first, then fall back through known-good ones.
        var candidates = new List<string> { preferred };
        foreach (var m in new[] { "gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-3.6-flash", "gemini-1.5-flash" })
            if (!candidates.Contains(m))
                candidates.Add(m);

        Exception? lastError = null;
        foreach (var model in candidates)
        {
            try
            {
                return await CallGemini(systemPrompt, messages, subject, model);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("AI provider request timed out (35s).");
                return new AcademicResponseDto
                {
                    Answer = GenerateFallbackResponse(userMessage, subject),
                    Subject = subject,
                    IsError = true,
                    ErrorMessage = "AI service timed out. Please try again."
                };
            }
            catch (HttpRequestException ex) when (ex.Message.Contains("404"))
            {
                lastError = ex;
                _logger.LogWarning("Gemini model {Model} unavailable, trying next candidate.", model);
                continue;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "AI provider request failed (provider={Provider}, model={Model}).", _settings.Provider, model);
                var detail = ex.Message.Contains("404")
                    ? $"the model '{model}' was not found for provider '{_settings.Provider}'. Check the AiSettings__Model / AiSettings__Provider configuration."
                    : ex.Message;
                return new AcademicResponseDto
                {
                    Answer = GenerateFallbackResponse(userMessage, subject),
                    Subject = subject,
                    IsError = true,
                    ErrorMessage = $"AI service error: {detail}"
                };
            }
        }

        _logger.LogWarning(lastError, "All Gemini model candidates failed.");
        return new AcademicResponseDto
        {
            Answer = GenerateFallbackResponse(userMessage, subject),
            Subject = subject,
            IsError = true,
            ErrorMessage = "AI model is currently unavailable. Please try again later."
        };
    }

    /// <summary>Gemini API (Google AI Studio free tier). Uses the v1beta generateContent endpoint.</summary>
    private async Task<AcademicResponseDto> CallGemini(string systemPrompt, List<DTOs.AI.PreviousMessageDto> messages, string? subject, string model)
    {
        var apiKey = _settings.ApiKey;
        if (string.IsNullOrEmpty(apiKey))
            apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");

        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("Gemini API key is not configured.");
            return new AcademicResponseDto
            {
                Answer = GenerateFallbackResponse("", subject),
                Subject = subject,
                IsError = true,
                ErrorMessage = "AI is not configured yet. Add a Gemini API key to enable the tutor."
            };
        }

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={Uri.EscapeDataString(apiKey)}";

        // Gemini requires alternating user/model roles, so merge consecutive same-role messages.
        var contents = new List<Dictionary<string, object>>();
        foreach (var m in messages)
        {
            var role = m.Role == "assistant" ? "model" : "user";
            var text = m.Content ?? "";
            if (contents.Count > 0 && (string)contents[^1]["role"] == role)
            {
                var parts = (List<object>)contents[^1]["parts"];
                parts.Add(new { text });
            }
            else
            {
                contents.Add(new Dictionary<string, object>
                {
                    ["role"] = role,
                    ["parts"] = new List<object> { new { text } }
                });
            }
        }

        if (contents.Count == 0)
            contents.Add(new Dictionary<string, object> { ["role"] = "user", ["parts"] = new List<object> { new { text = "" } } });

        var payload = new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt } } },
            contents,
            generationConfig = new { temperature = 0.3, maxOutputTokens = _settings.MaxTokens }
        };

        var json = JsonSerializer.Serialize(payload);
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };

        var response = await _http.SendAsync(request);

        if ((int)response.StatusCode == 429)
        {
            _logger.LogWarning("Gemini rate limited (429).");
            return new AcademicResponseDto
            {
                Answer = GenerateFallbackResponse(messages.LastOrDefault()?.Content ?? "", subject),
                Subject = subject,
                IsError = true,
                ErrorMessage = "AI service is rate limited. Please wait a moment and try again."
            };
        }

        response.EnsureSuccessStatusCode();

        var responseJson = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseJson);

        var answer = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString() ?? "I'm sorry, I couldn't generate a response.";

        return new AcademicResponseDto
        {
            Answer = answer,
            Subject = subject,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Calls Gemini and returns the raw text of the first candidate, so callers can parse structured JSON.
    /// Falls back across known-good models when the preferred model is retired.
    /// </summary>
    private async Task<string> CallGeminiRawAsync(string systemPrompt, string userMessage)
    {
        var apiKey = _settings.ApiKey;
        if (string.IsNullOrEmpty(apiKey))
            apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");

        if (string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("AI is not configured.");

        var preferred = _settings.Model;
        if (string.IsNullOrWhiteSpace(preferred) || !preferred.StartsWith("gemini", StringComparison.OrdinalIgnoreCase))
            preferred = "gemini-2.5-flash";

        var candidates = new List<string> { preferred };
        foreach (var m in new[] { "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-3.6-flash", "gemini-1.5-flash" })
            if (!candidates.Contains(m))
                candidates.Add(m);

        Exception? lastError = null;
        foreach (var model in candidates)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(25));
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={Uri.EscapeDataString(apiKey)}";

                var payload = new
                {
                    system_instruction = new { parts = new[] { new { text = systemPrompt } } },
                    contents = new[] { new { role = "user", parts = new[] { new { text = userMessage } } } },
                    generationConfig = new { temperature = 0.7, maxOutputTokens = 2048, responseMimeType = "application/json" }
                };

                var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                };

                var response = await _http.SendAsync(request, cts.Token);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync(cts.Token);
                using var doc = JsonDocument.Parse(responseJson);
                return doc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text")
                    .GetString() ?? string.Empty;
            }
            catch (HttpRequestException ex) when (ex.Message.Contains("404"))
            {
                lastError = ex;
                _logger.LogWarning("Gemini model {Model} unavailable for game generation, trying next candidate.", model);
                continue;
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Gemini game-generation request timed out for model {Model}.", model);
                continue;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "Gemini game-generation request failed for model {Model}.", model);
                throw;
            }
        }

        throw lastError ?? new InvalidOperationException("AI request failed for all model candidates.");
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
            return "Hello! I'm your ResVibe academic assistant. What subject are you studying today? I can help with math, science, programming, and more.";

        return "Great question! To provide the most helpful response, could you narrow down the specific topic or concept you're studying? I can assist with mathematics, physics, chemistry, biology, computer science, literature, and more.";
    }
}
