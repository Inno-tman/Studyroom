using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using ReportGenerator.Wpf.Models;
using ReportGenerator.Wpf.Services;

namespace ReportGenerator.Wpf.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly IDatabaseService _databaseService;
    private readonly ISchemaService _schemaService;
    private readonly IGroqService _groqService;
    private readonly IExcelService _excelService;
    private readonly IGoogleAuthService _googleAuthService;
    private readonly AppSettingsService _settingsService;
    private readonly AppSettings _settings;

    public MainViewModel(
        IDatabaseService databaseService,
        ISchemaService schemaService,
        IGroqService groqService,
        IExcelService excelService,
        IGoogleAuthService googleAuthService,
        AppSettingsService settingsService)
    {
        _databaseService = databaseService;
        _schemaService = schemaService;
        _groqService = groqService;
        _excelService = excelService;
        _googleAuthService = googleAuthService;
        _settingsService = settingsService;

        _settings = _settingsService.Load();
        _groqApiKey = _settings.GroqApiKey;
        _apiModel = _settings.ApiModel;
        _googleClientId = _settings.GoogleClientId;
        _googleUser = _settings.GoogleUser;
        OnPropertyChanged(nameof(IsSignedIn));
        OnPropertyChanged(nameof(GoogleDisplayName));
        OnPropertyChanged(nameof(GoogleEmail));
    }

    [ObservableProperty]
    private string _connectionString = "";

    [ObservableProperty]
    private DatabaseType _selectedDatabaseType = DatabaseType.SqlServer;

    [ObservableProperty]
    private string _groqApiKey = "";

    [ObservableProperty]
    private string _apiModel = "llama-3.3-70b-versatile";

    [ObservableProperty]
    private string _googleClientId = "";

    [ObservableProperty]
    private GoogleUser? _googleUser;

    [ObservableProperty]
    private string _prompt = "";

    [ObservableProperty]
    private string _statusMessage = "Ready";

    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private string _generatedSql = "";

    [ObservableProperty]
    private int _totalRows;

    [ObservableProperty]
    private string _outputFilePath = "";

    [ObservableProperty]
    private bool _hasResult;

    [ObservableProperty]
    private ReportResult? _lastResult;

    public ObservableCollection<DatabaseType> DatabaseTypes { get; } = new()
    {
        DatabaseType.SqlServer,
        DatabaseType.PostgreSQL,
        DatabaseType.MySQL,
        DatabaseType.SQLite
    };

    private List<TableSchema>? _currentSchema;

    public string DatabaseTypeLabel => SelectedDatabaseType switch
    {
        DatabaseType.SqlServer => "SQL Server",
        DatabaseType.PostgreSQL => "PostgreSQL",
        DatabaseType.MySQL => "MySQL",
        DatabaseType.SQLite => "SQLite",
        _ => ""
    };

    public bool IsSignedIn => GoogleUser != null;
    public string GoogleDisplayName => GoogleUser?.DisplayName ?? "";
    public string GoogleEmail => GoogleUser?.Email ?? "";
    public string GoogleAvatarUrl => GoogleUser?.Picture ?? "";

    partial void OnSelectedDatabaseTypeChanged(DatabaseType value)
    {
        OnPropertyChanged(nameof(DatabaseTypeLabel));
    }

    partial void OnGroqApiKeyChanged(string value) => SaveSettings();
    partial void OnApiModelChanged(string value) => SaveSettings();
    partial void OnGoogleClientIdChanged(string value) => SaveSettings();

    private void SaveSettings()
    {
        _settings.GroqApiKey = GroqApiKey;
        _settings.ApiModel = ApiModel;
        _settings.GoogleClientId = GoogleClientId;
        _settings.GoogleUser = GoogleUser;
        _settingsService.Save(_settings);
    }

    [RelayCommand]
    private async Task SignInWithGoogleAsync()
    {
        IsBusy = true;
        StatusMessage = "Waiting for Google sign-in...";

        try
        {
            var user = await _googleAuthService.SignInAsync(GoogleClientId);
            if (user == null)
            {
                StatusMessage = "Google sign-in was cancelled or failed";
                return;
            }

            GoogleUser = user;
            OnPropertyChanged(nameof(IsSignedIn));
            OnPropertyChanged(nameof(GoogleDisplayName));
            OnPropertyChanged(nameof(GoogleEmail));
            OnPropertyChanged(nameof(GoogleAvatarUrl));
            SaveSettings();

            StatusMessage = $"Signed in as {user.Email}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Google sign-in failed: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void SignOut()
    {
        GoogleUser = null;
        OnPropertyChanged(nameof(IsSignedIn));
        OnPropertyChanged(nameof(GoogleDisplayName));
        OnPropertyChanged(nameof(GoogleEmail));
        OnPropertyChanged(nameof(GoogleAvatarUrl));
        SaveSettings();
        StatusMessage = "Signed out";
    }

    [RelayCommand]
    private async Task TestConnectionAsync()
    {
        if (string.IsNullOrWhiteSpace(ConnectionString))
        {
            StatusMessage = "Please enter a connection string";
            return;
        }

        IsBusy = true;
        StatusMessage = "Testing connection...";

        try
        {
            var success = await _databaseService.TestConnectionAsync(ConnectionString, SelectedDatabaseType);
            StatusMessage = success ? "Connection successful!" : "Connection failed!";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task LoadSchemaAsync()
    {
        if (string.IsNullOrWhiteSpace(ConnectionString))
        {
            StatusMessage = "Please enter a connection string";
            return;
        }

        IsBusy = true;
        StatusMessage = "Loading schema...";

        try
        {
            _currentSchema = await _schemaService.GetSchemaAsync(ConnectionString, SelectedDatabaseType);
            StatusMessage = $"Schema loaded: {_currentSchema.Count} tables found";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Schema load failed: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task GenerateReportAsync()
    {
        if (string.IsNullOrWhiteSpace(GroqApiKey))
        {
            StatusMessage = "Please enter your Groq API key";
            return;
        }

        if (string.IsNullOrWhiteSpace(ConnectionString))
        {
            StatusMessage = "Please enter a connection string";
            return;
        }

        if (string.IsNullOrWhiteSpace(Prompt))
        {
            StatusMessage = "Please enter a prompt describing the report you want";
            return;
        }

        if (_currentSchema == null || _currentSchema.Count == 0)
        {
            StatusMessage = "Please load the database schema first";
            return;
        }

        IsBusy = true;
        HasResult = false;
        LastResult = null;
        StatusMessage = "Generating SQL query via AI...";

        try
        {
            var schemaStr = _schemaService.FormatSchemaForPrompt(_currentSchema);
            var sql = await _groqService.GenerateSqlAsync(Prompt, schemaStr, GroqApiKey, ApiModel);
            GeneratedSql = sql;
            StatusMessage = "Executing query...";

            var rows = await _databaseService.ExecuteQueryAsync(ConnectionString, SelectedDatabaseType, sql);

            LastResult = new ReportResult
            {
                SqlQuery = sql,
                Rows = rows,
                ColumnNames = rows.Count > 0
                    ? rows[0].Keys.ToArray()
                    : Array.Empty<string>()
            };
            TotalRows = LastResult.RowCount;
            HasResult = true;

            StatusMessage = $"Query returned {TotalRows} rows";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task ExportToExcelAsync()
    {
        if (LastResult == null || !LastResult.IsSuccess)
        {
            StatusMessage = "No result to export";
            return;
        }

        var dialog = new SaveFileDialog
        {
            Filter = "Excel files (*.xlsx)|*.xlsx",
            DefaultExt = "xlsx",
            FileName = $"Report_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx"
        };

        if (dialog.ShowDialog() != true) return;

        IsBusy = true;
        StatusMessage = "Generating Excel file...";

        try
        {
            OutputFilePath = await _excelService.GenerateReportAsync(LastResult, dialog.FileName);
            StatusMessage = $"Report saved to: {OutputFilePath}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Excel export failed: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }
}
