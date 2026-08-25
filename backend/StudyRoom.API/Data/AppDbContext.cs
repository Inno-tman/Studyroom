using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using StudyRoom.API.Models;

namespace StudyRoom.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<DateTime>()
            .HaveConversion<DateTimeUtcConverter>();
        builder.Properties<DateTime?>()
            .HaveConversion<DateTimeNullableUtcConverter>();
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<RoomMember> RoomMembers => Set<RoomMember>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<StudySession> StudySessions => Set<StudySession>();
    public DbSet<AiConversation> AiConversations => Set<AiConversation>();
    public DbSet<AiMessage> AiMessages => Set<AiMessage>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<PostComment> PostComments => Set<PostComment>();
    public DbSet<PostReaction> PostReactions => Set<PostReaction>();
    public DbSet<PostStats> PostStats => Set<PostStats>();
    public DbSet<RoomInvitation> RoomInvitations => Set<RoomInvitation>();
    public DbSet<DirectMessage> DirectMessages => Set<DirectMessage>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<Meeting> Meetings => Set<Meeting>();
    public DbSet<MeetingAttendee> MeetingAttendees => Set<MeetingAttendee>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasIndex(u => u.Email).IsUnique();
            entity.HasIndex(u => u.GoogleId).IsUnique().HasFilter("\"GoogleId\" IS NOT NULL");
        });

        modelBuilder.Entity<Room>(entity =>
        {
            entity.HasIndex(r => r.JoinCode).IsUnique().HasFilter("\"JoinCode\" IS NOT NULL");
            entity.HasOne(r => r.Creator).WithMany().HasForeignKey(r => r.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RoomMember>(entity =>
        {
            entity.HasIndex(rm => new { rm.RoomId, rm.UserId }).IsUnique();
            entity.HasOne(rm => rm.Room).WithMany(r => r.Members).HasForeignKey(rm => rm.RoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(rm => rm.User).WithMany(u => u.RoomMemberships).HasForeignKey(rm => rm.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasIndex(m => m.RoomId);
            entity.HasIndex(m => m.CreatedAt);
            entity.HasOne(m => m.Room).WithMany(r => r.Messages).HasForeignKey(m => m.RoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(m => m.User).WithMany(u => u.Messages).HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Note>(entity =>
        {
            entity.HasIndex(n => n.RoomId).IsUnique();
            entity.HasOne(n => n.Room).WithOne(r => r.Note).HasForeignKey<Note>(n => n.RoomId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StudySession>(entity =>
        {
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => s.CreatedAt);
            entity.HasOne(s => s.User).WithMany(u => u.StudySessions).HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(s => s.Room).WithMany().HasForeignKey(s => s.RoomId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AiConversation>(entity =>
        {
            entity.HasIndex(c => c.UserId);
            entity.HasIndex(c => c.CreatedAt);
            entity.HasOne(c => c.User).WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AiMessage>(entity =>
        {
            entity.HasIndex(m => m.ConversationId);
            entity.HasIndex(m => m.CreatedAt);
            entity.HasOne(m => m.Conversation).WithMany(c => c.Messages).HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Friendship>(entity =>
        {
            entity.HasIndex(f => new { f.RequesterId, f.AddresseeId }).IsUnique();
            entity.HasIndex(f => f.Status);
            entity.HasOne(f => f.Requester).WithMany().HasForeignKey(f => f.RequesterId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(f => f.Addressee).WithMany().HasForeignKey(f => f.AddresseeId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.HasIndex(p => p.UserId);
            entity.HasIndex(p => p.RoomId);
            entity.HasIndex(p => p.CreatedAt);
            entity.HasOne(p => p.Author).WithMany(u => u.Posts).HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(p => p.SharedPost).WithMany().HasForeignKey(p => p.SharedPostId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(p => p.Room).WithMany().HasForeignKey(p => p.RoomId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PostComment>(entity =>
        {
            entity.HasIndex(c => c.PostId);
            entity.HasIndex(c => c.ParentCommentId);
            entity.HasIndex(c => c.CreatedAt);
            entity.HasOne(c => c.Post).WithMany(p => p.Comments).HasForeignKey(c => c.PostId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(c => c.Author).WithMany(u => u.Comments).HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(c => c.ParentComment).WithMany(c => c.Replies).HasForeignKey(c => c.ParentCommentId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PostReaction>(entity =>
        {
            entity.HasIndex(r => new { r.PostId, r.UserId }).IsUnique();
            entity.HasOne(r => r.Post).WithMany(p => p.Reactions).HasForeignKey(r => r.PostId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(r => r.User).WithMany(u => u.Reactions).HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RoomInvitation>(entity =>
        {
            entity.HasIndex(i => i.InviteeId);
            entity.HasIndex(i => new { i.RoomId, i.InviteeId }).IsUnique();
            entity.HasOne(i => i.Room).WithMany().HasForeignKey(i => i.RoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(i => i.Inviter).WithMany().HasForeignKey(i => i.InviterId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(i => i.Invitee).WithMany().HasForeignKey(i => i.InviteeId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DirectMessage>(entity =>
        {
            entity.HasIndex(d => d.SenderId);
            entity.HasIndex(d => d.ReceiverId);
            entity.HasIndex(d => d.CreatedAt);
            entity.HasOne(d => d.Sender).WithMany().HasForeignKey(d => d.SenderId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(d => d.Receiver).WithMany().HasForeignKey(d => d.ReceiverId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasIndex(n => n.UserId);
            entity.HasIndex(n => new { n.UserId, n.IsRead });
            entity.HasIndex(n => n.CreatedAt);
            entity.HasOne(n => n.User).WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PushSubscription>(entity =>
        {
            entity.HasIndex(p => p.UserId);
            entity.HasIndex(p => p.Endpoint).IsUnique();
            entity.HasOne<User>().WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Meeting>(entity =>
        {
            entity.HasIndex(m => m.RoomId);
            entity.HasIndex(m => m.ScheduledAt);
            entity.HasOne(m => m.Room).WithMany().HasForeignKey(m => m.RoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(m => m.Creator).WithMany().HasForeignKey(m => m.CreatedBy).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MeetingAttendee>(entity =>
        {
            entity.HasKey(a => new { a.MeetingId, a.UserId });
            entity.HasOne(a => a.Meeting).WithMany().HasForeignKey(a => a.MeetingId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(a => a.User).WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}

public class DateTimeUtcConverter : ValueConverter<DateTime, DateTime>
{
    public DateTimeUtcConverter() : base(
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
        v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc)) { }
}

public class DateTimeNullableUtcConverter : ValueConverter<DateTime?, DateTime?>
{
    public DateTimeNullableUtcConverter() : base(
        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v,
        v => v.HasValue && v.Value.Kind != DateTimeKind.Utc ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v) { }
}
