using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using ReportGenerator.Wpf.Services;
using ReportGenerator.Wpf.ViewModels;

namespace ReportGenerator.Wpf;

public partial class App : Application
{
    public static IServiceProvider Services { get; private set; } = null!;

    protected override void OnStartup(StartupEventArgs e)
    {
        var services = new ServiceCollection();

        services.AddSingleton<IDatabaseService, DatabaseService>();
        services.AddSingleton<ISchemaService, SchemaService>();
        services.AddSingleton<IGroqService, GroqService>();
        services.AddSingleton<IExcelService, ExcelService>();
        services.AddSingleton<IGoogleAuthService, GoogleAuthService>();
        services.AddSingleton<AppSettingsService>();
        services.AddTransient<MainViewModel>();

        Services = services.BuildServiceProvider();

        base.OnStartup(e);
    }
}
