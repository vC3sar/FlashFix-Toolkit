namespace FlashFix.Core.Models;

public sealed class FirmwarePackage
{
    public string SourcePath { get; set; } = string.Empty;
    public string PackageType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public bool Found { get; set; }
    public string? AnalysisPath { get; set; }
    public string? ExtractionRoot { get; set; }
    public string? TempRoot { get; set; }
    public List<string> FoundPackages { get; set; } = new();
    public List<string> MissingPackages { get; set; } = new();
    public List<FirmwareImage> Images { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

public sealed class FirmwareImage
{
    public string SourcePackage { get; set; } = string.Empty;
    public string OriginalName { get; set; } = string.Empty;
    public string PreparedName { get; set; } = string.Empty;
    public string PreparedPath { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string SuggestedPartition { get; set; } = string.Empty;
    public string Confidence { get; set; } = "low";
    public string Status { get; set; } = "unmapped";
    public bool IsLz4 { get; set; }
    public List<string> Warnings { get; set; } = new();
}
