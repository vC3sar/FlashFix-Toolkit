namespace FlashFix.Core.Infrastructure;

internal static class AppPaths
{
    public static string WorkspaceRoot => ResolveWorkspaceRoot();
    public static string LogsDir => Path.Combine(WorkspaceRoot, "logs");
    public static string TempDir => Path.Combine(WorkspaceRoot, "temp");
    public static string FirmwareTempRoot => Path.Combine(TempDir, "firmware");
    public static string AnalysisDir => Path.Combine(LogsDir, "analysis");
    public static string PlansDir => Path.Combine(LogsDir, "plans");
    public static string ResultsDir => Path.Combine(LogsDir, "results");

    public static void Ensure()
    {
        Directory.CreateDirectory(LogsDir);
        Directory.CreateDirectory(TempDir);
        Directory.CreateDirectory(FirmwareTempRoot);
        Directory.CreateDirectory(AnalysisDir);
        Directory.CreateDirectory(PlansDir);
        Directory.CreateDirectory(ResultsDir);
    }

    public static string Timestamp() => DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");

    public static string NewLogPath(string prefix, string extension = ".log")
        => Path.Combine(LogsDir, $"{prefix}-{Timestamp()}{extension}");

    private static string ResolveWorkspaceRoot()
    {
        var env = Environment.GetEnvironmentVariable("FLASHFIX_WORKSPACE");
        if (!string.IsNullOrWhiteSpace(env))
        {
            return Path.GetFullPath(env);
        }

        var baseDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var parent = Directory.GetParent(baseDir);
        return parent?.FullName ?? baseDir;
    }
}
