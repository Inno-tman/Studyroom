using ReportGenerator.Wpf.Models;

namespace ReportGenerator.Wpf.Services;

public interface IGoogleAuthService
{
    Task<GoogleUser?> SignInAsync(string clientId);
    void SignOut();
}
