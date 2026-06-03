using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using FlashFix.Core.Samsung;
using FlashFix.Core.Safety;

namespace FlashFix.Core.Commands;

internal sealed class DeviceInfoCommand
{
    public async Task<int> ExecuteAsync()
    {
        using var logger = new OperationLogger("operation-device-info");
        logger.WriteLine("Command: device-info");
        var service = new DeviceService(logger);
        var device = await service.GetDeviceInfoAsync();

        if (!device.Connected)
        {
            var code = device.Warnings.Any(w => w.Contains("Driver", StringComparison.OrdinalIgnoreCase) || w.Contains("permission", StringComparison.OrdinalIgnoreCase))
                ? "DRIVER_OR_PERMISSION"
                : "NO_DEVICE";

            ConsoleProtocol.Result(new OperationResult
            {
                Ok = false,
                Type = "error",
                Command = "device-info",
                Message = device.Warnings.FirstOrDefault() ?? Warnings.NoDevice,
                Code = code,
                Data = device,
                Warnings = device.Warnings,
            });
            return 1;
        }

        ConsoleProtocol.Result(new OperationResult
        {
            Ok = true,
            Type = "result",
            Command = "device-info",
            Message = "Device info collected",
            Data = device,
            Warnings = device.Warnings,
        });
        return 0;
    }
}
