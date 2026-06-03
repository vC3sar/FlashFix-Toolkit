namespace FlashFix.Core.Safety;

internal static class AllowedPartitions
{
    public static readonly HashSet<string> Values = new(StringComparer.OrdinalIgnoreCase)
    {
        "BOOT",
        "RECOVERY",
        "SYSTEM",
        "VENDOR",
        "PRODUCT",
        "ODM",
        "VBMETA",
        "DTBO",
        "MODEM",
        "CACHE",
        "HIDDEN",
    };

    public static bool Contains(string? partition)
        => !string.IsNullOrWhiteSpace(partition) && Values.Contains(partition);
}
