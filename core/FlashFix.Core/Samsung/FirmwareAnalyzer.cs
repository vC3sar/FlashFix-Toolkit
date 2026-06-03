using System.Text.Json;
using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;

namespace FlashFix.Core.Samsung;

internal sealed class FirmwareAnalyzer
{
    private static readonly string[] PackageTypes = ["BL", "AP", "CP", "CSC", "HOME_CSC"];
    private readonly FirmwareExtractor _extractor = new();

    public async Task<FirmwarePackage> AnalyzeAsync(
        string firmwareFolder,
        OperationLogger logger,
        CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(firmwareFolder))
        {
            throw new DirectoryNotFoundException($"Firmware folder not found: {firmwareFolder}");
        }

        var analysisRoot = Path.Combine(AppPaths.FirmwareTempRoot, AppPaths.Timestamp());
        Directory.CreateDirectory(analysisRoot);

        var analysis = new FirmwarePackage
        {
            SourcePath = firmwareFolder,
            PackageType = "SamsungFirmware",
            Found = true,
            ExtractionRoot = analysisRoot,
            TempRoot = analysisRoot,
        };

        for (var i = 0; i < PackageTypes.Length; i++)
        {
            var packageType = PackageTypes[i];
            var percent = (int)Math.Round((i / (double)PackageTypes.Length) * 100.0);
            ConsoleProtocol.Progress("analyzing_firmware", $"Scanning {packageType} package", percent);

            var packagePath = FindPackage(firmwareFolder, packageType);
            if (packagePath is null)
            {
                analysis.MissingPackages.Add(packageType);
                analysis.Warnings.Add($"{packageType} package missing");
                ConsoleProtocol.Log("warning", $"{packageType} package missing");
                continue;
            }

            analysis.FoundPackages.Add(packagePath);
            var extracted = await _extractor.ExtractPackageAsync(packageType, packagePath, analysisRoot, logger, cancellationToken);
            analysis.Images.AddRange(extracted.Images);
            analysis.Warnings.AddRange(extracted.Warnings);
        }

        var analysisPath = Path.Combine(AppPaths.LogsDir, $"firmware-analysis-{AppPaths.Timestamp()}.json");
        analysis.AnalysisPath = analysisPath;
        await File.WriteAllTextAsync(analysisPath, JsonSerializer.Serialize(analysis, ConsoleProtocol.Options), cancellationToken);
        ConsoleProtocol.Log("info", "Firmware analysis completed", false, new
        {
            analysisPath,
            images = analysis.Images.Count,
            warnings = analysis.Warnings.Count,
        });
        ConsoleProtocol.Progress("analyzing_firmware", "Firmware analysis completed", 100);
        return analysis;
    }

    private static string? FindPackage(string folder, string packageType)
    {
        var patterns = new[]
        {
            $"{packageType}_*.tar.md5",
            $"{packageType}_*.tar",
            $"{packageType}_*.img",
        };

        foreach (var pattern in patterns)
        {
            var match = Directory.GetFiles(folder, pattern, SearchOption.TopDirectoryOnly)
                .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();

            if (!string.IsNullOrWhiteSpace(match))
            {
                return match;
            }
        }

        return null;
    }
}
