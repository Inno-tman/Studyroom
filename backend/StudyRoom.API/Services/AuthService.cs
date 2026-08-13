using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using StudyRoom.API.Authentication;
using StudyRoom.API.DTOs.Auth;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepo;
    private readonly JwtSettings _jwt;
    private readonly GoogleSettings _google;

    public AuthService(IUserRepository userRepo, IOptions<JwtSettings> jwt, IOptions<GoogleSettings> google)
    {
        _userRepo = userRepo;
        _jwt = jwt.Value;
        _google = google.Value;
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
    {
        if (await _userRepo.UsernameExistsAsync(dto.Username))
            throw new InvalidOperationException("Username already exists.");

        if (await _userRepo.EmailExistsAsync(dto.Email))
            throw new InvalidOperationException("Email already registered.");

        var user = new User
        {
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
        };

        await _userRepo.AddAsync(user);

        return GenerateAuthResponse(user);
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
    {
        var user = await _userRepo.GetByUsernameAsync(dto.Username);

        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid credentials.");

        return GenerateAuthResponse(user);
    }

    public async Task<AuthResponseDto> GoogleLoginAsync(string idToken)
    {
        if (string.IsNullOrWhiteSpace(idToken))
            throw new UnauthorizedAccessException("ID token is required.");

        var payload = await ValidateGoogleTokenAsync(idToken);
        if (payload == null)
            throw new UnauthorizedAccessException("Invalid Google token.");

        var user = await _userRepo.GetByEmailAsync(payload.Email);

        if (user == null)
        {
            user = new User
            {
                Username = await GenerateUniqueUsernameAsync(payload.Email),
                Email = payload.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                AvatarUrl = payload.Picture,
                GoogleId = payload.Subject
            };
            await _userRepo.AddAsync(user);
        }
        else if (string.IsNullOrEmpty(user.GoogleId))
        {
            user.GoogleId = payload.Subject;
            if (string.IsNullOrEmpty(user.AvatarUrl))
                user.AvatarUrl = payload.Picture;
            await _userRepo.UpdateAsync(user);
        }

        return GenerateAuthResponse(user);
    }

    public async Task<AuthResponseDto> UpdateProfileAsync(Guid userId, UpdateProfileDto dto)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new UnauthorizedAccessException("User not found.");

        if (!string.Equals(user.Username, dto.Username, StringComparison.OrdinalIgnoreCase)
            && await _userRepo.UsernameExistsAsync(dto.Username))
            throw new InvalidOperationException("Username already exists.");

        user.Username = dto.Username.Trim();
        user.AvatarUrl = string.IsNullOrWhiteSpace(dto.AvatarUrl) ? null : dto.AvatarUrl.Trim();
        user.FirstName = string.IsNullOrWhiteSpace(dto.FirstName) ? null : dto.FirstName.Trim();
        user.LastName = string.IsNullOrWhiteSpace(dto.LastName) ? null : dto.LastName.Trim();
        user.SchoolName = string.IsNullOrWhiteSpace(dto.SchoolName) ? null : dto.SchoolName.Trim();
        user.Location = string.IsNullOrWhiteSpace(dto.Location) ? null : dto.Location.Trim();
        user.BirthDate = dto.BirthDate;
        user.Major = string.IsNullOrWhiteSpace(dto.Major) ? null : dto.Major.Trim();
        user.Interests = string.IsNullOrWhiteSpace(dto.Interests) ? null : dto.Interests.Trim();
        user.Bio = string.IsNullOrWhiteSpace(dto.Bio) ? null : dto.Bio.Trim();

        await _userRepo.UpdateAsync(user);

        return GenerateAuthResponse(user);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new UnauthorizedAccessException("User not found.");

        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
            throw new UnauthorizedAccessException("Current password is incorrect.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        await _userRepo.UpdateAsync(user);
    }

    private async Task<GoogleJsonWebSignature.Payload?> ValidateGoogleTokenAsync(string idToken)
    {
        if (string.IsNullOrEmpty(_google.ClientId))
            throw new InvalidOperationException("Google Sign-In is not configured. Set Google:ClientId in appsettings.");

        try
        {
            return await GoogleJsonWebSignature.ValidateAsync(idToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { _google.ClientId }
                });
        }
        catch
        {
            return null;
        }
    }

    private async Task<string> GenerateUniqueUsernameAsync(string email)
    {
        var baseName = email.Split('@')[0].ToLowerInvariant()
            .Replace(".", "").Replace("_", "").Replace("-", "");

        if (baseName.Length < 3) baseName = "user";
        baseName = baseName[..Math.Min(baseName.Length, 20)];

        var username = baseName;
        var counter = 1;
        while (await _userRepo.UsernameExistsAsync(username))
        {
            username = $"{baseName}{counter}";
            counter++;
        }

        return username;
    }

    private AuthResponseDto GenerateAuthResponse(User user)
    {
        var expiresAt = DateTime.UtcNow.AddMinutes(_jwt.ExpiryMinutes);
        var token = GenerateJwtToken(user, expiresAt);

        return new AuthResponseDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            AvatarUrl = user.AvatarUrl,
            FirstName = user.FirstName,
            LastName = user.LastName,
            SchoolName = user.SchoolName,
            Location = user.Location,
            BirthDate = user.BirthDate,
            Major = user.Major,
            Interests = user.Interests,
            Bio = user.Bio,
            Role = user.Role,
            ProfileComplete = IsProfileComplete(user),
            Token = token,
            ExpiresAt = expiresAt
        };
    }

    private static bool IsProfileComplete(User user) =>
        !string.IsNullOrWhiteSpace(user.AvatarUrl)
        && (!string.IsNullOrWhiteSpace(user.FirstName) || !string.IsNullOrWhiteSpace(user.LastName))
        && !string.IsNullOrWhiteSpace(user.Bio);

    private string GenerateJwtToken(User user, DateTime expiresAt)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
