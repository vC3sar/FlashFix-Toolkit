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
        var bound = await _odin.FindAndSetDownloadModeAsync();
        if (!bound)
        {
            throw new InvalidOperationException(Warnings.NoDevice);
        }

        ReadPitResult readResult;
        try
        {
            readResult = await _odin.ReadPitAsync();
        }
        catch (NullReferenceException ex)
        {
            throw new InvalidOperationException(
                "SharpOdinClient did not return a valid PIT session. Re-run device detection and try again.",
                ex);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(ex.Message) ? "PIT read failed" : ex.Message,
                ex);
        }

        if (!readResult.Result || readResult.Pit is null || readResult.Pit.Count == 0)
        {
            var message = string.IsNullOrWhiteSpace(readResult.error)
                ? "No PIT data was returned by the connected device."
                : readResult.error;
            throw new InvalidOperationException(message);
        }

        var pitPartitions = readResult.Pit.Select(ToModel).ToList();
        var stamp = AppPaths.Timestamp();
        var txtPath = Path.Combine(AppPaths.LogsDir, $"pit-{stamp}.txt");
        var jsonPath = Path.Combine(AppPaths.LogsDir, $"pit-{stamp}.json");

        await File.WriteAllTextAsync(txtPath, BuildText(pitPartitions), cancellationToken);
        await File.WriteAllTextAsync(jsonPath, JsonSerializer.Serialize(pitPartitions, ConsoleProtocol.Options), cancellationToken);

        var pitLogData = new
        {
            txtPath,
            jsonPath,
            partitionCount = pitPartitions.Count,
        };

        _logger.WriteJson(new
        {
            type = "log",
            level = "info",
            message = "PIT saved",
            data = pitLogData,
        });
        ConsoleProtocol.Log("info", "PIT saved", false, pitLogData);

        return (pitPartitions, txtPath, jsonPath);
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
