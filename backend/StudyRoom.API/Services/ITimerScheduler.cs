namespace StudyRoom.API.Services;

public interface ITimerScheduler
{
    void ScheduleFocus(Guid userId, Guid? roomId, int durationMinutes);
    void ScheduleBreak(Guid userId, Guid? roomId, int durationMinutes, bool isLong);
    void Cancel(Guid userId, Guid? roomId = null);
}