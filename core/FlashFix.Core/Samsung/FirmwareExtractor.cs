using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using SharpOdinClient;
using SharpOdinClient.util;

namespace FlashFix.Core.Samsung;

internal sealed class FirmwareExtractor
{
    private const long MaxAutoDecompressBytes = 512L * 1024L * 1024L;
    private readonly Lz4Service _lz4 = new();
    private readonly Odin _odin = new();

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
        var compressedContainerCount = 0;
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
            var decompressionStatus = "not_applicable";
            if (isLz4)
            {
                var estimatedSize = TryEstimateLz4Size(filePath, originalName);
                var shouldSkipDecompression =
                    estimatedSize > MaxAutoDecompressBytes ||
                    safeName.Equals("super.img.lz4", StringComparison.OrdinalIgnoreCase);

                if (shouldSkipDecompression)
                {
                    compressedContainerCount++;
                    decompressionStatus = "kept_compressed";
                    logger.WriteLine($"LZ4 left compressed for analysis: {packageType}:{safeName} (estimated size {estimatedSize})");
                    ConsoleProtocol.Log("info", $"LZ4 left compressed for analysis: {packageType}:{safeName}", false, new
                    {
                        packageType,
                        originalName = safeName,
                        preparedPath,
                        estimatedSize,
                    });
                }
                else
                {
                    var decompressed = await _lz4.DecompressIfNeededAsync(rawPath, packageRoot, cancellationToken);
                    preparedPath = decompressed.PreparedPath;
                    preparedName = Path.GetFileName(preparedPath);
                    decompressionStatus = string.Equals(preparedPath, rawPath, StringComparison.OrdinalIgnoreCase)
                        ? "failed"
                        : "success";
                    if (decompressed.Warnings.Count > 0 && preparedPath == rawPath)
                    {
                        compressedContainerCount++;
                        decompressionStatus = "kept_compressed";
                        logger.WriteLine($"LZ4 left compressed for analysis: {packageType}:{safeName}");
                        ConsoleProtocol.Log("info", $"LZ4 left compressed for analysis: {packageType}:{safeName}", false, new
                        {
                            packageType,
                            originalName = safeName,
                            preparedPath,
                        });
                    }
                }
            }

            var imageKind = FirmwareImageClassifier.ClassifyImageKind(safeName, preparedName, decompressionStatus);
            var mapped = PartitionMapper.TryMap(preparedName, out var partition, out var confidence);
            var suggestedPartition = string.Empty;
            var status = "unknown";
            var reason = FirmwareImageClassifier.GetReasonForKind(imageKind);
            var warnings = new List<string>();

            if (FirmwareImageClassifier.IsNonFlashableKind(imageKind))
            {
                status = "non_flashable";
            }
            else if (string.Equals(imageKind, "oversized_container", StringComparison.OrdinalIgnoreCase))
            {
                status = mapped ? "mapped_but_not_ready" : "unmapped";
                if (mapped)
                {
                    suggestedPartition = partition;
                }
            }
            else if (mapped)
            {
                status = "mapped";
                suggestedPartition = partition;
            }
            else
            {
                status = "unmapped";
            }

            if (string.Equals(imageKind, "oversized_container", StringComparison.OrdinalIgnoreCase))
            {
                warnings.Add($"LZ4 container left compressed for analysis: {safeName}");
            }

            package.Images.Add(new FirmwareImage
            {
                SourcePackage = packageType,
                OriginalName = safeName,
                PreparedName = preparedName,
                PreparedPath = preparedPath,
                SizeBytes = new FileInfo(preparedPath).Length,
                SuggestedPartition = suggestedPartition,
                Confidence = mapped ? confidence : "low",
                Status = status,
                ImageKind = imageKind,
                DecompressionStatus = decompressionStatus,
                Reason = reason,
                IsLz4 = isLz4,
                Warnings = warnings,
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

        if (compressedContainerCount > 0)
        {
            var warning = $"{packageType} contains {compressedContainerCount} LZ4 container(s) kept compressed for analysis";
            package.Warnings.Add(warning);
            logger.WriteLine(warning);
            ConsoleProtocol.Log("warning", warning, false, new
            {
                packageType,
                compressedContainerCount,
            });
        }

        return package;
    }

    private long TryEstimateLz4Size(string archivePath, string entryName)
    {
        try
        {
            return _odin.CalculateLz4SizeFromTar(archivePath, entryName);
        }
        catch
        {
            return 0;
        }
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
