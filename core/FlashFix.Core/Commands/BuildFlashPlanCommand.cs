using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using FlashFix.Core.Samsung;

namespace FlashFix.Core.Commands;

internal sealed class BuildFlashPlanCommand
{
    public async Task<int> ExecuteAsync(string[] args)
    {
        if (args.Length < 2)
        {
            ConsoleProtocol.Error("build-plan", "Missing firmware folder or PIT JSON path", "INVALID_ARGUMENTS");
            return 1;
        }

        using var logger = new OperationLogger("operation-build-plan");
        logger.WriteLine("Command: build-plan");
        var firmwareFolder = args[0];
        var pitJsonPath = args[1];
        var installationMode = args.Length >= 3 ? args[2] : "clean";

        try
        {
            var service = new FlashPlanService(logger);
            var plan = await service.BuildPlanAsync(firmwareFolder, pitJsonPath, installationMode, logger);
            ConsoleProtocol.Result(new OperationResult
            {
                Ok = true,
                Type = "result",
                Command = "build-plan",
                Message = "Flash plan built",
                Data = new
                {
                    planPath = plan.PlanPath,
                    analysisPath = plan.AnalysisPath,
                    sourceFirmwarePath = plan.SourceFirmwarePath,
                    pitPath = plan.PitPath,
                    installationMode = plan.InstallationMode,
                    selectedRegionalPackage = plan.Summary.SelectedRegionalPackage,
                    summary = plan.Summary,
                    binary = plan.Binary,
                    warnings = plan.Warnings,
                    items = plan.Items,
                },
                Warnings = plan.Warnings,
            });
            return 0;
        }
        catch (Exception ex)
        {
            ConsoleProtocol.Error("build-plan", ex.Message, "BUILD_PLAN_FAILED");
            return 1;
        }
    }
}
