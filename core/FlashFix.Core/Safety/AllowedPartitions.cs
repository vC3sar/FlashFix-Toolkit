namespace FlashFix.Core.Safety;

internal static class AllowedPartitions
{
    public static readonly HashSet<string> Values = new(StringComparer.OrdinalIgnoreCase)
    {
        "BOOT",
        "INIT_BOOT",
        "VENDOR_BOOT",
        "RECOVERY",
        "DTBO",
        "VBMETA",
        "VBMETA_SYSTEM",
        "SUPER",
        "USERDATA",
        "CACHE",
        "SYSTEM",
        "VENDOR",
        "PRODUCT",
        "ODM",
        "MODEM",
        "MD1IMG",
        "PRELOADER",
        "LK",
        "LK_VERIFIED",
        "DPM",
        "GZ",
        "SPMFW",
        "SCP",
        "SSPM",
        "TEE",
        "MCUPM",
        "PARAM",
        "UP_PARAM",
        "UH",
        "EFUSE",
        "MISC",
        "PRISM",
        "OPTICS",
        "OMR",
        "HIDDEN",
    };

    public static bool Contains(string? partition)
        => !string.IsNullOrWhiteSpace(partition) && Values.Contains(partition);
}
