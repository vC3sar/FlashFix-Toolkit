using FlashFix.Core.Models;
using FlashFix.Core.Safety;
using FlashFix.Core.Samsung;
using Xunit;

namespace FlashFix.Core.Tests;

public sealed class PlanRulesTests
{
    [Theory]
    [InlineData("boot.img", "BOOT")]
    [InlineData("init_boot.img", "INIT_BOOT")]
    [InlineData("vendor_boot.img", "VENDOR_BOOT")]
    [InlineData("vbmeta_system.img", "VBMETA_SYSTEM")]
    [InlineData("md1img.img", "MD1IMG")]
    public void PartitionMapper_Recognizes_Modern_Partitions(string fileName, string expectedPartition)
    {
        var mapped = PartitionMapper.TryMap(fileName, out var partition, out var confidence);

        Assert.True(mapped);
        Assert.Equal(expectedPartition, partition);
        Assert.Equal("high", confidence);
    }

    [Theory]
    [InlineData("A15_EUR_OPEN.pit", "pit_file")]
    [InlineData("download-list.txt", "metadata_file")]
    [InlineData("fota.zip", "archive_inside_firmware")]
    public void FirmwareImageClassifier_Separates_NonFlashable_Files(string fileName, string expectedKind)
    {
        var kind = FirmwareImageClassifier.ClassifyImageKind(fileName, fileName, "not_applicable");

        Assert.Equal(expectedKind, kind);
    }

    [Fact]
    public void FlashPlanRules_Excludes_Unmapped_Image_Without_PIT_Validation()
    {
        var image = new FirmwareImage
        {
            OriginalName = "preloader.img",
            PreparedName = "preloader.img",
            PreparedPath = "C:/temp/preloader.img",
            SuggestedPartition = string.Empty,
            Confidence = "low",
            Status = "unmapped",
            ImageKind = "partition_image",
            DecompressionStatus = "success",
        };

        var item = FlashPlanRules.CreateItem(image, []);

        Assert.False(item.Include);
        Assert.Equal("unmapped", item.Reason);
        Assert.Equal("unmapped", item.Category);
        Assert.DoesNotContain(item.Warnings, warning => warning.Contains("Partition not allowed:", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(item.Warnings, warning => warning.Contains("Partition not found in PIT:", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void FlashPlanRules_Marks_Kept_Compressed_Super_As_Not_Ready()
    {
        var image = new FirmwareImage
        {
            OriginalName = "super.img.lz4",
            PreparedName = "super.img.lz4",
            PreparedPath = "C:/temp/super.img.lz4",
            SuggestedPartition = "SUPER",
            Confidence = "high",
            Status = "mapped_but_not_ready",
            ImageKind = "oversized_container",
            DecompressionStatus = "kept_compressed",
        };

        var pitPartitions = new List<PitPartition>
        {
            new() { Name = "SUPER" },
        };

        var item = FlashPlanRules.CreateItem(image, pitPartitions);

        Assert.False(item.Include);
        Assert.Equal("mapped_but_not_ready", item.Status);
        Assert.Equal("compressed_or_oversized", item.Reason);
        Assert.Equal("mapped_but_not_ready", item.Category);
        Assert.Contains(item.Warnings, warning => warning.Contains("oversized LZ4 container", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void PartitionMatcher_Uses_Aliases_For_MediaTek_Modern_Partitions()
    {
        var pitPartitions = new List<PitPartition>
        {
            new() { Name = "RADIO" },
        };

        var matched = PartitionMatcher.TryMatch("MD1IMG", pitPartitions, out var matchedName);

        Assert.NotNull(matched);
        Assert.Equal("RADIO", matchedName);
    }

    [Fact]
    public void SafetyValidator_Does_Not_Blow_Up_On_Unmapped_Excluded_Items()
    {
        var plan = new FlashPlan
        {
            PitPartitions = new List<PitPartition>
            {
                new() { Name = "BOOT" },
            },
            Items = new List<FlashPlanItem>
            {
                new()
                {
                    Include = false,
                    Image = "preloader.img",
                    Partition = string.Empty,
                    Status = "excluded",
                    Reason = "unmapped",
                    PitStatus = "not_checked",
                    FilePath = "C:/temp/preloader.img",
                },
            },
        };

        var blocking = SafetyValidator.ValidatePlan(plan);

        Assert.DoesNotContain(blocking, warning => warning.Contains("Partition not allowed:", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(blocking, warning => warning.Contains("Partition not found in PIT:", StringComparison.OrdinalIgnoreCase));
    }
}
