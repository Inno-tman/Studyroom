namespace ReportGenerator.Wpf.Services;

public interface IGroqService
{
    Task<string> GenerateSqlAsync(string prompt, string schema, string apiKey, string? model = null);
    void SetBaseUrl(string url);
}
