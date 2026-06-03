using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;

namespace FlashFix.Core.Commands;

internal sealed class CleanTempCommand
{
    public async Task<int> ExecuteAsync()
    {
        await Task.Yield();
        try
        {
            using var logger = new OperationLogger("operation-clean-temp");
            logger.WriteLine("Command: clean-temp");
            if (Directory.Exists(AppPaths.TempDir))
            {
                foreach (var dir in Directory.GetDirectories(AppPaths.TempDir))
                {
                    Directory.Delete(dir, true);
                }

                foreach (var file in Directory.GetFiles(AppPaths.TempDir))
                {
                    if (string.Equals(Path.GetFileName(file), ".gitkeep", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    File.Delete(file);
                }
            }

            Directory.CreateDirectory(AppPaths.TempDir);
            Directory.CreateDirectory(AppPaths.FirmwareTempRoot);

            ConsoleProtocol.Log("info", "Temporary folders cleaned", false, new
            {
                tempDir = AppPaths.TempDir,
                firmwareTempRoot = AppPaths.FirmwareTempRoot,
            });

            ConsoleProtocol.Result(new OperationResult
            {
                Ok = true,
                Type = "result",
                Command = "clean-temp",
                Message = "Temporary folders cleaned",
                Data = new
                {
                    tempDir = AppPaths.TempDir,
                    firmwareTempRoot = AppPaths.FirmwareTempRoot,
                },
            });
            return 0;
        }
        catch (Exception ex)
        {
            ConsoleProtocol.Error("clean-temp", ex.Message, "CLEAN_TEMP_FAILED");
            return 1;
        }
    }
}
