using K4os.Compression.LZ4.Streams;

namespace FlashFix.Core.Samsung;

internal sealed class Lz4Service
{
    private const int DecoderExtraMemory = 16 * 1024 * 1024;
    private const long InlineDecompressionLimitBytes = 512L * 1024L * 1024L;

    public bool IsLz4(string fileName)
        => fileName.EndsWith(".lz4", StringComparison.OrdinalIgnoreCase);

    public async Task<(string PreparedPath, List<string> Warnings)> DecompressIfNeededAsync(
        string inputPath,
        string outputDirectory,
        CancellationToken cancellationToken = default)
    {
        var warnings = new List<string>();
        var fileName = Path.GetFileName(inputPath);
        if (!IsLz4(fileName))
        {
            return (inputPath, warnings);
        }

        var inputInfo = new FileInfo(inputPath);
        if (inputInfo.Length > InlineDecompressionLimitBytes)
        {
            warnings.Add($"LZ4 container left compressed for analysis: {fileName}");
            return (inputPath, warnings);
        }

        var outputName = StripLz4Suffix(fileName);
        var outputPath = Path.Combine(outputDirectory, outputName);

        var success = await TryDecompressAsync(inputPath, outputPath, cancellationToken);
        if (success)
        {
            return (outputPath, warnings);
        }

        warnings.Add($"LZ4 container left compressed for analysis: {fileName}");
        return (inputPath, warnings);
    }

    public async Task<string> PrepareForFlashAsync(
        string inputPath,
        string outputDirectory,
        CancellationToken cancellationToken = default)
    {
        var fileName = Path.GetFileName(inputPath);
        if (!IsLz4(fileName))
        {
            return inputPath;
        }

        var outputName = StripLz4Suffix(fileName);
        var outputPath = Path.Combine(outputDirectory, outputName);

        var success = await TryDecompressAsync(inputPath, outputPath, cancellationToken);
        return success ? outputPath : inputPath;
    }

    private static async Task<bool> TryDecompressAsync(
        string inputPath,
        string outputPath,
        CancellationToken cancellationToken)
    {
        try
        {
            await using var input = File.OpenRead(inputPath);
            await using var decoder = K4os.Compression.LZ4.Streams.LZ4Stream.Decode(
                input,
                DecoderExtraMemory,
                leaveOpen: false,
                interactive: false);

            await using var output = File.Create(outputPath);
            await decoder.CopyToAsync(output, 81920, cancellationToken);
            await output.FlushAsync(cancellationToken);

            return new FileInfo(outputPath).Length > 0;
        }
        catch
        {
            if (File.Exists(outputPath))
            {
                try
                {
                    File.Delete(outputPath);
                }
                catch
                {
                    // Ignore cleanup failures here; caller will surface the summary warning.
                }
            }

            return false;
        }
    }

    public static string StripLz4Suffix(string fileName)
    {
        var name = Path.GetFileName(fileName);
        return name.EndsWith(".lz4", StringComparison.OrdinalIgnoreCase)
            ? name[..^4]
            : name;
    }
}
