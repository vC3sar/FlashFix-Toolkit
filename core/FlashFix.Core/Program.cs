using System.Text;
using FlashFix.Core.Commands;
using FlashFix.Core.Infrastructure;

namespace FlashFix.Core;

internal static class Program
{
    [STAThread]
    private static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        AppPaths.Ensure();

        if (args.Length == 0)
        {
            ConsoleProtocol.Error("unknown", "No command provided.", "NO_COMMAND");
            return 1;
        }

        var command = args[0].Trim().ToLowerInvariant();
        var remaining = args.Skip(1).ToArray();

        try
        {
            return command switch
            {
                "detect" => await new DetectCommand().ExecuteAsync(),
                "device-info" => await new DeviceInfoCommand().ExecuteAsync(),
                "read-pit" => await new ReadPitCommand().ExecuteAsync(),
                "analyze-firmware" => await new AnalyzeFirmwareCommand().ExecuteAsync(remaining),
                "build-plan" => await new BuildFlashPlanCommand().ExecuteAsync(remaining),
                "flash-plan" => await new FlashPlanCommand().ExecuteAsync(remaining),
                "clean-temp" => await new CleanTempCommand().ExecuteAsync(),
                _ => UnknownCommand(command),
            };
        }
        catch (Exception ex)
        {
            ConsoleProtocol.Error(command, ex.Message, "UNHANDLED_EXCEPTION");
            return 1;
        }
    }

    private static int UnknownCommand(string command)
    {
        ConsoleProtocol.Error(command, $"Unknown command: {command}", "UNKNOWN_COMMAND");
        return 1;
    }
}
