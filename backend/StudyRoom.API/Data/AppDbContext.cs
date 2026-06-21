using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Models;

namespace StudyRoom.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<RoomMember> RoomMembers => Set<RoomMember>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<StudySession> StudySessions => Set<StudySession>();
    public DbSet<AiConversation> AiConversations => Set<AiConversation>();
    public DbSet<AiMessage> AiMessages => Set<AiMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasIndex(u => u.Email).IsUnique();
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
    }
}
