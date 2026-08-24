namespace StudyRoom.API.Models;

/// <summary>Role constants for room membership. The creator is always "Host"; co-hosts can moderate.</summary>
public static class RoomRoles
{
    public const string Host = "Host";
    public const string Cohost = "Cohost";
    public const string Member = "Member";
}
