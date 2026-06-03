using System.Text.RegularExpressions;
using FlashFix.Core.Models;

namespace FlashFix.Core.Samsung;

internal static class BinaryCompatibilityDetector
{
    private static readonly Regex FirmwareBitRegex = new(@"U(?<bit>\d{1,2})", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static FirmwareBinaryCompatibility Detect(params string[] sources)
    {
        var compatibility = new FirmwareBinaryCompatibility();
        var text = string.Join(' ', sources.Where(source => !string.IsNullOrWhiteSpace(source)));
        if (string.IsNullOrWhiteSpace(text))
        {
            return compatibility;
        }

        var matches = FirmwareBitRegex.Matches(text);
        foreach (Match match in matches)
        {
            if (!match.Success)
            {
                continue;
            }

            if (int.TryParse(match.Groups["bit"].Value, out var bit) && bit > 0)
            {
                compatibility.FirmwareBit = bit;
                compatibility.Status = "parsed";
                compatibility.Note = "Bootloader binary compatibility is separate from PIT partition matching.";
                return compatibility;
            }
        }

        return compatibility;
    }
}
