using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace StudyRoom.API.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred.");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        // DbUpdateException wraps the real DB error in InnerException.
        var effective = exception is DbUpdateException && exception.InnerException != null
            ? exception.InnerException
            : exception;

        context.Response.StatusCode = effective switch
        {
            UnauthorizedAccessException => (int)HttpStatusCode.Unauthorized,
            KeyNotFoundException => (int)HttpStatusCode.NotFound,
            InvalidOperationException => (int)HttpStatusCode.BadRequest,
            ArgumentException => (int)HttpStatusCode.BadRequest,
            _ => (int)HttpStatusCode.InternalServerError
        };

        var response = new
        {
            error = effective.Message,
            statusCode = context.Response.StatusCode
        };

        var json = JsonSerializer.Serialize(response);
        await context.Response.WriteAsync(json);
    }
}
