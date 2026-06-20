using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IMessageRepository
{
    Task<List<Message>> GetByRoomIdAsync(Guid roomId, int take = 100);
    Task AddAsync(Message message);
}
