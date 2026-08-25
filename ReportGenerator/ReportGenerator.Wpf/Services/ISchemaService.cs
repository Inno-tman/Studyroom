using ReportGenerator.Wpf.Models;

namespace ReportGenerator.Wpf.Services;

public interface ISchemaService
{
    Task<List<TableSchema>> GetSchemaAsync(string connectionString, DatabaseType dbType);
    string FormatSchemaForPrompt(List<TableSchema> tables);
}
