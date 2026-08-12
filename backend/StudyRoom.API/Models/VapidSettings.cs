namespace StudyRoom.API.Models;

public class VapidSettings
{
    public string Subject { get; set; } = "mailto:admin@studyroom.app";
    public string PublicKey { get; set; } = string.Empty;
    public string PrivateKey { get; set; } = string.Empty;
}