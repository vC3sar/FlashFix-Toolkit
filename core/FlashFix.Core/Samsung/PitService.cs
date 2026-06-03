using System.Text.Json;
using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using FlashFix.Core.Safety;
using SharpOdinClient.Pit;
using SharpOdinClient.structs;

namespace FlashFix.Core.Samsung;

internal sealed class PitService
{
    private readonly OperationLogger _logger;
    private readonly OdinService _odin;

    public PitService(OperationLogger logger)
    {
        _logger = logger;
        _odin = new OdinService(logger);
    }

    public async Task<(List<PitPartition> Partitions, string TxtPath, string JsonPath)> ReadPitAsync(CancellationToken cancellationToken = default)
    {
        var readResult = await _odin.ReadPitAsync();
        if (!readResult.Result || readResult.Pit is null || readResult.Pit.Count == 0)
        {
            var message = string.IsNullOrWhiteSpace(readResult.error) ? Warnings.NoDevice : readResult.error;
            throw new InvalidOperationException(message);
        }

        var partitions = readResult.Pit.Select(ToModel).ToList();
        var stamp = AppPaths.Timestamp();
        var txtPath = Path.Combine(AppPaths.LogsDir, $"pit-{stamp}.txt");
        var jsonPath = Path.Combine(AppPaths.LogsDir, $"pit-{stamp}.json");

        await File.WriteAllTextAsync(txtPath, BuildText(partitions), cancellationToken);
        await File.WriteAllTextAsync(jsonPath, JsonSerializer.Serialize(partitions, ConsoleProtocol.Options), cancellationToken);

        _logger.WriteJson(new
        {
            type = "log",
            level = "info",
            message = "PIT saved",
            data = new { txtPath, jsonPath, partitions = partitions.Count },
        });
        ConsoleProtocol.Log("info", "PIT saved", false, new { txtPath, jsonPath, partitions = partitions.Count });

        return (partitions, txtPath, jsonPath);
    }

    public static PitPartition ToModel(TPIT_Entry entry)
    {
        return new PitPartition
        {
            Name = entry.MpartitionName,
            Identifier = entry.Midentifier.ToString(),
            BlockStart = entry.MblockSizeOrOffset,
            BlockCount = entry.MblockCount,
            FileName = entry.MfotaFilename,
            FlashFileName = entry.MflashFilename,
            BinaryType = entry.MbinaryType,
            DeviceType = entry.MdeviceType,
            Attributes = entry.Mattributes,
            UpdateAttributes = entry.MupdateAttributes,
            FileOffset = entry.MfileOffset,
            FileSize = entry.MfileSize,
        };
    }

    public static TPIT_Entry ToEntry(PitPartition partition)
    {
        return new TPIT_Entry
        {
            MpartitionName = partition.Name ?? string.Empty,
            Midentifier = long.TryParse(partition.Identifier, out var identifier) ? identifier : 0,
            MblockSizeOrOffset = partition.BlockStart,
            MblockCount = partition.BlockCount,
            MfotaFilename = partition.FileName ?? string.Empty,
            MflashFilename = partition.FlashFileName ?? partition.FileName ?? string.Empty,
            MbinaryType = partition.BinaryType,
            MdeviceType = partition.DeviceType,
            Mattributes = partition.Attributes,
            MupdateAttributes = partition.UpdateAttributes,
            MfileOffset = partition.FileOffset,
            MfileSize = partition.FileSize,
        };
    }

    private static string BuildText(IEnumerable<PitPartition> partitions)
    {
        var lines = new List<string> { $"Generated: {DateTime.Now:O}", string.Empty };
        foreach (var p in partitions)
        {
            lines.Add($"{p.Name} | id={p.Identifier} | start={p.BlockStart} | count={p.BlockCount} | flash={p.FlashFileName}");
        }

        return string.Join(Environment.NewLine, lines);
    }
}
