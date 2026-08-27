using System;

namespace StudyRoom.API.Services;

public interface IPresenceService
{
    int Increment(Guid userId);
    int Decrement(Guid userId);
    bool IsOnline(Guid userId);
    int OnlineCount(Guid userId);
}