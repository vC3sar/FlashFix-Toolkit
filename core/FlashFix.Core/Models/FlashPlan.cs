namespace FlashFix.Core.Models;

public sealed class FlashPlan
{
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public string SourceFirmwarePath { get; set; } = string.Empty;
    public string PitPath { get; set; } = string.Empty;
    public string? AnalysisPath { get; set; }
    public string? PlanPath { get; set; }
    public string? ResultPath { get; set; }
    public DeviceInfo? Device { get; set; }
    public FirmwarePackage? Firmware { get; set; }
    public FirmwareBinaryCompatibility Binary { get; set; } = new();
    public List<PitPartition> PitPartitions { get; set; } = new();
    public List<FlashPlanItem> Items { get; set; } = new();
    public FlashPlanSummary Summary { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

public sealed class FlashPlanItem
{
    public string SourcePackage { get; set; } = string.Empty;
    public string Image { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string ImageKind { get; set; } = "unknown";
    public string Partition { get; set; } = string.Empty;
    public string PitStatus { get; set; } = "unknown";
    public bool Include { get; set; }
    public string Risk { get; set; } = "low";
    public string Confidence { get; set; } = "low";
    public string Status { get; set; } = "unmapped";
    public string Reason { get; set; } = string.Empty;
    public string DecompressionStatus { get; set; } = "not_checked";
    public string? MatchedPitPartition { get; set; }
    public string Category { get; set; } = "unknown";
    public List<string> Warnings { get; set; } = new();
}

public sealed class FlashPlanSummary
{
    public int TotalImages { get; set; }
    public int Included { get; set; }
    public int Excluded { get; set; }
    public int Warnings { get; set; }
    public int CriticalWarnings { get; set; }
    public int PitPartitionsLoaded { get; set; }
    public int ReadyCandidates { get; set; }
    public int MappedButNotReady { get; set; }
    public int HighRiskExcluded { get; set; }
    public int Unmapped { get; set; }
    public int Auxiliary { get; set; }
    public int Metadata { get; set; }
    public int PitFiles { get; set; }
    public int Unknown { get; set; }
}
