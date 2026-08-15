using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StudyRoom.API.Authentication;
using StudyRoom.API.Data;
using StudyRoom.API.Hubs;
using StudyRoom.API.Middleware;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

Environment.SetEnvironmentVariable("DOTNET_USE_POLLING_FILE_WATCHER", "true");

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "";
connectionString = ConvertToNpgsqlConnectionString(connectionString);
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

var jwtSection = builder.Configuration.GetSection("JwtSettings");
builder.Services.Configure<JwtSettings>(jwtSection);
var jwtSettings = jwtSection.Get<JwtSettings>()!;

builder.Services.Configure<GoogleSettings>(builder.Configuration.GetSection("Google"));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret)),
            ClockSkew = TimeSpan.Zero
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    context.Token = accessToken;

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
            builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? new[] { "http://localhost:4200" })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddSignalR();

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRoomRepository, RoomRepository>();
builder.Services.AddScoped<IMessageRepository, MessageRepository>();
builder.Services.AddScoped<INotesRepository, NotesRepository>();
builder.Services.AddScoped<IStudySessionRepository, StudySessionRepository>();
builder.Services.AddScoped<IFriendshipRepository, FriendshipRepository>();
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IRoomInvitationRepository, RoomInvitationRepository>();
builder.Services.AddScoped<IDirectMessageRepository, DirectMessageRepository>();
builder.Services.AddScoped<IMeetingRepository, MeetingRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IRoomService, RoomService>();
builder.Services.AddScoped<IStatisticsService, StatisticsService>();
builder.Services.AddScoped<IFriendService, FriendService>();
builder.Services.AddScoped<IPostService, PostService>();
builder.Services.AddScoped<IRoomInvitationService, RoomInvitationService>();
builder.Services.AddScoped<IDirectMessageService, DirectMessageService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IAiConversationRepository, AiConversationRepository>();
builder.Services.AddScoped<IMeetingService, MeetingService>();

builder.Services.Configure<AiSettings>(builder.Configuration.GetSection("AiSettings"));
builder.Services.AddHttpClient<IAIAcademicService, AIAcademicService>();
builder.Services.AddHttpClient<IResearchService, ResearchService>();

builder.Services.Configure<VapidSettings>(builder.Configuration.GetSection("Vapid"));
builder.Services.AddScoped<IPushService, PushService>();

builder.Services.Configure<LivekitSettings>(builder.Configuration.GetSection("Livekit"));
builder.Services.AddScoped<ILiveKitService, LiveKitService>();

var livekitUrl = Environment.GetEnvironmentVariable("LIVEKIT_URL");
var livekitApiKey = Environment.GetEnvironmentVariable("LIVEKIT_API_KEY");
var livekitApiSecret = Environment.GetEnvironmentVariable("LIVEKIT_API_SECRET");
if (!string.IsNullOrWhiteSpace(livekitUrl) || !string.IsNullOrWhiteSpace(livekitApiKey) || !string.IsNullOrWhiteSpace(livekitApiSecret))
{
    builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Livekit:Url"] = livekitUrl ?? builder.Configuration["Livekit:Url"],
        ["Livekit:ApiKey"] = livekitApiKey ?? builder.Configuration["Livekit:ApiKey"],
        ["Livekit:ApiSecret"] = livekitApiSecret ?? builder.Configuration["Livekit:ApiSecret"]
    });
}

builder.Services.AddHostedService<StaleDirectMessageNotifier>();

var app = builder.Build();

app.UseMiddleware<ExceptionMiddleware>();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<StudyRoomHub>("/hubs/studyroom");

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await context.Database.EnsureCreatedAsync();
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "GoogleId" text NULL;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "FirstName" text NULL;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "LastName" text NULL;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "SchoolName" text NULL;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Location" text NULL;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "BirthDate" timestamp NULL;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Major" text NULL;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Interests" text NULL;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Bio" text NULL;
        ALTER TABLE "Users" ALTER COLUMN "AvatarUrl" TYPE text;
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_GoogleId" ON "Users" ("GoogleId") WHERE "GoogleId" IS NOT NULL;
    """);
    await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "AiConversations" (
            "Id" uuid NOT NULL,
            "UserId" uuid NOT NULL,
            "RoomId" text NULL,
            "Subject" text NULL,
            "IsResearchMode" boolean NOT NULL DEFAULT false,
            "CurrentPhase" text NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_AiConversations" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_AiConversations_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_AiConversations_UserId" ON "AiConversations" ("UserId");
        CREATE INDEX IF NOT EXISTS "IX_AiConversations_CreatedAt" ON "AiConversations" ("CreatedAt");

        CREATE TABLE IF NOT EXISTS "AiMessages" (
            "Id" uuid NOT NULL,
            "ConversationId" uuid NOT NULL,
            "Role" text NOT NULL,
            "Content" text NOT NULL,
            "ReferencesJson" text NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_AiMessages" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_AiMessages_AiConversations_ConversationId" FOREIGN KEY ("ConversationId") REFERENCES "AiConversations" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_AiMessages_ConversationId" ON "AiMessages" ("ConversationId");
        CREATE INDEX IF NOT EXISTS "IX_AiMessages_CreatedAt" ON "AiMessages" ("CreatedAt");

        CREATE TABLE IF NOT EXISTS "Friendships" (
            "Id" uuid NOT NULL,
            "RequesterId" uuid NOT NULL,
            "AddresseeId" uuid NOT NULL,
            "Status" text NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Friendships" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_Friendships_Users_AddresseeId" FOREIGN KEY ("AddresseeId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_Friendships_Users_RequesterId" FOREIGN KEY ("RequesterId") REFERENCES "Users" ("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Friendships_RequesterId_AddresseeId" ON "Friendships" ("RequesterId", "AddresseeId");
        CREATE INDEX IF NOT EXISTS "IX_Friendships_Status" ON "Friendships" ("Status");

        CREATE TABLE IF NOT EXISTS "Posts" (
            "Id" uuid NOT NULL,
            "UserId" uuid NOT NULL,
            "Content" text NOT NULL,
            "RoomId" uuid NULL,
            "SharedPostId" uuid NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Posts" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_Posts_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_Posts_Rooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_Posts_Posts_SharedPostId" FOREIGN KEY ("SharedPostId") REFERENCES "Posts" ("Id") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS "IX_Posts_UserId" ON "Posts" ("UserId");
        CREATE INDEX IF NOT EXISTS "IX_Posts_RoomId" ON "Posts" ("RoomId");
        CREATE INDEX IF NOT EXISTS "IX_Posts_CreatedAt" ON "Posts" ("CreatedAt");

        CREATE TABLE IF NOT EXISTS "PostComments" (
            "Id" uuid NOT NULL,
            "PostId" uuid NOT NULL,
            "UserId" uuid NOT NULL,
            "Content" text NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_PostComments" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_PostComments_Posts_PostId" FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_PostComments_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_PostComments_PostId" ON "PostComments" ("PostId");
        CREATE INDEX IF NOT EXISTS "IX_PostComments_CreatedAt" ON "PostComments" ("CreatedAt");

        ALTER TABLE "PostComments" ADD COLUMN IF NOT EXISTS "ParentCommentId" uuid NULL;
        CREATE INDEX IF NOT EXISTS "IX_PostComments_ParentCommentId" ON "PostComments" ("ParentCommentId");

        CREATE TABLE IF NOT EXISTS "PostReactions" (
            "Id" uuid NOT NULL,
            "PostId" uuid NOT NULL,
            "UserId" uuid NOT NULL,
            "Type" text NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_PostReactions" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_PostReactions_Posts_PostId" FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_PostReactions_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PostReactions_PostId_UserId" ON "PostReactions" ("PostId", "UserId");

        CREATE TABLE IF NOT EXISTS "RoomInvitations" (
            "Id" uuid NOT NULL,
            "RoomId" uuid NOT NULL,
            "InviterId" uuid NOT NULL,
            "InviteeId" uuid NOT NULL,
            "Status" text NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_RoomInvitations" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_RoomInvitations_Rooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_RoomInvitations_Users_InviteeId" FOREIGN KEY ("InviteeId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_RoomInvitations_Users_InviterId" FOREIGN KEY ("InviterId") REFERENCES "Users" ("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_RoomInvitations_RoomId_InviteeId" ON "RoomInvitations" ("RoomId", "InviteeId");
        CREATE INDEX IF NOT EXISTS "IX_RoomInvitations_InviteeId" ON "RoomInvitations" ("InviteeId");

        CREATE TABLE IF NOT EXISTS "DirectMessages" (
            "Id" uuid NOT NULL,
            "SenderId" uuid NOT NULL,
            "ReceiverId" uuid NOT NULL,
            "Content" text NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_DirectMessages" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_DirectMessages_Users_ReceiverId" FOREIGN KEY ("ReceiverId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_DirectMessages_Users_SenderId" FOREIGN KEY ("SenderId") REFERENCES "Users" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_DirectMessages_SenderId" ON "DirectMessages" ("SenderId");
        CREATE INDEX IF NOT EXISTS "IX_DirectMessages_ReceiverId" ON "DirectMessages" ("ReceiverId");
        CREATE INDEX IF NOT EXISTS "IX_DirectMessages_CreatedAt" ON "DirectMessages" ("CreatedAt");
        ALTER TABLE "DirectMessages" ADD COLUMN IF NOT EXISTS "IsRead" boolean NOT NULL DEFAULT false;
        ALTER TABLE "DirectMessages" ADD COLUMN IF NOT EXISTS "UnreadNotificationSent" boolean NOT NULL DEFAULT false;

        CREATE TABLE IF NOT EXISTS "Notifications" (
            "Id" uuid NOT NULL,
            "UserId" uuid NOT NULL,
            "Type" text NOT NULL,
            "Title" text NOT NULL,
            "Body" text NOT NULL,
            "Icon" text NOT NULL DEFAULT 'notifications',
            "ActorId" uuid NULL,
            "ActorName" text NOT NULL DEFAULT '',
            "ActorAvatarUrl" text NULL,
            "Link" text NULL,
            "IsRead" boolean NOT NULL DEFAULT false,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Notifications" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_Notifications_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_Notifications_UserId" ON "Notifications" ("UserId");
        CREATE INDEX IF NOT EXISTS "IX_Notifications_UserId_IsRead" ON "Notifications" ("UserId", "IsRead");
        CREATE INDEX IF NOT EXISTS "IX_Notifications_CreatedAt" ON "Notifications" ("CreatedAt");

        CREATE TABLE IF NOT EXISTS "PushSubscriptions" (
            "Id" uuid NOT NULL,
            "UserId" uuid NOT NULL,
            "Endpoint" text NOT NULL,
            "P256dh" text NOT NULL,
            "Auth" text NOT NULL,
            "UserAgent" text NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_PushSubscriptions" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_PushSubscriptions_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PushSubscriptions_Endpoint" ON "PushSubscriptions" ("Endpoint");
        CREATE INDEX IF NOT EXISTS "IX_PushSubscriptions_UserId" ON "PushSubscriptions" ("UserId");

        CREATE TABLE IF NOT EXISTS "Meetings" (
            "Id" uuid NOT NULL,
            "RoomId" uuid NOT NULL,
            "CreatedBy" uuid NOT NULL,
            "Title" text NOT NULL,
            "Description" text NULL,
            "ScheduledAt" timestamp with time zone NOT NULL,
            "DurationMinutes" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Meetings" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_Meetings_Users_CreatedBy" FOREIGN KEY ("CreatedBy") REFERENCES "Users" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_Meetings_Rooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_Meetings_RoomId" ON "Meetings" ("RoomId");
        CREATE INDEX IF NOT EXISTS "IX_Meetings_ScheduledAt" ON "Meetings" ("ScheduledAt");
    """);
}

await SeedData.InitializeAsync(app.Services);

app.Run();

static string ConvertToNpgsqlConnectionString(string cs)
{
    if (string.IsNullOrEmpty(cs) || !cs.StartsWith("postgres://") && !cs.StartsWith("postgresql://"))
        return cs;

    var uri = new Uri(cs);
    var userInfo = uri.UserInfo?.Split(':') ?? Array.Empty<string>();
    var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
    var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
    var host = uri.Host;
    var port = uri.Port > 0 ? uri.Port : 5432;
    var database = uri.AbsolutePath.TrimStart('/');

    return $"Host={host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true;Timeout=30";
}
