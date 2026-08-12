using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/push")]
[Authorize]
public class PushController : ControllerBase
{
    private readonly IPushService _pushService;

    public PushController(IPushService pushService) => _pushService = pushService;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscriptionData data)
    {
        if (string.IsNullOrWhiteSpace(data.Endpoint) || string.IsNullOrWhiteSpace(data.P256dh) || string.IsNullOrWhiteSpace(data.Auth))
            return BadRequest(new { error = "Invalid subscription." });

        await _pushService.SaveSubscriptionAsync(UserId, data, Request.Headers.UserAgent.ToString());
        return Ok();
    }

    [HttpDelete]
    public async Task<IActionResult> Unsubscribe([FromBody] PushUnsubscribeDto dto)
    {
        await _pushService.RemoveSubscriptionAsync(dto.Endpoint);
        return Ok();
    }
}

public class PushUnsubscribeDto
{
    public string Endpoint { get; set; } = string.Empty;
}