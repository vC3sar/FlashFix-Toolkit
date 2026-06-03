using System.Text.Json;
using System.Text.Json.Serialization;
using FlashFix.Core.Models;

namespace FlashFix.Core.Infrastructure;

internal static class ConsoleProtocol
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
    };

    public static void Emit(object payload)
    {
        Console.Out.WriteLine(JsonSerializer.Serialize(payload, Options));
    }

    public static void Progress(string step, string message, int percent, object? data = null)
    {
        Emit(new
        {
            ok = true,
            type = "progress",
            step,
            message,
            percent,
            data,
        });
    }

    public static void Log(string level, string message, bool isError = false, object? data = null)
    {
        Emit(new
        {
            ok = !isError,
            type = "log",
            level,
            message,
            data,
        });
    }

    public static void Result(OperationResult result)
    {
        Emit(result);
    }

    public static void Error(string command, string message, string code, object? data = null, List<string>? warnings = null)
    {
        Emit(new OperationResult
        {
            Ok = false,
            Type = "error",
            Command = command,
            Message = message,
            Code = code,
            Data = data,
            Warnings = warnings,
        });
    }
}
