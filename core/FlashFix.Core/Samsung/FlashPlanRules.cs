using FlashFix.Core.Models;
using FlashFix.Core.Safety;

namespace FlashFix.Core.Samsung;

internal static class FlashPlanRules
{
    public static FlashPlanItem CreateItem(FirmwareImage image, IReadOnlyCollection<PitPartition> pitPartitions)
    {
        var item = new FlashPlanItem
        {
            SourcePackage = image.SourcePackage,
            Image = image.PreparedName,
            FilePath = image.PreparedPath,
            ImageKind = image.ImageKind,
            Partition = image.SuggestedPartition,
            Confidence = image.Confidence,
            Status = image.Status,
            DecompressionStatus = image.DecompressionStatus,
            Reason = image.Reason,
        };

        var originalLabel = string.IsNullOrWhiteSpace(image.OriginalName) ? image.PreparedName : image.OriginalName;
        var pitLoaded = pitPartitions.Count > 0;

        if (string.IsNullOrWhiteSpace(item.Partition))
        {
            item.Include = false;
            item.Status = "excluded";
            item.Reason = "unmapped";
            item.Category = "unmapped";
            item.PitStatus = "not_checked";
            item.Warnings.Add($"Excluded from plan: {originalLabel} — unmapped image; no partition was suggested.");
            return item;
        }

        var partitionAllowed = AllowedPartitions.Contains(item.Partition);
        var highRisk = IsHighRiskPartition(item.Partition);

        var pitMatch = PartitionMatcher.TryMatch(item.Partition, pitPartitions, out var matchedName);
        item.MatchedPitPartition = matchedName;
        item.PitStatus = pitLoaded
            ? (pitMatch is null ? "not_found" : "matched")
            : "not_checked";

        if (IsNonFlashable(image.ImageKind))
        {
            item.Include = false;
            item.Status = "metadata_excluded";
            item.Category = "metadata_excluded";
            item.Reason = image.Reason;
            item.Risk = RiskForPartition(item.Partition);
            item.Warnings.Add(BuildNonFlashableMessage(originalLabel, image.ImageKind));
            return item;
        }

        if (string.Equals(item.Partition, "SUPER", StringComparison.OrdinalIgnoreCase))
        {
            item.Reason = "compressed_or_large_but_flashable_candidate";
            item.Risk = RiskForPartition(item.Partition);
            if (pitLoaded && pitMatch is not null)
            {
                item.Include = true;
                item.Status = "vital_ready";
                item.Category = "vital_ready";
                item.Reason = "super_vital_ready";
                item.Warnings.Add($"SUPER is vital for dynamic partitions; {originalLabel} is a flashable candidate.");
                return item;
            }

            item.Include = false;
            item.Status = "large_but_flashable";
            item.Category = "large_but_flashable";
            item.Warnings.Add(BuildCompressedMessage(originalLabel, item.Partition));
            return item;
        }

        if (string.Equals(image.ImageKind, "oversized_container", StringComparison.OrdinalIgnoreCase)
            || !string.Equals(image.DecompressionStatus, "success", StringComparison.OrdinalIgnoreCase))
        {
            item.Include = false;
            item.Status = "large_but_flashable";
            item.Category = "large_but_flashable";
            item.Reason = "compressed_or_oversized";
            item.Risk = RiskForPartition(item.Partition);
            item.Warnings.Add(BuildCompressedMessage(originalLabel, item.Partition));
            return item;
        }

        if (!partitionAllowed)
        {
            item.Include = false;
            item.Status = "excluded";
            item.Category = "high_risk_excluded";
            item.Reason = "not_allowed";
            item.Risk = RiskForPartition(item.Partition);
            item.Warnings.Add($"Excluded from plan: {originalLabel} — partition is blocked by safety rules.");
            return item;
        }

        if (string.Equals(item.Partition, "USERDATA", StringComparison.OrdinalIgnoreCase))
        {
            item.Include = false;
            item.Status = "high_risk_blocked";
            item.Category = "high_risk_blocked";
            item.Reason = "userdata_blocked";
            item.Risk = "high";
            item.Warnings.Add($"Excluded from plan: {originalLabel} — USERDATA may erase user data.");
            return item;
        }

        if (highRisk)
        {
            item.Include = false;
            item.Status = "high_risk_blocked";
            item.Category = "high_risk_blocked";
            item.Reason = "high_risk";
            item.Risk = RiskForPartition(item.Partition);
            item.Warnings.Add(BuildHighRiskMessage(originalLabel, item.Partition));
            return item;
        }

        if (!pitLoaded)
        {
            item.Include = false;
            item.Status = "pit_not_found";
            item.Category = "pit_not_found";
            item.Reason = "pit_not_checked";
            item.Risk = RiskForPartition(item.Partition);
            item.Warnings.Add($"Mapped but excluded: {originalLabel} → {item.Partition} — PIT data is not loaded.");
            return item;
        }

        if (pitMatch is null)
        {
            item.Include = false;
            item.Status = "pit_not_found";
            item.Category = "pit_not_found";
            item.Reason = "pit_not_found";
            item.Risk = RiskForPartition(item.Partition);
            item.Warnings.Add($"Mapped but excluded: {originalLabel} → {item.Partition} — partition not found in loaded PIT or not verified.");
            return item;
        }

        item.Include = true;
        item.Status = "ready";
        item.Category = "ready";
        item.Reason = "ready";
        item.Risk = RiskForPartition(item.Partition);
        item.Warnings.AddRange(BuildPolicyWarnings(item.Partition));
        return item;
    }

    public static bool IsNonFlashable(string imageKind)
        => FirmwareImageClassifier.IsNonFlashableKind(imageKind);

    public static string CategoryForImageKind(string imageKind, string status)
    {
        if (string.Equals(status, "ready", StringComparison.OrdinalIgnoreCase))
        {
            return "ready";
        }

        return imageKind switch
        {
            "pit_file" => "metadata_excluded",
            "metadata_file" => "metadata_excluded",
            "archive_inside_firmware" => "metadata_excluded",
            "auxiliary_file" => "metadata_excluded",
            "oversized_container" => "large_but_flashable",
            _ when string.Equals(status, "pit_not_found", StringComparison.OrdinalIgnoreCase) => "pit_not_found",
            _ when string.Equals(status, "high_risk_blocked", StringComparison.OrdinalIgnoreCase) => "high_risk_blocked",
            _ when string.Equals(status, "duplicate_resolved", StringComparison.OrdinalIgnoreCase) => "duplicate_resolved",
            _ when string.Equals(status, "excluded_by_user_mode", StringComparison.OrdinalIgnoreCase) => "excluded_by_user_mode",
            _ => "unknown",
        };
    }

    public static string RiskForPartition(string partition)
    {
        if (string.IsNullOrWhiteSpace(partition))
        {
            return "low";
        }

        if (string.Equals(partition, "SUPER", StringComparison.OrdinalIgnoreCase))
        {
            return "high";
        }

        if (HighRiskPartitions.Contains(partition))
        {
            return "high";
        }

        if (MediumRiskPartitions.Contains(partition))
        {
            return "medium";
        }

        return "low";
    }

    public static bool IsHighRiskPartition(string partition)
        => HighRiskPartitions.Contains(partition);

    public static List<string> BuildPolicyWarnings(string partition)
    {
        return new List<string>();
    }

    private static string BuildNonFlashableMessage(string originalLabel, string imageKind)
    {
        return imageKind switch
        {
            "pit_file" => $"Skipped: {originalLabel} — PIT file detected; not included in flash plan.",
            "metadata_file" => $"Skipped: {originalLabel} — metadata file, not flashable.",
            "archive_inside_firmware" => $"Skipped: {originalLabel} — auxiliary firmware archive, not flashable.",
            "auxiliary_file" => $"Skipped: {originalLabel} — auxiliary firmware file, not a flashable partition image.",
            _ => $"Skipped: {originalLabel} — non-flashable file type.",
        };
    }

    private static string BuildCompressedMessage(string originalLabel, string partition)
    {
        if (string.IsNullOrWhiteSpace(partition))
        {
            return $"Excluded from plan: {originalLabel} — oversized LZ4 container kept compressed; not ready for flashing.";
        }

        return $"Excluded from plan: {originalLabel} — oversized LZ4 container kept compressed; maps to {partition} but is not ready for flashing.";
    }

    private static string BuildHighRiskMessage(string originalLabel, string partition)
    {
        if (string.Equals(partition, "PRELOADER", StringComparison.OrdinalIgnoreCase))
        {
            return $"Excluded from plan: {originalLabel} — preloader is blocked by default because it carries high brick risk.";
        }

        if (string.Equals(partition, "VBMETA", StringComparison.OrdinalIgnoreCase) || string.Equals(partition, "VBMETA_SYSTEM", StringComparison.OrdinalIgnoreCase))
        {
            return $"Excluded from plan: {originalLabel} — {partition} is blocked by default because it can affect verified boot.";
        }

        return $"Excluded from plan: {originalLabel} — {partition} is blocked by safety rules.";
    }

    private static readonly HashSet<string> HighRiskPartitions = new(StringComparer.OrdinalIgnoreCase)
    {
        "PRELOADER",
        "LK",
        "LK_VERIFIED",
        "VBMETA",
        "VBMETA_SYSTEM",
        "EFUSE",
        "USERDATA",
    };

    private static readonly HashSet<string> MediumRiskPartitions = new(StringComparer.OrdinalIgnoreCase)
    {
        "BOOT",
        "INIT_BOOT",
        "VENDOR_BOOT",
        "RECOVERY",
        "DTBO",
        "SYSTEM",
        "VENDOR",
        "PRODUCT",
        "ODM",
        "MODEM",
        "MD1IMG",
        "CACHE",
        "PARAM",
        "UP_PARAM",
        "UH",
        "MISC",
        "PRISM",
        "OPTICS",
        "OMR",
        "DPM",
        "GZ",
        "SPMFW",
        "SCP",
        "SSPM",
        "TEE",
        "MCUPM",
    };
}
