using ReportGenerator.Wpf.Models;

namespace ReportGenerator.Wpf.Services;

public interface IDatabaseService
{
    Task<List<Dictionary<string, object?>>> ExecuteQueryAsync(string connectionString, DatabaseType dbType, string sql, int maxRows = 10000);
    Task<bool> TestConnectionAsync(string connectionString, DatabaseType dbType);
    string GetProviderName(DatabaseType dbType);
}
