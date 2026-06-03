namespace FlashFix.Core.Models;

public sealed class PitPartition
{
    public string? Name { get; set; }
    public string? Identifier { get; set; }
    public long BlockStart { get; set; }
    public long BlockCount { get; set; }
    public string? FileName { get; set; }
    public string? FlashFileName { get; set; }
    public long BinaryType { get; set; }
    public long DeviceType { get; set; }
    public long Attributes { get; set; }
    public long UpdateAttributes { get; set; }
    public long FileOffset { get; set; }
    public long FileSize { get; set; }
    public bool? Matched { get; set; }
    public string? Notes { get; set; }
}
