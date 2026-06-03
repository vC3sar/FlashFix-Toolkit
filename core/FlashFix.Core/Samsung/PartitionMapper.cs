namespace FlashFix.Core.Samsung;

internal static class PartitionMapper
{
    private static readonly Dictionary<string, string> Mappings = new(StringComparer.OrdinalIgnoreCase)
    {
        ["boot.img"] = "BOOT",
        ["init-boot.img"] = "INIT_BOOT",
        ["vendor-boot.img"] = "VENDOR_BOOT",
        ["recovery.img"] = "RECOVERY",
        ["dtbo.img"] = "DTBO",
        ["vbmeta.img"] = "VBMETA",
        ["vbmeta-system.img"] = "VBMETA_SYSTEM",
        ["super.img"] = "SUPER",
        ["userdata.img"] = "USERDATA",
        ["cache.img"] = "CACHE",
        ["system.img"] = "SYSTEM",
        ["vendor.img"] = "VENDOR",
        ["product.img"] = "PRODUCT",
        ["odm.img"] = "ODM",
        ["modem.bin"] = "MODEM",
        ["md1img.img"] = "MD1IMG",
        ["preloader.img"] = "PRELOADER",
        ["lk-verified.img"] = "LK_VERIFIED",
        ["lk.img"] = "LK",
        ["dpm-verified.img"] = "DPM",
        ["gz-verified.img"] = "GZ",
        ["spmfw-verified.img"] = "SPMFW",
        ["scp-verified.img"] = "SCP",
        ["sspm-verified.img"] = "SSPM",
        ["tee-verified.img"] = "TEE",
        ["mcupm-verified.img"] = "MCUPM",
        ["param.bin"] = "PARAM",
        ["up-param.bin"] = "UP_PARAM",
        ["uh.bin"] = "UH",
        ["efuse.img"] = "EFUSE",
        ["misc.bin"] = "MISC",
        ["prism.img"] = "PRISM",
        ["optics.img"] = "OPTICS",
        ["omr.img"] = "OMR",
        ["hidden.img"] = "HIDDEN",
    };

    public static bool TryMap(string fileName, out string partition, out string confidence)
    {
        var normalized = Normalize(fileName);
        if (Mappings.TryGetValue(normalized, out partition!))
        {
            confidence = "high";
            return true;
        }

        partition = string.Empty;
        confidence = "low";
        return false;
    }

    public static string Normalize(string fileName)
    {
        var lower = Path.GetFileName(fileName).ToLowerInvariant();
        if (lower.EndsWith(".lz4", StringComparison.OrdinalIgnoreCase))
        {
            lower = lower[..^4];
        }

        lower = lower.Replace('_', '-').Replace(' ', '-');
        return lower;
    }
}
