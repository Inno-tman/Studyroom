using System.IO;
using System.Text.Json;
using ReportGenerator.Wpf.Models;

namespace ReportGenerator.Wpf.Services;

public class AppSettings
{
    public string GroqApiKey { get; set; } = "";
    public string ApiModel { get; set; } = "llama-3.3-70b-versatile";
    public string GoogleClientId { get; set; } = "";
    public GoogleUser? GoogleUser { get; set; }
}

public class AppSettingsService
{
    private readonly string _settingsPath;

    public AppSettingsService()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        _settingsPath = Path.Combine(appData, "ReportGenerator", "settings.json");
    }

    public AppSettings Load()
    {
        try
        {
            if (!File.Exists(_settingsPath)) return new AppSettings();
            var json = File.ReadAllText(_settingsPath);
            return JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings();
        }
        catch
        {
            return new AppSettings();
        }
    }

    public void Save(AppSettings settings)
    {
        try
        {
            var dir = Path.GetDirectoryName(_settingsPath);
            if (dir != null) Directory.CreateDirectory(dir);
            var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_settingsPath, json);
        }
        catch
        {
            // Settings persistence is best-effort; failure should not break the app.
        }
    }
}
