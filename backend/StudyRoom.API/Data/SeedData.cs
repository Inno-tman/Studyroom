using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Models;

namespace StudyRoom.API.Data;

public static class SeedData
{
    public static async Task InitializeAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await context.Database.MigrateAsync();

        if (await context.Users.AnyAsync()) return;

        var admin = new User
        {
            Username = "admin",
            Email = "admin@studyroom.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
            Role = "Admin",
            AvatarUrl = null
        };

        var alice = new User
        {
            Username = "alice",
            Email = "alice@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Alice123!"),
            Role = "User"
        };

        var bob = new User
        {
            Username = "bob",
            Email = "bob@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Bob123!"),
            Role = "User"
        };

        context.Users.AddRange(admin, alice, bob);
        await context.SaveChangesAsync();

        var mathRoom = new Room
        {
            Name = "Calculus Study Group",
            Description = "Study calculus together. All levels welcome!",
            Subject = "Mathematics",
            IsPrivate = false,
            CreatedBy = admin.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };

        var physicsRoom = new Room
        {
            Name = "Physics Lab",
            Description = "Work on physics problems and experiments",
            Subject = "Physics",
            IsPrivate = false,
            CreatedBy = alice.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };

        var programmingRoom = new Room
        {
            Name = "LeetCode Grind",
            Description = "Daily coding challenges and interview prep",
            Subject = "Computer Science",
            IsPrivate = false,
            CreatedBy = bob.Id,
            CreatedAt = DateTime.UtcNow.AddHours(-12)
        };

        context.Rooms.AddRange(mathRoom, physicsRoom, programmingRoom);
        await context.SaveChangesAsync();

        context.RoomMembers.AddRange(
            new RoomMember { RoomId = mathRoom.Id, UserId = admin.Id },
            new RoomMember { RoomId = mathRoom.Id, UserId = alice.Id },
            new RoomMember { RoomId = mathRoom.Id, UserId = bob.Id },
            new RoomMember { RoomId = physicsRoom.Id, UserId = alice.Id },
            new RoomMember { RoomId = physicsRoom.Id, UserId = bob.Id },
            new RoomMember { RoomId = programmingRoom.Id, UserId = bob.Id },
            new RoomMember { RoomId = programmingRoom.Id, UserId = admin.Id }
        );

        context.Messages.AddRange(
            new Message { RoomId = mathRoom.Id, UserId = admin.Id, Content = "Welcome to the Calculus Study Group!", CreatedAt = DateTime.UtcNow.AddDays(-2).AddHours(1) },
            new Message { RoomId = mathRoom.Id, UserId = alice.Id, Content = "Hey everyone! Ready for the exam?", CreatedAt = DateTime.UtcNow.AddDays(-2).AddHours(2) },
            new Message { RoomId = mathRoom.Id, UserId = bob.Id, Content = "Let's go over derivatives today", CreatedAt = DateTime.UtcNow.AddDays(-2).AddHours(3) }
        );

        context.Notes.AddRange(
            new Note { RoomId = mathRoom.Id, Content = "# Calculus Notes\n\n## Derivatives\n- Power rule: d/dx[x^n] = nx^(n-1)\n- Chain rule: d/dx[f(g(x))] = f'(g(x)) * g'(x)", UpdatedAt = DateTime.UtcNow.AddHours(-6) },
            new Note { RoomId = physicsRoom.Id, Content = "# Physics Notes\n\n## Newton's Laws\n1. An object at rest stays at rest\n2. F = ma\n3. Action = Reaction", UpdatedAt = DateTime.UtcNow.AddHours(-3) }
        );

        context.StudySessions.AddRange(
            new StudySession { UserId = admin.Id, RoomId = mathRoom.Id, DurationMinutes = 25, Completed = true, CreatedAt = DateTime.UtcNow.Date },
            new StudySession { UserId = admin.Id, RoomId = mathRoom.Id, DurationMinutes = 25, Completed = true, CreatedAt = DateTime.UtcNow.Date.AddDays(-1) },
            new StudySession { UserId = alice.Id, RoomId = mathRoom.Id, DurationMinutes = 25, Completed = true, CreatedAt = DateTime.UtcNow.Date },
            new StudySession { UserId = bob.Id, RoomId = programmingRoom.Id, DurationMinutes = 50, Completed = true, CreatedAt = DateTime.UtcNow.Date }
        );

        await context.SaveChangesAsync();
    }
}
