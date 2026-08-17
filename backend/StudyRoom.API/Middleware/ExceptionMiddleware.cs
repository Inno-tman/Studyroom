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

        var known = effective is UnauthorizedAccessException
            or KeyNotFoundException
            or InvalidOperationException
            or ArgumentException;

        // Only surface the message for expected business errors. Anything else
        // (DB failures, crashes, etc.) gets a generic message; the full detail
        // is already logged in InvokeAsync.
        var statusCode = known
            ? effective switch
            {
                UnauthorizedAccessException => (int)HttpStatusCode.Unauthorized,
                KeyNotFoundException => (int)HttpStatusCode.NotFound,
                _ => (int)HttpStatusCode.BadRequest
            }
            : (int)HttpStatusCode.InternalServerError;

        context.Response.StatusCode = statusCode;

        var response = new
        {
            error = known ? effective.Message : "An unexpected error occurred.",
            statusCode
        };

        var json = JsonSerializer.Serialize(response);
        await context.Response.WriteAsync(json);
    }
}
