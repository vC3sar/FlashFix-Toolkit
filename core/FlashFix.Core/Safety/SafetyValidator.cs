using FlashFix.Core.Models;

namespace FlashFix.Core.Safety;

internal static class SafetyValidator
{
    public static List<string> ValidatePlan(FlashPlan plan)
    {
        var blocking = new List<string>();

        if (plan.PitPartitions.Count == 0)
        {
            blocking.Add("PIT data is missing.");
        }

        if (!plan.Items.Any(item => item.Include))
        {
            blocking.Add("No flash items are included in the plan.");
        }

        foreach (var item in plan.Items)
        {
            if (!item.Include)
            {
                continue;
            }

            if (string.Equals(item.Partition, "USERDATA", StringComparison.OrdinalIgnoreCase))
            {
                blocking.Add(Warnings.UserDataExcluded);
            }

            if (!AllowedPartitions.Contains(item.Partition))
            {
                blocking.Add($"Partition not allowed: {item.Partition}");
            }

            if (string.Equals(item.Status, "unmapped", StringComparison.OrdinalIgnoreCase))
            {
                blocking.Add($"Unmapped image included: {item.Image}");
            }

            if (!File.Exists(item.FilePath))
            {
                blocking.Add($"Missing image file: {item.FilePath}");
            }

            if (!string.Equals(item.PitStatus, "matched", StringComparison.OrdinalIgnoreCase))
            {
                blocking.Add($"PIT mismatch for {item.Partition}");
            }
        }

        return blocking;
    }

    public static List<string> BuildWarnings(string partition, bool include)
    {
        var warnings = new List<string>();
        if (string.Equals(partition, "CSC", StringComparison.OrdinalIgnoreCase))
        {
            warnings.Add(Warnings.CscMayWipe);
        }

        if (string.Equals(partition, "HOME_CSC", StringComparison.OrdinalIgnoreCase))
        {
            warnings.Add(Warnings.HomeCscNotGuaranteed);
        }

        if (!include)
        {
            warnings.Add("Excluded by plan safety rules");
        }

        return warnings;
    }
}
