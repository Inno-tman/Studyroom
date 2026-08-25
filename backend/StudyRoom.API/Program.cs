using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
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

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    // Render terminates TLS and forwards the client IP; required for correct
    // rate limiting and scheme detection behind the proxy.
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddControllers();
builder.Services.AddMemoryCache();
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

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, _) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        return new ValueTask(context.HttpContext.Response.WriteAsync("""{"error":"Too many requests. Please try again in a minute."}"""));
    };
    // Auth endpoints are anonymous, so limit them per client IP to slow brute force.
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
    // Search/query endpoints are authenticated, so limit per user to prevent catalog scraping.
    options.AddPolicy("search", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier)
            ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
});

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
builder.Services.AddScoped<IPostStatsRepository, PostStatsRepository>();

builder.Services.AddSingleton<TimerScheduler>();
builder.Services.AddSingleton<ITimerScheduler>(sp => sp.GetRequiredService<TimerScheduler>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<TimerScheduler>());
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

builder.Services.Configure<YoutubeSettings>(builder.Configuration.GetSection("Youtube"));

var youtubeApiKey = Environment.GetEnvironmentVariable("YOUTUBE_API_KEY");
if (!string.IsNullOrWhiteSpace(youtubeApiKey))
{
    builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Youtube:ApiKey"] = youtubeApiKey
    });
}

var geminiApiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? Environment.GetEnvironmentVariable("AI_API_KEY");
if (!string.IsNullOrWhiteSpace(geminiApiKey))
{
    builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["AiSettings:ApiKey"] = geminiApiKey
    });
}

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

app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
    app.UseHsts();

// Basic security headers on every API response.
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["X-Permitted-Cross-Domain-Policies"] = "none";
    await next();
});

app.UseMiddleware<ExceptionMiddleware>();

app.UseRateLimiter();

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
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "RefreshToken" text NULL;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "RefreshTokenExpiresAt" timestamp NULL;
        ALTER TABLE "Users" ALTER COLUMN "AvatarUrl" TYPE text;
        ALTER TABLE "RoomMembers" ADD COLUMN IF NOT EXISTS "Role" text NOT NULL DEFAULT 'member';
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
        ALTER TABLE "AiConversations" ADD COLUMN IF NOT EXISTS "RoomId" text NULL;
        ALTER TABLE "AiConversations" ADD COLUMN IF NOT EXISTS "UserId" uuid NULL;

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

        CREATE TABLE IF NOT EXISTS "PostStats" (
            "PostId" uuid NOT NULL,
            "CommentCount" integer NOT NULL DEFAULT 0,
            "ReactionCount" integer NOT NULL DEFAULT 0,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_PostStats" PRIMARY KEY ("PostId"),
            CONSTRAINT "FK_PostStats_Posts_PostId" FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE
        );

        -- Seed the read model from existing write data (idempotent).
        INSERT INTO "PostStats" ("PostId", "CommentCount", "ReactionCount", "UpdatedAt")
        SELECT
            p."Id",
            (SELECT COUNT(*) FROM "PostComments" c WHERE c."PostId" = p."Id"),
            (SELECT COUNT(*) FROM "PostReactions" r WHERE r."PostId" = p."Id"),
            NOW()
        FROM "Posts" p
        WHERE NOT EXISTS (SELECT 1 FROM "PostStats" s WHERE s."PostId" = p."Id");

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

        CREATE TABLE IF NOT EXISTS "MeetingAttendees" (
            "MeetingId" uuid NOT NULL,
            "UserId" uuid NOT NULL,
            "Status" text NOT NULL DEFAULT 'Accepted',
            "RespondedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_MeetingAttendees" PRIMARY KEY ("MeetingId", "UserId"),
            CONSTRAINT "FK_MeetingAttendees_Meetings_MeetingId" FOREIGN KEY ("MeetingId") REFERENCES "Meetings" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_MeetingAttendees_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_MeetingAttendees_UserId" ON "MeetingAttendees" ("UserId");
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
