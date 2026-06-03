using System.Text;

namespace FlashFix.Core.Logging;

internal sealed class OperationLogger : IDisposable
{
    private readonly object _gate = new();
    public string LogPath { get; }

    public OperationLogger(string prefix, string extension = ".log")
    {
        LogPath = Infrastructure.AppPaths.NewLogPath(prefix, extension);
        WriteLine($"Timestamp: {DateTime.Now:O}");
    }

    public void WriteLine(string text)
    {
        lock (_gate)
        {
            File.AppendAllText(LogPath, text + Environment.NewLine, Encoding.UTF8);
        }
    }

    public void WriteJson(object payload)
    {
        WriteLine(System.Text.Json.JsonSerializer.Serialize(payload, Infrastructure.ConsoleProtocol.Options));
    }

    public void Dispose()
    {
    }
}
