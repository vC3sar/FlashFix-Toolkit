namespace FlashFix.Core.Models;

public sealed class OperationResult
{
    public bool Ok { get; set; }
    public string Type { get; set; } = "result";
    public string Command { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Code { get; set; }
    public object? Data { get; set; }
    public List<string>? Warnings { get; set; }
}
