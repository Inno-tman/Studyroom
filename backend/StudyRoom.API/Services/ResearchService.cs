using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using StudyRoom.API.DTOs.AI;

namespace StudyRoom.API.Services;

public class ResearchService : IResearchService
{
    private readonly HttpClient _http;
    private readonly ILogger<ResearchService> _logger;
    private const string SemanticScholarApi = "https://api.semanticscholar.org/graph/v1";

    public ResearchService(HttpClient http, ILogger<ResearchService> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<PaperSearchResultDto> SearchPapersAsync(string query, int limit = 10)
    {
        try
        {
            var encoded = Uri.EscapeDataString(query);
            var fields = "title,authors,year,venue,externalIds,abstract,citationCount,url";
            var url = $"{SemanticScholarApi}/paper/search?query={encoded}&limit={Math.Min(limit, 50)}&fields={fields}";

            var response = await _http.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            var papers = new List<PaperReference>();
            var data = doc.RootElement.GetProperty("data");

            foreach (var item in data.EnumerateArray())
            {
                var title = item.GetProperty("title").GetString() ?? "Untitled";
                var year = item.TryGetProperty("year", out var y) && y.ValueKind == JsonValueKind.Number ? y.GetInt32() : 0;
                var venue = item.TryGetProperty("venue", out var v) ? v.GetString() : null;
                var citationCount = item.TryGetProperty("citationCount", out var cc) ? cc.GetInt32().ToString() : null;

                var authorsList = new List<string>();
                if (item.TryGetProperty("authors", out var authors))
                {
                    foreach (var author in authors.EnumerateArray())
                    {
                        var name = author.GetProperty("name").GetString();
                        if (name != null) authorsList.Add(name);
                    }
                }

                var paperUrl = item.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : null;

                var abstractText = item.TryGetProperty("abstract", out var abs) ? abs.GetString() : null;

                papers.Add(new PaperReference
                {
                    Title = title,
                    Authors = string.Join(", ", authorsList),
                    Year = year,
                    Venue = venue,
                    Url = paperUrl,
                    Abstract = abstractText,
                    CitationCount = citationCount
                });
            }

            var total = doc.RootElement.TryGetProperty("total", out var t) ? t.GetInt32() : papers.Count;

            return new PaperSearchResultDto { Papers = papers, TotalResults = total };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to search papers for query: {Query}", query);
            return new PaperSearchResultDto();
        }
    }

    public async Task<ResearchProposalResponseDto> GenerateProposalAsync(ResearchProposalRequestDto request)
    {
        var papers = await SearchPapersAsync(request.Topic, 8);

        var researchPhases = new List<ResearchPhase>
        {
            new() { Phase = "Phase 1: Research Introduction", Description = "Overview of the research area, background context, and significance of the study", Completed = false },
            new() { Phase = "Phase 2: Problem Statement", Description = "Clear definition of the research problem, gaps in existing literature, and research questions", Completed = false },
            new() { Phase = "Phase 3: Literature Review", Description = "Systematic review of existing work, theoretical framework, and identification of research gaps", Completed = false },
            new() { Phase = "Phase 4: Research Methodology", Description = "Research design, data collection methods, analysis approach, and ethical considerations", Completed = false },
            new() { Phase = "Phase 5: Expected Outcomes", Description = "Anticipated results, contributions to knowledge, and potential impact", Completed = false },
            new() { Phase = "Phase 6: Timeline & Milestones", Description = "Project schedule, key deliverables, and evaluation criteria", Completed = false }
        };

        return new ResearchProposalResponseDto
        {
            Topic = request.Topic,
            Subject = request.Subject ?? "General",
            Phases = researchPhases,
            CurrentPhase = "Phase 1: Research Introduction",
            CurrentPhaseContent = "",
            References = papers.Papers,
            FullProposal = null
        };
    }

    public async Task<PaperReference?> GetPaperDetailsAsync(string paperUrl)
    {
        try
        {
            var paperId = ExtractPaperId(paperUrl);
            if (string.IsNullOrEmpty(paperId)) return null;

            var fields = "title,authors,year,venue,externalIds,abstract,citationCount,references";
            var url = $"{SemanticScholarApi}/paper/{paperId}?fields={fields}";

            var response = await _http.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            var title = doc.RootElement.GetProperty("title").GetString() ?? "Untitled";
            var year = doc.RootElement.TryGetProperty("year", out var y) && y.ValueKind == JsonValueKind.Number ? y.GetInt32() : 0;
            var venue = doc.RootElement.TryGetProperty("venue", out var v) ? v.GetString() : null;
            var citationCount = doc.RootElement.TryGetProperty("citationCount", out var cc) ? cc.GetInt32().ToString() : null;

            var authorsList = new List<string>();
            if (doc.RootElement.TryGetProperty("authors", out var authors))
            {
                foreach (var author in authors.EnumerateArray())
                {
                    var name = author.GetProperty("name").GetString();
                    if (name != null) authorsList.Add(name);
                }
            }

            var abstractText = doc.RootElement.TryGetProperty("abstract", out var abs) ? abs.GetString() : null;

            return new PaperReference
            {
                Title = title,
                Authors = string.Join(", ", authorsList),
                Year = year,
                Venue = venue,
                Url = paperUrl,
                Abstract = abstractText,
                CitationCount = citationCount
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get paper details for URL: {Url}", paperUrl);
            return null;
        }
    }

    private static string? ExtractPaperId(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            var segments = uri.Segments;
            if (segments.Length > 0)
            {
                var last = segments[^1].Trim('/');
                if (!string.IsNullOrEmpty(last)) return last;
            }
        }
        return null;
    }
}
