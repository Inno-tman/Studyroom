using ReportGenerator.Wpf.Models;

namespace ReportGenerator.Wpf.Services;

public interface IExcelService
{
    Task<string> GenerateReportAsync(ReportResult result, string outputPath);
}
