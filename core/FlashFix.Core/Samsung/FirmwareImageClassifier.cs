namespace FlashFix.Core.Samsung;

internal static class FirmwareImageClassifier
{
    private static readonly HashSet<string> MetadataExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt",
        ".xml",
        ".json",
        ".csv",
        ".ini",
        ".cfg",
        ".prop",
        ".log",
    };

    private static readonly HashSet<string> AuxiliaryExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".md5",
        ".sha1",
        ".sha256",
        ".sig",
        ".asc",
        ".rsa",
        ".pem",
        ".key",
    };

    private static readonly HashSet<string> ArchiveExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".zip",
        ".rar",
        ".7z",
    };

    public static string ClassifyImageKind(string originalName, string preparedName, string decompressionStatus)
    {
        var original = Normalize(originalName);
        var prepared = Normalize(preparedName);
        var lowerOriginal = original.ToLowerInvariant();
        var lowerPrepared = prepared.ToLowerInvariant();

        if (EndsWithAny(lowerOriginal, ".pit") || EndsWithAny(lowerPrepared, ".pit"))
        {
            return "pit_file";
        }

        if (IsDownloadList(lowerOriginal) || IsDownloadList(lowerPrepared) || IsMetadataFile(lowerOriginal) || IsMetadataFile(lowerPrepared))
        {
            return "metadata_file";
        }

        if (IsArchiveFile(lowerOriginal) || IsArchiveFile(lowerPrepared))
        {
            return "archive_inside_firmware";
        }

        if (IsAuxiliaryFile(lowerOriginal) || IsAuxiliaryFile(lowerPrepared))
        {
            return "auxiliary_file";
        }

        if (string.Equals(decompressionStatus, "kept_compressed", StringComparison.OrdinalIgnoreCase)
            || string.Equals(decompressionStatus, "failed", StringComparison.OrdinalIgnoreCase))
        {
            if (EndsWithAny(lowerOriginal, ".img.lz4", ".bin.lz4") || EndsWithAny(lowerPrepared, ".img.lz4", ".bin.lz4", ".img", ".bin"))
            {
                return "oversized_container";
            }
        }

        if (IsPartitionImage(lowerOriginal) || IsPartitionImage(lowerPrepared))
        {
            return "partition_image";
        }

        return "unknown";
    }

    public static bool IsNonFlashableKind(string imageKind)
    {
        return imageKind is "pit_file" or "metadata_file" or "archive_inside_firmware" or "auxiliary_file";
    }

    public static string GetReasonForKind(string imageKind)
    {
        return imageKind switch
        {
            "pit_file" => "pit_file",
            "metadata_file" => "metadata_file",
            "archive_inside_firmware" => "archive_inside_firmware",
            "auxiliary_file" => "auxiliary_file",
            "oversized_container" => "compressed_or_oversized",
            "partition_image" => "partition_image",
            _ => "unknown",
        };
    }

    private static bool IsPartitionImage(string fileName)
    {
        return EndsWithAny(fileName, ".img", ".bin", ".img.lz4", ".bin.lz4");
    }

    private static bool IsMetadataFile(string fileName)
    {
        return MetadataExtensions.Any(fileName.EndsWith);
    }

    private static bool IsAuxiliaryFile(string fileName)
    {
        return AuxiliaryExtensions.Any(fileName.EndsWith);
    }

    private static bool IsArchiveFile(string fileName)
    {
        return ArchiveExtensions.Any(fileName.EndsWith);
    }

    private static bool IsDownloadList(string fileName)
    {
        return fileName.EndsWith("download-list.txt", StringComparison.OrdinalIgnoreCase)
            || fileName.EndsWith("file_list.txt", StringComparison.OrdinalIgnoreCase)
            || fileName.EndsWith("metadata.txt", StringComparison.OrdinalIgnoreCase);
    }

    private static bool EndsWithAny(string value, params string[] suffixes)
    {
        return suffixes.Any(suffix => value.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));
    }

    private static string Normalize(string value)
    {
        var name = Path.GetFileName(value.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(name))
        {
            return string.Empty;
        }

        if (name.EndsWith(".lz4", StringComparison.OrdinalIgnoreCase))
        {
            name = name[..^4];
        }

        return name;
    }
}
