using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using FlashFix.Core.Samsung;

namespace FlashFix.Core.Commands;

internal sealed class AnalyzeFirmwareCommand
{
    public async Task<int> ExecuteAsync(string[] args)
    {
        if (args.Length < 1)
        {
            ConsoleProtocol.Error("analyze-firmware", "Missing firmware folder path", "INVALID_ARGUMENTS");
            return 1;
        }

        var firmwareFolder = args[0];
        using var logger = new OperationLogger("operation-analyze-firmware");
        logger.WriteLine("Command: analyze-firmware");

        try
        {
            var analyzer = new FirmwareAnalyzer();
            var analysis = await analyzer.AnalyzeAsync(firmwareFolder, logger);
            ConsoleProtocol.Result(new OperationResult
            {
                Ok = true,
                Type = "result",
                Command = "analyze-firmware",
                Message = "Firmware analysis completed",
                Data = new
                {
                    analysisPath = analysis.AnalysisPath,
                    tempRoot = analysis.TempRoot,
                    sourcePath = analysis.SourcePath,
                    foundPackages = analysis.FoundPackages,
                    missingPackages = analysis.MissingPackages,
                    images = analysis.Images,
                    warnings = analysis.Warnings,
                },
                Warnings = analysis.Warnings,
            });
            return 0;
        }
        catch (Exception ex)
        {
            ConsoleProtocol.Error("analyze-firmware", ex.Message, "ANALYZE_FAILED");
            return 1;
        }
    }
}
