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

        var pitPartitions = new List<PitPartition>();

        var item = FlashPlanRules.CreateItem(image, pitPartitions);

        Assert.False(item.Include);
        Assert.Equal("large_but_flashable", item.Status);
        Assert.Equal("compressed_or_large_but_flashable_candidate", item.Reason);
        Assert.Equal("large_but_flashable", item.Category);
        Assert.Contains(item.Warnings, warning => warning.Contains("oversized LZ4 container", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void FlashPlanRules_Marks_Mapped_Super_As_VitalReady_When_Pit_Matches()
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

        Assert.True(item.Include);
        Assert.Equal("vital_ready", item.Status);
        Assert.Equal("vital_ready", item.Category);
        Assert.Equal("super_vital_ready", item.Reason);
    }

    [Fact]
    public void FlashPlanPolicy_Uses_Csc_For_Clean_Mode_And_Excludes_HomeCsc()
    {
        var plan = new FlashPlan
        {
            InstallationMode = "clean",
            Firmware = new FirmwarePackage
            {
                Images = new List<FirmwareImage>
                {
                    new() { SourcePackage = "AP", PreparedName = "boot.img", PreparedPath = "C:/temp/boot.img" },
                    new() { SourcePackage = "CSC", PreparedName = "cache.img", PreparedPath = "C:/temp/cache.img" },
                    new() { SourcePackage = "HOME_CSC", PreparedName = "cache.img", PreparedPath = "C:/temp/cache-home.img" },
                },
            },
            Items = new List<FlashPlanItem>
            {
                new() { SourcePackage = "CSC", Image = "cache.img", Partition = "CACHE", Include = true, Status = "ready", Category = "ready" },
                new() { SourcePackage = "HOME_CSC", Image = "cache.img", Partition = "CACHE", Include = true, Status = "ready", Category = "ready" },
            },
        };

        FlashPlanPolicy.ApplyInstallationMode(plan);

        Assert.Equal("clean", plan.InstallationMode);
        Assert.Equal("CSC", plan.Summary.SelectedRegionalPackage);
        Assert.True(plan.Items.First(item => item.SourcePackage == "CSC").Include);

        var homeCsc = plan.Items.First(item => item.SourcePackage == "HOME_CSC");
        Assert.False(homeCsc.Include);
        Assert.Equal("excluded_by_user_mode", homeCsc.Status);
        Assert.Equal("excluded_by_user_mode", homeCsc.Category);
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
