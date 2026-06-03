using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using FlashFix.Core.Samsung;

namespace FlashFix.Core.Commands;

internal sealed class FlashPlanCommand
{
    public async Task<int> ExecuteAsync(string[] args)
    {
        if (args.Length < 1)
        {
            ConsoleProtocol.Error("flash-plan", "Missing plan JSON path", "INVALID_ARGUMENTS");
            return 1;
        }

        using var logger = new OperationLogger("operation-flash-plan");
        logger.WriteLine("Command: flash-plan");
        var planJsonPath = args[0];

        try
        {
            var service = new FlashPlanService(logger);
            var plan = await service.ExecutePlanAsync(planJsonPath, logger);
            ConsoleProtocol.Result(new OperationResult
            {
                Ok = true,
                Type = "result",
                Command = "flash-plan",
                Message = "Flash plan executed",
                Data = new
                {
                    planPath = plan.PlanPath ?? planJsonPath,
                    resultPath = plan.ResultPath,
                    included = plan.Items.Count(x => x.Include),
                    warnings = plan.Warnings,
                    summary = plan.Summary,
                },
                Warnings = plan.Warnings,
            });
            return 0;
        }
        catch (Exception ex)
        {
            ConsoleProtocol.Error("flash-plan", ex.Message, "FLASH_PLAN_FAILED");
            return 1;
        }
    }
}
