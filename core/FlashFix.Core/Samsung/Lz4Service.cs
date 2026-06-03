using K4os.Compression.LZ4.Legacy;

namespace FlashFix.Core.Samsung;

internal sealed class Lz4Service
{
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

        var outputName = StripLz4Suffix(fileName);
        var outputPath = Path.Combine(outputDirectory, outputName);

        try
        {
            var compressed = await File.ReadAllBytesAsync(inputPath, cancellationToken);
            byte[]? decoded = null;

            try
            {
                decoded = LZ4Legacy.Unwrap(compressed, 0);
            }
            catch
            {
                decoded = LZ4Legacy.Unwrap(compressed, 4);
            }

            await File.WriteAllBytesAsync(outputPath, decoded, cancellationToken);
            return (outputPath, warnings);
        }
        catch (Exception ex)
        {
            warnings.Add($"LZ4 decompression failed for {fileName}: {ex.Message}");
            return (inputPath, warnings);
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
