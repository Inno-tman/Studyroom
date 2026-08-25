namespace ReportGenerator.Wpf.Models;

public class ReportResult
{
    public string SqlQuery { get; set; } = string.Empty;
    public string[] ColumnNames { get; set; } = Array.Empty<string>();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public int RowCount => Rows.Count;
    public string? ErrorMessage { get; set; }
    public bool IsSuccess => ErrorMessage == null;
}
