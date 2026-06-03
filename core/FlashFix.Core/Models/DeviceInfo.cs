namespace FlashFix.Core.Models;

public sealed class DeviceInfo
{
    public bool Connected { get; set; }
    public string ConnectionMode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Model { get; set; }
    public string? PortCom { get; set; }
    public string? PortName { get; set; }
    public string? PortPid { get; set; }
    public string? PortVid { get; set; }
    public string? PortGuid { get; set; }
    public Dictionary<string, string> Identifiers { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, string> Raw { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public List<string> Warnings { get; set; } = new();
}
