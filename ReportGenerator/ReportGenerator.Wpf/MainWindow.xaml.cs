using System.Windows;
using System.Windows.Controls;
using ReportGenerator.Wpf.ViewModels;

namespace ReportGenerator.Wpf;

public partial class MainWindow : Window
{
    private readonly MainViewModel _viewModel;

    public MainWindow(MainViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        DataContext = viewModel;

        ApiKeyBox.PasswordChanged += OnApiKeyChanged;
        ApiKeyBox.Password = _viewModel.GroqApiKey;
    }

    private void OnApiKeyChanged(object sender, RoutedEventArgs e)
    {
        _viewModel.GroqApiKey = ((PasswordBox)sender).Password;
    }
}
