using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using FlashFix.Core.Samsung;
using FlashFix.Core.Safety;

namespace FlashFix.Core.Commands;

internal sealed class DetectCommand
{
    public async Task<int> ExecuteAsync()
    {
        using var logger = new OperationLogger("operation-detect");
        logger.WriteLine("Command: detect");

        ConsoleProtocol.Progress("detecting_device", "Searching for Samsung device in Download Mode", 0);
        var service = new DeviceService(logger);
        var device = await service.DetectAsync();

        if (!device.Connected)
        {
            var code = device.Warnings.Any(w => w.Contains("Driver", StringComparison.OrdinalIgnoreCase) || w.Contains("permission", StringComparison.OrdinalIgnoreCase))
                ? "DRIVER_OR_PERMISSION"
                : "NO_DEVICE";

            var result = new OperationResult
            {
                Ok = false,
                Type = "error",
                Command = "detect",
                Message = device.Warnings.FirstOrDefault() ?? Warnings.NoDevice,
                Code = code,
                Data = device,
                Warnings = device.Warnings,
            };

            ConsoleProtocol.Result(result);
            return 1;
        }

        var ok = new OperationResult
        {
            Ok = true,
            Type = "result",
            Command = "detect",
            Message = "Device detected in Download Mode",
            Data = device,
            Warnings = device.Warnings,
        };

        ConsoleProtocol.Result(ok);
        return 0;
    }
}
