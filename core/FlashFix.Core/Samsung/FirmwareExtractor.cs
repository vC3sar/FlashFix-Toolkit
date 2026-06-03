using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using SharpOdinClient.util;

namespace FlashFix.Core.Samsung;

internal sealed class FirmwareExtractor
{
    private readonly Lz4Service _lz4 = new();

    public async Task<FirmwarePackage> ExtractPackageAsync(
        string packageType,
        string filePath,
        string outputRoot,
        OperationLogger logger,
        CancellationToken cancellationToken = default)
    {
        var package = new FirmwarePackage
        {
            SourcePath = filePath,
            PackageType = packageType,
            SizeBytes = new FileInfo(filePath).Length,
            Found = true,
            ExtractionRoot = outputRoot,
            TempRoot = outputRoot,
        };

        var tar = new Tar();
        var entries = tar.TarInformation(filePath) ?? new List<cListFileData>();
        var packageRoot = Path.Combine(outputRoot, packageType);
        Directory.CreateDirectory(packageRoot);

        var index = 0;
        foreach (var entry in entries)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var originalName = entry.Filename ?? entry.Filetype ?? $"entry-{index}";
            if (string.IsNullOrWhiteSpace(originalName))
            {
                continue;
            }

            var safeName = SanitizeFileName(originalName);
            byte[] extracted;
            try
            {
                extracted = await tar.ExtractFileFromTar(filePath, originalName);
            }
            catch (Exception ex)
            {
                var warning = $"Failed to extract {originalName} from {packageType}: {ex.Message}";
                package.Warnings.Add(warning);
                logger.WriteLine(warning);
                ConsoleProtocol.Log("warning", warning);
                continue;
            }

            if (extracted is null || extracted.Length == 0)
            {
                continue;
            }

            var rawPath = Path.Combine(packageRoot, safeName);
            await File.WriteAllBytesAsync(rawPath, extracted, cancellationToken);

            var preparedPath = rawPath;
            var preparedName = safeName;
            var isLz4 = _lz4.IsLz4(safeName);
            if (isLz4)
            {
                var decompressed = await _lz4.DecompressIfNeededAsync(rawPath, packageRoot, cancellationToken);
                preparedPath = decompressed.PreparedPath;
                preparedName = Path.GetFileName(preparedPath);
                package.Warnings.AddRange(decompressed.Warnings);
            }

            var mapped = PartitionMapper.TryMap(preparedName, out var partition, out var confidence);
            package.Images.Add(new FirmwareImage
            {
                SourcePackage = packageType,
                OriginalName = safeName,
                PreparedName = preparedName,
                PreparedPath = preparedPath,
                SizeBytes = new FileInfo(preparedPath).Length,
                SuggestedPartition = partition,
                Confidence = confidence,
                Status = mapped ? "mapped" : "unmapped",
                IsLz4 = isLz4,
                Warnings = mapped
                    ? new List<string>()
                    : new List<string> { "Image not mapped to a known partition" },
            });

            logger.WriteJson(new
            {
                type = "log",
                level = "info",
                message = $"Extracted {packageType}:{safeName}",
                data = new { preparedPath, sizeBytes = new FileInfo(preparedPath).Length },
            });
            ConsoleProtocol.Log("info", $"Extracted {packageType}:{safeName}", false, new
            {
                preparedPath,
                sizeBytes = new FileInfo(preparedPath).Length,
            });
            index++;
        }

        return package;
    }

    private static string SanitizeFileName(string value)
    {
        var fileName = Path.GetFileName(value.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(fileName))
        {
            fileName = "entry.bin";
        }

        var invalid = Path.GetInvalidFileNameChars();
        var chars = fileName.Select(ch => invalid.Contains(ch) ? '_' : ch).ToArray();
        return new string(chars);
    }
}
