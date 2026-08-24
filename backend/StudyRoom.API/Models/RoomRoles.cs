namespace StudyRoom.API.Models;

/// <summary>Role constants for room membership. The creator is always "host"; co-hosts can moderate.</summary>
public static class RoomRoles
{
    public const string Host = "host";
    public const string Cohost = "cohost";
    public const string Member = "member";
}
