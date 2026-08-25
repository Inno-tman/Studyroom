namespace ReportGenerator.Wpf.Models;

public class TableSchema
{
    public string TableName { get; set; } = string.Empty;
    public string? SchemaName { get; set; }
    public List<ColumnSchema> Columns { get; set; } = new();
}
