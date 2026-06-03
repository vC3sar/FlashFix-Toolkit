namespace FlashFix.Core.Samsung;

internal static class PartitionMapper
{
    public static bool TryMap(string fileName, out string partition, out string confidence)
    {
        var normalized = Normalize(fileName);

        switch (normalized)
        {
            case "boot.img":
                partition = "BOOT";
                confidence = "high";
                return true;
            case "recovery.img":
                partition = "RECOVERY";
                confidence = "high";
                return true;
            case "system.img":
                partition = "SYSTEM";
                confidence = "high";
                return true;
            case "vendor.img":
                partition = "VENDOR";
                confidence = "high";
                return true;
            case "product.img":
                partition = "PRODUCT";
                confidence = "high";
                return true;
            case "odm.img":
                partition = "ODM";
                confidence = "high";
                return true;
            case "vbmeta.img":
                partition = "VBMETA";
                confidence = "high";
                return true;
            case "dtbo.img":
                partition = "DTBO";
                confidence = "high";
                return true;
            case "modem.bin":
                partition = "MODEM";
                confidence = "high";
                return true;
            case "cache.img":
                partition = "CACHE";
                confidence = "medium";
                return true;
            case "hidden.img":
                partition = "HIDDEN";
                confidence = "medium";
                return true;
            default:
                partition = string.Empty;
                confidence = "low";
                return false;
        }
    }

    private static string Normalize(string fileName)
    {
        var lower = Path.GetFileName(fileName).ToLowerInvariant();
        if (lower.EndsWith(".lz4", StringComparison.OrdinalIgnoreCase))
        {
            lower = lower[..^4];
        }

        return lower;
    }
}
