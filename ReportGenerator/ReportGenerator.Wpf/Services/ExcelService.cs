using ClosedXML.Excel;
using ReportGenerator.Wpf.Models;

namespace ReportGenerator.Wpf.Services;

public class ExcelService : IExcelService
{
    public async Task<string> GenerateReportAsync(ReportResult result, string outputPath)
    {
        return await Task.Run(() =>
        {
            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Report");

            for (int c = 0; c < result.ColumnNames.Length; c++)
            {
                ws.Cell(1, c + 1).Value = result.ColumnNames[c];
                ws.Cell(1, c + 1).Style.Font.Bold = true;
                ws.Cell(1, c + 1).Style.Fill.BackgroundColor = XLColor.LightGray;
            }

            for (int r = 0; r < result.Rows.Count; r++)
            {
                for (int c = 0; c < result.ColumnNames.Length; c++)
                {
                    var colName = result.ColumnNames[c];
                    var value = result.Rows[r].GetValueOrDefault(colName);

                    var cell = ws.Cell(r + 2, c + 1);
                    if (value == null)
                    {
                        cell.Value = "";
                    }
                    else if (value is int i) { cell.Value = i; }
                    else if (value is long l) { cell.Value = l; }
                    else if (value is decimal d) { cell.Value = d; }
                    else if (value is double dbl) { cell.Value = dbl; }
                    else if (value is float f) { cell.Value = f; }
                    else if (value is DateTime dt) { cell.Value = dt; }
                    else if (value is bool b) { cell.Value = b; }
                    else { cell.Value = value.ToString(); }
                }
            }

            ws.Columns().AdjustToContents();
            workbook.SaveAs(outputPath);

            return outputPath;
        });
    }
}
