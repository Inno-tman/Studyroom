using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.Social;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/posts")]
[Authorize]
public class PostsController : ControllerBase
{
    private readonly IPostService _postService;

    public PostsController(IPostService postService) => _postService = postService;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("timeline")]
    public async Task<IActionResult> GetTimeline()
    {
        var posts = await _postService.GetTimelineAsync(UserId);
        return Ok(posts);
    }

    [HttpGet("room/{roomId}")]
    public async Task<IActionResult> GetRoomPosts(Guid roomId)
    {
        try
        {
            var posts = await _postService.GetRoomPostsAsync(roomId, UserId);
            return Ok(posts);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetUserPosts(Guid userId)
    {
        var posts = await _postService.GetUserPostsAsync(userId, UserId);
        return Ok(posts);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        try
        {
            var post = await _postService.CreatePostAsync(dto, UserId);
            return CreatedAtAction(nameof(Create), new { id = post.Id }, post);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _postService.DeletePostAsync(id, UserId);
            return Ok();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    [HttpPost("{id}/like")]
    public async Task<IActionResult> ToggleLike(Guid id)
    {
        try
        {
            var post = await _postService.ToggleLikeAsync(id, UserId);
            return Ok(post);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost("{id}/comments")]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] CreateCommentDto dto)
    {
        try
        {
            var comment = await _postService.AddCommentAsync(id, dto.Content, UserId);
            return Ok(comment);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
