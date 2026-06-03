using FlashFix.Core.Models;
using FlashFix.Core.Safety;

namespace FlashFix.Core.Samsung;

internal static class FlashPlanPolicy
{
    public static string NormalizeInstallationMode(string? mode)
    {
        var normalized = mode?.Trim().ToLowerInvariant();
        return normalized is "keep-data" or "keep_data" or "keepdata" or "preserve" ? "keep_data" : "clean";
    }

    public static void ApplyInstallationMode(FlashPlan plan)
    {
        var requestedMode = NormalizeInstallationMode(plan.InstallationMode);
        var hasCsc = HasPackage(plan, "CSC");
        var hasHomeCsc = HasPackage(plan, "HOME_CSC");

        plan.Summary.HasCsc = hasCsc;
        plan.Summary.HasHomeCsc = hasHomeCsc;
        plan.Summary.SelectedRegionalPackage = string.Empty;
        plan.InstallationMode = requestedMode;
        plan.Summary.EffectiveInstallationMode = requestedMode;

        string selectedRegionalPackage = string.Empty;
        var warnings = new List<string>();

        if (requestedMode == "clean")
        {
            if (hasCsc)
            {
                selectedRegionalPackage = "CSC";
                warnings.Add(Warnings.CscMayWipe);
            }
            else if (hasHomeCsc)
            {
                selectedRegionalPackage = "HOME_CSC";
                plan.InstallationMode = "keep_data";
                plan.Summary.EffectiveInstallationMode = "keep_data";
                warnings.Add(Warnings.NoCleanPackageAvailable);
                warnings.Add(Warnings.KeepDataNotGuaranteed);
            }
        }
        else
        {
            if (hasHomeCsc)
            {
                selectedRegionalPackage = "HOME_CSC";
                warnings.Add(Warnings.KeepDataNotGuaranteed);
            }
            else if (hasCsc)
            {
                selectedRegionalPackage = "CSC";
                plan.InstallationMode = "clean";
                plan.Summary.EffectiveInstallationMode = "clean";
                warnings.Add(Warnings.NoHomeCscAvailable);
                warnings.Add(Warnings.CscMayWipe);
            }
        }

        if (string.IsNullOrWhiteSpace(selectedRegionalPackage))
        {
            if (hasCsc)
            {
                selectedRegionalPackage = "CSC";
            }
            else if (hasHomeCsc)
            {
                selectedRegionalPackage = "HOME_CSC";
            }
        }

        plan.Summary.SelectedRegionalPackage = selectedRegionalPackage;

        foreach (var item in plan.Items)
        {
            if (string.Equals(item.SourcePackage, "CSC", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(item.SourcePackage, "HOME_CSC", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(selectedRegionalPackage) &&
                    !string.Equals(item.SourcePackage, selectedRegionalPackage, StringComparison.OrdinalIgnoreCase))
                {
                    item.Include = false;
                    item.Status = "excluded_by_user_mode";
                    item.Category = "excluded_by_user_mode";
                    item.Reason = string.Equals(selectedRegionalPackage, "CSC", StringComparison.OrdinalIgnoreCase)
                        ? "home_csc_disabled"
                        : "csc_disabled";
                    var message = string.Equals(selectedRegionalPackage, "CSC", StringComparison.OrdinalIgnoreCase)
                        ? $"CSC excluded because the user chose HOME_CSC."
                        : $"HOME_CSC excluded because the user chose installation clean.";
                    item.Warnings.Add(message);
                }
            }

            if (!item.Include || !string.Equals(item.Status, "ready", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (IsVitalReadyPartition(item.Partition))
            {
                item.Status = "vital_ready";
                item.Category = item.Status;
                continue;
            }

            if (IsOptionalReadyPartition(item.Partition))
            {
                item.Status = "optional_ready";
                item.Category = item.Status;
                continue;
            }

            item.Status = "ready";
            item.Category = item.Status;
        }

        if (warnings.Count > 0)
        {
            plan.Warnings.AddRange(warnings);
        }
    }

    public static void ResolveDuplicateVbmeta(FlashPlan plan)
    {
        var duplicates = plan.Items
            .Where(item => string.Equals(item.Partition, "VBMETA", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (duplicates.Count <= 1)
        {
            return;
        }

        var preferred = duplicates.FirstOrDefault(item => string.Equals(item.SourcePackage, "AP", StringComparison.OrdinalIgnoreCase))
            ?? duplicates.First();

        foreach (var item in duplicates)
        {
            if (ReferenceEquals(item, preferred))
            {
                continue;
            }

            item.Include = false;
            item.Status = "duplicate_resolved";
            item.Category = "duplicate_resolved";
            item.Reason = "vbmeta_duplicate";
            item.Warnings.Add("VBMETA duplicate detected; the AP copy will be used to keep coherence with vbmeta_system and the system.");
        }

        if (preferred.Include)
        {
            preferred.Status = "vital_ready";
            preferred.Category = "vital_ready";
            preferred.Reason = "duplicate_resolved";
            preferred.Warnings.Add("VBMETA duplicate detected; the AP copy will be used to keep coherence with vbmeta_system and the system.");
        }
    }

    public static void BuildPreflightSummary(FlashPlan plan)
    {
        var images = plan.Firmware?.Images ?? new List<FirmwareImage>();

        plan.Summary.HasAp = images.Any(image => string.Equals(image.SourcePackage, "AP", StringComparison.OrdinalIgnoreCase));
        plan.Summary.HasBl = images.Any(image => string.Equals(image.SourcePackage, "BL", StringComparison.OrdinalIgnoreCase));
        plan.Summary.HasCp = images.Any(image => string.Equals(image.SourcePackage, "CP", StringComparison.OrdinalIgnoreCase));
        plan.Summary.HasCsc = images.Any(image => string.Equals(image.SourcePackage, "CSC", StringComparison.OrdinalIgnoreCase));
        plan.Summary.HasHomeCsc = images.Any(image => string.Equals(image.SourcePackage, "HOME_CSC", StringComparison.OrdinalIgnoreCase));
        plan.Summary.HasPIT = plan.PitPartitions.Count > 0;
        plan.Summary.HasSuper = plan.Items.Any(item => string.Equals(item.Partition, "SUPER", StringComparison.OrdinalIgnoreCase));

        plan.Summary.ReadyCandidates = plan.Items.Count(item => item.Include);
        plan.Summary.VitalReady = plan.Items.Count(item => string.Equals(item.Status, "vital_ready", StringComparison.OrdinalIgnoreCase));
        plan.Summary.OptionalReady = plan.Items.Count(item => string.Equals(item.Status, "optional_ready", StringComparison.OrdinalIgnoreCase));
        plan.Summary.MappedButNotReady = plan.Items.Count(item => string.Equals(item.Status, "large_but_flashable", StringComparison.OrdinalIgnoreCase));
        plan.Summary.HighRiskExcluded = plan.Items.Count(item => string.Equals(item.Status, "high_risk_blocked", StringComparison.OrdinalIgnoreCase));
        plan.Summary.PitNotFound = plan.Items.Count(item => string.Equals(item.Status, "pit_not_found", StringComparison.OrdinalIgnoreCase));
        plan.Summary.DuplicateResolved = plan.Items.Count(item => string.Equals(item.Status, "duplicate_resolved", StringComparison.OrdinalIgnoreCase));
        plan.Summary.MetadataExcluded = plan.Items.Count(item => string.Equals(item.Status, "metadata_excluded", StringComparison.OrdinalIgnoreCase));
        plan.Summary.ExcludedByUserMode = plan.Items.Count(item => string.Equals(item.Status, "excluded_by_user_mode", StringComparison.OrdinalIgnoreCase));
        plan.Summary.HighRiskBlocked = plan.Items.Count(item => string.Equals(item.Status, "high_risk_blocked", StringComparison.OrdinalIgnoreCase));
        plan.Summary.LargeButFlashable = plan.Items.Count(item => string.Equals(item.Status, "large_but_flashable", StringComparison.OrdinalIgnoreCase));
        plan.Summary.Unmapped = plan.Items.Count(item => string.Equals(item.Status, "unmapped", StringComparison.OrdinalIgnoreCase));
        plan.Summary.Metadata = plan.Items.Count(item => string.Equals(item.Category, "metadata_excluded", StringComparison.OrdinalIgnoreCase));
        plan.Summary.PitFiles = plan.Items.Count(item => string.Equals(item.Category, "metadata_excluded", StringComparison.OrdinalIgnoreCase) && string.Equals(item.ImageKind, "pit_file", StringComparison.OrdinalIgnoreCase));
        plan.Summary.Unknown = plan.Items.Count(item => string.Equals(item.Status, "unknown", StringComparison.OrdinalIgnoreCase));

        var blockingReasons = new List<string>();
        if (!plan.Summary.HasAp)
        {
            blockingReasons.Add("AP missing: the Android system package is required.");
        }

        if (!plan.Summary.HasSuper && HasModernLayout(plan))
        {
            blockingReasons.Add("Falta SUPER. El sistema Android principal puede quedar incompleto.");
        }

        if (!plan.Summary.HasBl)
        {
            blockingReasons.Add("BL missing: bootloader package not found.");
        }

        if (!plan.Summary.HasCp)
        {
            blockingReasons.Add("CP not found. The firmware can still install, but the modem/baseband may not update.");
        }

        if (!plan.Summary.HasCsc && !plan.Summary.HasHomeCsc)
        {
            blockingReasons.Add("No CSC or HOME_CSC package was found; no regional/operator configuration will be applied.");
        }

        if (!plan.Summary.HasPIT)
        {
            blockingReasons.Add("PIT is missing; partition validation is not available.");
        }

        if (plan.Items.Any(item => string.Equals(item.Partition, "SUPER", StringComparison.OrdinalIgnoreCase) && string.Equals(item.Status, "pit_not_found", StringComparison.OrdinalIgnoreCase)))
        {
            blockingReasons.Add("SUPER exists in AP but was not mapped or validated against PIT.");
        }

        plan.Summary.BlockingReasons = blockingReasons.Distinct(StringComparer.Ordinal).ToList();
    }

    private static bool HasPackage(FlashPlan plan, string packageName)
    {
        return (plan.Firmware?.Images ?? new List<FirmwareImage>())
            .Any(image => string.Equals(image.SourcePackage, packageName, StringComparison.OrdinalIgnoreCase));
    }

    private static bool HasModernLayout(FlashPlan plan)
    {
        return plan.Items.Any(item =>
            string.Equals(item.Partition, "SUPER", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.Partition, "VBMETA_SYSTEM", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.Partition, "INIT_BOOT", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.Partition, "VENDOR_BOOT", StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsVitalReadyPartition(string partition)
    {
        return string.Equals(partition, "SUPER", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "BOOT", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "INIT_BOOT", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "VENDOR_BOOT", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "DTBO", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "RECOVERY", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "VBMETA", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "VBMETA_SYSTEM", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "MD1IMG", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "PARAM", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "UP_PARAM", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "UH", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsOptionalReadyPartition(string partition)
    {
        return string.Equals(partition, "CACHE", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "OMR", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "OPTICS", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "PRISM", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "SYSTEM", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "VENDOR", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "PRODUCT", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "ODM", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "MISC", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "DPM", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "GZ", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "SPMFW", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "SCP", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "SSPM", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "TEE", StringComparison.OrdinalIgnoreCase)
            || string.Equals(partition, "MCUPM", StringComparison.OrdinalIgnoreCase);
    }
}
