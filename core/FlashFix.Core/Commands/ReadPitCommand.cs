using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using FlashFix.Core.Samsung;

namespace FlashFix.Core.Commands;

internal sealed class ReadPitCommand
{
    public async Task<int> ExecuteAsync()
    {
        using var logger = new OperationLogger("operation-read-pit");
        logger.WriteLine("Command: read-pit");
        var service = new PitService(logger);

        try
        {
            ConsoleProtocol.Progress("reading_pit", "Reading PIT from connected device", 0);
            var (partitions, txtPath, jsonPath) = await service.ReadPitAsync();
            ConsoleProtocol.Result(new OperationResult
            {
                Ok = true,
                Type = "result",
                Command = "read-pit",
                Message = "PIT read completed",
                Data = new
                {
                    pitTxtPath = txtPath,
                    pitJsonPath = jsonPath,
                    partitions,
                },
            });
            return 0;
        }
        catch (Exception ex)
        {
            var text = ex.Message.ToLowerInvariant();
            var code = text.Contains("driver") || text.Contains("permission") || text.Contains("usb")
                ? "DRIVER_OR_PERMISSION"
                : "PIT_READ_FAILED";
            ConsoleProtocol.Error("read-pit", ex.Message, code);
            return 1;
        }
    }
}
