using System.Text.Json;
using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using FlashFix.Core.Safety;
using SharpOdinClient.Pit;
using SharpOdinClient.structs;

namespace FlashFix.Core.Samsung;

internal sealed class FlashPlanService
{
    private readonly FirmwareAnalyzer _analyzer = new();
    private readonly DeviceService _deviceService;
    private readonly PitService _pitService;

    public FlashPlanService(OperationLogger logger)
    {
        _deviceService = new DeviceService(logger);
        _pitService = new PitService(logger);
    }

    public async Task<FlashPlan> BuildPlanAsync(string firmwareFolder, string pitJsonPath, OperationLogger logger, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(pitJsonPath))
        {
            throw new FileNotFoundException("PIT JSON file not found.", pitJsonPath);
        }

        var pitPartitions = JsonSerializer.Deserialize<List<PitPartition>>(await File.ReadAllTextAsync(pitJsonPath, cancellationToken), ConsoleProtocol.Options) ?? new List<PitPartition>();
        var analysis = await _analyzer.AnalyzeAsync(firmwareFolder, logger, cancellationToken);
        var device = await _deviceService.DetectAsync(cancellationToken);

        var plan = new FlashPlan
        {
            CreatedAt = DateTime.Now,
            SourceFirmwarePath = firmwareFolder,
            PitPath = pitJsonPath,
            AnalysisPath = analysis.AnalysisPath,
            Device = device,
            Firmware = analysis,
            PitPartitions = pitPartitions,
        };

        foreach (var image in analysis.Images)
        {
            var item = BuildItem(image, pitPartitions);
            plan.Items.Add(item);
        }

        plan.Summary.TotalImages = plan.Items.Count;
        plan.Summary.Included = plan.Items.Count(x => x.Include);
        plan.Summary.Excluded = plan.Items.Count - plan.Summary.Included;
        plan.Summary.Warnings = plan.Items.Sum(x => x.Warnings.Count);
        plan.Summary.CriticalWarnings = plan.Items.Count(x => x.Include && x.Warnings.Count > 0);
        plan.Warnings.AddRange(analysis.Warnings);
        plan.Warnings.AddRange(plan.Items.SelectMany(x => x.Warnings));

        var planPath = Path.Combine(AppPaths.LogsDir, $"flash-plan-{AppPaths.Timestamp()}.json");
        plan.PlanPath = planPath;
        await File.WriteAllTextAsync(planPath, JsonSerializer.Serialize(plan, ConsoleProtocol.Options), cancellationToken);
        ConsoleProtocol.Log("info", "Flash plan built", false, new
        {
            planPath,
            items = plan.Items.Count,
            included = plan.Summary.Included,
            excluded = plan.Summary.Excluded,
        });
        return plan;
    }

    public async Task<FlashPlan> ExecutePlanAsync(string planJsonPath, OperationLogger logger, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(planJsonPath))
        {
            throw new FileNotFoundException("Plan file not found.", planJsonPath);
        }

        var plan = JsonSerializer.Deserialize<FlashPlan>(await File.ReadAllTextAsync(planJsonPath, cancellationToken), ConsoleProtocol.Options)
            ?? throw new InvalidOperationException("Unable to read flash plan.");

        var device = await _deviceService.DetectAsync(cancellationToken);
        if (!device.Connected)
        {
            throw new InvalidOperationException(Warnings.NoDevice);
        }

        var pitResult = await _pitService.ReadPitAsync(cancellationToken);
        plan.Device = device;
        plan.PitPartitions = pitResult.Partitions;

        var blockingReasons = SafetyValidator.ValidatePlan(plan);
        if (blockingReasons.Count > 0)
        {
            throw new InvalidOperationException($"{Warnings.PlanHasCriticalWarnings}: {string.Join("; ", blockingReasons)}");
        }

        var flashFiles = plan.Items
            .Where(item => item.Include)
            .Select(item => new FileFlash
            {
                FileName = item.Image,
                Enable = true,
                FilePath = item.FilePath,
                RawSize = new FileInfo(item.FilePath).Length,
            })
            .ToList();

        var pitEntries = plan.PitPartitions.Select(PitService.ToEntry).ToList();
        var odin = new OdinService(logger);
        ConsoleProtocol.Progress("flashing", "Sending flash plan to SharpOdinClient", 0);
        var flashSucceeded = flashFiles.Count == 1
            ? await odin.FlashSingleFileAsync(flashFiles[0], pitEntries, debug: true)
            : await odin.FlashFirmwareAsync(flashFiles, pitEntries, debug: true);

        var resultPath = Path.Combine(AppPaths.LogsDir, $"flash-result-{AppPaths.Timestamp()}.json");
        plan.PlanPath ??= planJsonPath;
        plan.ResultPath = resultPath;
        await File.WriteAllTextAsync(resultPath, JsonSerializer.Serialize(new
        {
            ok = flashSucceeded,
            planPath = planJsonPath,
            included = flashFiles.Count,
            device = device,
            warnings = plan.Warnings,
            summary = plan.Summary,
        }, ConsoleProtocol.Options), cancellationToken);
        ConsoleProtocol.Log("info", "Flash plan executed", false, new
        {
            resultPath,
            included = flashFiles.Count,
            flashSucceeded,
        });

        if (!flashSucceeded)
        {
            plan.Warnings.Add("Flash operation returned false");
        }
        return plan;
    }

    private static FlashPlanItem BuildItem(FirmwareImage image, List<PitPartition> pitPartitions)
    {
        var item = new FlashPlanItem
        {
            SourcePackage = image.SourcePackage,
            Image = image.PreparedName,
            FilePath = image.PreparedPath,
            Partition = image.SuggestedPartition,
            Confidence = image.Confidence,
            Status = image.Status,
        };

        var partitionExists = pitPartitions.Any(p => string.Equals(p.Name, item.Partition, StringComparison.OrdinalIgnoreCase));
        item.PitStatus = partitionExists ? "matched" : "missing";
        item.Include = image.Status == "mapped" && partitionExists && AllowedPartitions.Contains(item.Partition);
        item.Risk = item.Partition is "CSC" ? "high" : item.Partition is "HOME_CSC" ? "medium" : "medium";
        item.Warnings = new List<string>(image.Warnings);

        if (!item.Include)
        {
            item.Warnings.Add($"Excluded from plan: {item.Image}");
        }

        if (string.Equals(item.Partition, "CSC", StringComparison.OrdinalIgnoreCase))
        {
            item.Warnings.Add(Warnings.CscMayWipe);
        }

        if (string.Equals(item.Partition, "HOME_CSC", StringComparison.OrdinalIgnoreCase))
        {
            item.Warnings.Add(Warnings.HomeCscNotGuaranteed);
        }

        if (!AllowedPartitions.Contains(item.Partition))
        {
            item.Warnings.Add($"Partition not allowed: {item.Partition}");
        }

        if (!partitionExists)
        {
            item.Warnings.Add($"Partition not found in PIT: {item.Partition}");
        }

        if (string.Equals(item.Partition, "USERDATA", StringComparison.OrdinalIgnoreCase))
        {
            item.Include = false;
            item.Warnings.Add(Warnings.UserDataExcluded);
        }

        return item;
    }
}
