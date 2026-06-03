using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using SharpOdinClient;
using SharpOdinClient.Pit;
using SharpOdinClient.Port;
using SharpOdinClient.structs;
using SharpOdinClient.util;

namespace FlashFix.Core.Samsung;

internal sealed class OdinService
{
    private readonly Odin _odin = new();
    private readonly OperationLogger? _logger;

    public OdinService(OperationLogger? logger = null)
    {
        _logger = logger;
        _odin.Log += HandleLog;
        _odin.ProgressChanged += HandleProgress;
    }

    public Task<bool> IsOdinAsync() => _odin.IsOdin();

    public Task<bool> FindAndSetDownloadModeAsync() => _odin.FindAndSetDownloadMode();

    public Task<ItypePort> FindDownloadModePortAsync() => _odin.FindDownloadModePort();

    public Task<Dictionary<string, string>> GetDeviceInfoAsync() => _odin.DVIF();

    public Task<ReadPitResult> ReadPitAsync() => _odin.Read_Pit();

    public Task<bool> FlashFirmwareAsync(List<FileFlash> files, List<TPIT_Entry> pitEntries, bool debug = true)
        => _odin.FlashFirmware(files, pitEntries, 0, 0, debug);

    public Task<bool> FlashSingleFileAsync(FileFlash flash, List<TPIT_Entry> pitEntries, bool debug = true)
        => _odin.FlashSingleFile(flash, pitEntries, 0, 0, debug);

    public void Detach()
    {
        _odin.Log -= HandleLog;
        _odin.ProgressChanged -= HandleProgress;
    }

    private void HandleLog(string text, utils.MsgType color, bool isError)
    {
        var level = color.ToString().ToLowerInvariant();
        _logger?.WriteJson(new
        {
            type = "log",
            level,
            message = text,
            isError,
        });

        ConsoleProtocol.Log(level, text, isError);
    }

    private void HandleProgress(string filename, long max, long value, long writtenSize)
    {
        var percent = max <= 0
            ? 0
            : (int)Math.Clamp((value * 100.0) / max, 0, 100);

        var message = string.IsNullOrWhiteSpace(filename) ? "Flashing" : filename;
        var payload = new
        {
            type = "progress",
            step = "flashing",
            filename,
            max,
            value,
            writtenSize,
            percent,
        };

        _logger?.WriteJson(payload);
        ConsoleProtocol.Progress("flashing", message, percent, new { filename, max, value, writtenSize });
    }
}
