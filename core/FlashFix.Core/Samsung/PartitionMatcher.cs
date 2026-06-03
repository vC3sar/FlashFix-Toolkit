using FlashFix.Core.Models;

namespace FlashFix.Core.Samsung;

internal static class PartitionMatcher
{
    private static readonly Dictionary<string, string[]> PartitionAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["LK"] = ["LK", "LK_VERIFIED", "LK-VERIFIED"],
        ["LKVERIFIED"] = ["LK_VERIFIED", "LK-VERIFIED", "LK"],
        ["MD1IMG"] = ["MD1IMG", "MD1_IMG", "MODEM", "RADIO", "BASEBAND"],
        ["VBMETASYSTEM"] = ["VBMETA_SYSTEM", "VBMETA-SYSTEM"],
        ["INITBOOT"] = ["INIT_BOOT", "INIT-BOOT"],
        ["VENDORBOOT"] = ["VENDOR_BOOT", "VENDOR-BOOT"],
        ["UPPARAM"] = ["UP_PARAM", "UP-PARAM"],
        ["PRELOADER"] = ["PRELOADER", "PRE-LOADER"],
        ["PARAM"] = ["PARAM", "PARAMETER"],
        ["MISC"] = ["MISC", "MISC_IMG"],
        ["OMR"] = ["OMR", "OMR_IMG"],
        ["PRISM"] = ["PRISM", "PRISM_IMG"],
        ["OPTICS"] = ["OPTICS", "OPTICS_IMG"],
    };

    public static PitPartition? TryMatch(string partition, IReadOnlyCollection<PitPartition> pitPartitions, out string? matchedName)
    {
        matchedName = null;

        if (string.IsNullOrWhiteSpace(partition) || pitPartitions.Count == 0)
        {
            return null;
        }

        var targetAliases = GetAliases(partition);

        foreach (var pitPartition in pitPartitions)
        {
            var candidateNames = new[]
            {
                pitPartition.Name,
                pitPartition.FlashFileName,
                pitPartition.FileName,
                pitPartition.Identifier,
            };

            foreach (var candidate in candidateNames.Where(value => !string.IsNullOrWhiteSpace(value)))
            {
                var candidateAliases = GetAliases(candidate!);
                if (candidateAliases.Overlaps(targetAliases))
                {
                    matchedName = pitPartition.Name ?? pitPartition.FlashFileName ?? pitPartition.FileName ?? pitPartition.Identifier;
                    return pitPartition;
                }
            }
        }

        return null;
    }

    private static HashSet<string> GetAliases(string value)
    {
        var normalized = Normalize(value);
        var aliases = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            normalized,
        };

        if (PartitionAliases.TryGetValue(normalized, out var extraAliases))
        {
            foreach (var alias in extraAliases)
            {
                aliases.Add(Normalize(alias));
            }
        }

        return aliases;
    }

    private static string Normalize(string value)
    {
        var text = value.Trim().ToUpperInvariant();
        var chars = new List<char>(text.Length);

        foreach (var ch in text)
        {
            if (ch is '_' or '-' or ' ' or '.')
            {
                continue;
            }

            chars.Add(ch);
        }

        return new string(chars.ToArray());
    }
}
