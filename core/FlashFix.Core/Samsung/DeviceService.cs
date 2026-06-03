using System.Diagnostics;
using System.Management;
using FlashFix.Core.Infrastructure;
using FlashFix.Core.Logging;
using FlashFix.Core.Models;
using FlashFix.Core.Safety;
using SharpOdinClient.structs;

namespace FlashFix.Core.Samsung;

internal sealed class DeviceService
{
    private readonly OdinService _odin;

    public DeviceService(OperationLogger logger)
    {
        _odin = new OdinService(logger);
    }

    public async Task<DeviceInfo> DetectAsync(CancellationToken cancellationToken = default)
    {
        _ = cancellationToken;
        try
        {
            var port = await _odin.FindDownloadModePortAsync();
            var portInfo = MapPort(port);

            if (IsEmptyPort(port))
            {
                return new DeviceInfo
                {
                    Connected = false,
                    ConnectionMode = "Download Mode",
                    Status = "not_detected",
                    Warnings = new List<string> { "No Samsung device detected in Download Mode" },
                    Raw = new(StringComparer.OrdinalIgnoreCase)
                    {
                        ["connected"] = false.ToString(),
                    },
                };
            }

            var connected = false;
            try
            {
                connected = _odin.SetDownloadMode(port);
            }
            catch (Exception ex)
            {
                return new DeviceInfo
                {
                    Connected = false,
                    ConnectionMode = "Download Mode",
                    Status = "error",
                    PortCom = portInfo.Com,
                    PortName = portInfo.Name,
                    PortPid = portInfo.Pid,
                    PortVid = portInfo.Vid,
                    PortGuid = portInfo.Guid,
                    Raw = new(StringComparer.OrdinalIgnoreCase)
                    {
                        ["error"] = ex.Message,
                        ["com"] = portInfo.Com ?? string.Empty,
                        ["pid"] = portInfo.Pid ?? string.Empty,
                        ["vid"] = portInfo.Vid ?? string.Empty,
                    },
                    Warnings = new List<string> { "Device connection unavailable" },
                };
            }

            if (!connected)
            {
                return new DeviceInfo
                {
                    Connected = false,
                    ConnectionMode = "Download Mode",
                    Status = "not_detected",
                    PortCom = portInfo.Com,
                    PortName = portInfo.Name,
                    PortPid = portInfo.Pid,
                    PortVid = portInfo.Vid,
                    PortGuid = portInfo.Guid,
                    Raw = portInfo.Raw,
                    Warnings = new List<string> { "Samsung device found but Odin did not bind to the port" },
                };
            }

            var confirmed = false;
            try
            {
                confirmed = await _odin.IsOdinAsync();
            }
            catch (Exception ex)
            {
                return new DeviceInfo
                {
                    Connected = false,
                    ConnectionMode = "Download Mode",
                    Status = "error",
                    PortCom = portInfo.Com,
                    PortName = portInfo.Name,
                    PortPid = portInfo.Pid,
                    PortVid = portInfo.Vid,
                    PortGuid = portInfo.Guid,
                    Raw = new(StringComparer.OrdinalIgnoreCase)
                    {
                        ["error"] = ex.Message,
                        ["com"] = portInfo.Com ?? string.Empty,
                        ["pid"] = portInfo.Pid ?? string.Empty,
                        ["vid"] = portInfo.Vid ?? string.Empty,
                    },
                    Warnings = new List<string> { ClassifyDeviceError(ex) },
                };
            }

            return new DeviceInfo
            {
                Connected = connected,
                ConnectionMode = "Download Mode",
                Status = confirmed ? "detected" : "detected_pending",
                PortCom = portInfo.Com,
                PortName = portInfo.Name,
                PortPid = portInfo.Pid,
                PortVid = portInfo.Vid,
                PortGuid = portInfo.Guid,
                Raw = portInfo.Raw,
                Identifiers = new(StringComparer.OrdinalIgnoreCase)
                {
                    ["com"] = portInfo.Com ?? string.Empty,
                    ["pid"] = portInfo.Pid ?? string.Empty,
                    ["vid"] = portInfo.Vid ?? string.Empty,
                    ["guid"] = portInfo.Guid ?? string.Empty,
                    ["bind"] = connected.ToString(),
                    ["isOdin"] = confirmed.ToString(),
                },
                Warnings = confirmed
                    ? new List<string>()
                    : new List<string> { "Samsung device bound to the Odin port but the session was not confirmed" },
            };
        }
        catch (Exception ex)
        {
            return new DeviceInfo
            {
                Connected = false,
                ConnectionMode = "Download Mode",
                Status = "error",
                Warnings = new List<string> { ClassifyDeviceError(ex) },
                Raw = new(StringComparer.OrdinalIgnoreCase)
                {
                    ["error"] = ex.Message,
                },
            };
        }
    }

    public async Task<DeviceInfo> GetDeviceInfoAsync(CancellationToken cancellationToken = default)
    {
        var device = await DetectAsync(cancellationToken);
        if (!device.Connected)
        {
            return device;
        }

        try
        {
            var info = await _odin.GetDeviceInfoAsync();
            device.Raw = info;
            device.Identifiers = new(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in info)
            {
                device.Identifiers[kv.Key] = kv.Value;
            }

            var modelResolution = await ResolveModelAsync(device, info, cancellationToken);
            device.Model = modelResolution.Model;
            device.ModelSource = modelResolution.Source;
            device.ModelConfidence = modelResolution.Confidence;
            device.Warnings = info.Count == 0
                ? new List<string> { "SharpOdinClient returned no extra device info" }
                : new List<string>();
            foreach (var warning in modelResolution.Warnings)
            {
                if (!device.Warnings.Any(existing => string.Equals(existing, warning, StringComparison.OrdinalIgnoreCase)))
                {
                    device.Warnings.Add(warning);
                }
            }

            if (string.IsNullOrWhiteSpace(device.Model))
            {
                device.Warnings.Add("Exact model is not available in Download Mode.");
            }
            device.Status = "connected";
            return device;
        }
        catch (Exception ex)
        {
            device.Warnings.Add($"Device info unavailable: {ex.Message}");
            return device;
        }
    }

    private static bool IsEmptyPort(ItypePort port)
    {
        return string.IsNullOrWhiteSpace(port.COM)
            && string.IsNullOrWhiteSpace(port.Name)
            && string.IsNullOrWhiteSpace(port.PID)
            && string.IsNullOrWhiteSpace(port.VID);
    }

    private static (string? Com, string? Name, string? Pid, string? Vid, string? Guid, Dictionary<string, string> Raw) MapPort(ItypePort port)
    {
        var raw = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(port.COM)) raw["com"] = port.COM;
        if (!string.IsNullOrWhiteSpace(port.Name)) raw["name"] = port.Name;
        if (!string.IsNullOrWhiteSpace(port.PID)) raw["pid"] = port.PID;
        if (!string.IsNullOrWhiteSpace(port.VID)) raw["vid"] = port.VID;
        if (!string.IsNullOrWhiteSpace(port.GUID)) raw["guid"] = port.GUID;
        raw["type"] = port.Type.ToString();
        return (port.COM, port.Name, port.PID, port.VID, port.GUID, raw);
    }

    private static string? FindValue(Dictionary<string, string> info, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (info.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private async Task<(string? Model, string Source, string Confidence, List<string> Warnings)> ResolveModelAsync(
        DeviceInfo device,
        Dictionary<string, string> info,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;

        var direct = FindValue(info, "model", "product", "device", "name", "model_name", "ro.product.model");
        if (!string.IsNullOrWhiteSpace(direct) && !IsGenericTransportName(direct))
        {
            return (direct, "SharpOdinClient/DVIF", "high", new List<string>());
        }

        var adbModel = await TryReadModelFromAdbAsync();
        if (!string.IsNullOrWhiteSpace(adbModel))
        {
            return (adbModel, "adb", "high", new List<string>());
        }

        var windowsModel = TryReadModelFromWindows(device.PortCom);
        if (!string.IsNullOrWhiteSpace(windowsModel))
        {
            var confidence = IsGenericTransportName(windowsModel) ? "low" : "medium";
            return (windowsModel, "windows-pnp", confidence, new List<string>());
        }

        return (null, "unavailable", "none", new List<string>
        {
            "Exact model is not exposed by SharpOdinClient in this mode.",
        });
    }

    private static async Task<string?> TryReadModelFromAdbAsync()
    {
        var adbPath = FindExecutableOnPath("adb");
        if (string.IsNullOrWhiteSpace(adbPath))
        {
            return null;
        }

        var candidates = new[]
        {
            "ro.product.model",
            "ro.product.system.model",
            "ro.product.vendor.model",
            "ro.product.device",
            "ro.product.marketname",
        };

        foreach (var property in candidates)
        {
            var value = await RunProcessAndCaptureAsync(adbPath, $"shell getprop {property}");
            if (!string.IsNullOrWhiteSpace(value) && !IsGenericTransportName(value))
            {
                return value;
            }
        }

        return null;
    }

    private static string? TryReadModelFromWindows(string? comPort)
    {
        if (string.IsNullOrWhiteSpace(comPort))
        {
            return null;
        }

        try
        {
            using var serialSearcher = new ManagementObjectSearcher(
                $"SELECT DeviceID, PNPDeviceID, Name, Description, Caption FROM Win32_SerialPort WHERE DeviceID = '{EscapeWmi(comPort)}'");

            foreach (ManagementObject serial in serialSearcher.Get())
            {
                var pnpDeviceId = serial["PNPDeviceID"]?.ToString();
                if (string.IsNullOrWhiteSpace(pnpDeviceId))
                {
                    continue;
                }

                using var pnpSearcher = new ManagementObjectSearcher(
                    $"SELECT Name, Description, Caption FROM Win32_PnPEntity WHERE PNPDeviceID = '{EscapeWmi(pnpDeviceId)}'");

                foreach (ManagementObject entity in pnpSearcher.Get())
                {
                    var candidates = new[]
                    {
                        entity["Name"]?.ToString(),
                        entity["Description"]?.ToString(),
                        entity["Caption"]?.ToString(),
                    };

                    foreach (var candidate in candidates)
                    {
                        if (!string.IsNullOrWhiteSpace(candidate))
                        {
                            return candidate.Trim();
                        }
                    }
                }
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    private static bool IsGenericTransportName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        var text = value.Trim().ToLowerInvariant();
        return text.Contains("mobile usb modem")
            || text.Contains("cdc composite device")
            || text.Contains("composite device")
            || text.Contains("modem")
            || text.Contains("usb modem")
            || text == "samsung mobile usb";
    }

    private static string EscapeWmi(string value) => value.Replace("'", "''");

    private static string? FindExecutableOnPath(string fileName)
    {
        var path = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrWhiteSpace(path))
        {
            return null;
        }

        foreach (var folder in path.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var candidate = Path.Combine(folder, fileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            var exeCandidate = Path.Combine(folder, fileName + ".exe");
            if (File.Exists(exeCandidate))
            {
                return exeCandidate;
            }
        }

        return null;
    }

    private static async Task<string?> RunProcessAndCaptureAsync(string fileName, string arguments)
    {
        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using var process = Process.Start(startInfo);
            if (process is null)
            {
                return null;
            }

            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            var output = (await outputTask).Trim();
            _ = await errorTask;
            return string.IsNullOrWhiteSpace(output) ? null : output;
        }
        catch
        {
            return null;
        }
    }

    private static string ClassifyDeviceError(Exception ex)
    {
        var text = ex.Message.ToLowerInvariant();
        if (text.Contains("driver") || text.Contains("permission") || text.Contains("access denied"))
        {
            return "Driver or permission issue";
        }

        if (text.Contains("usb") || text.Contains("libusb"))
        {
            return "USB connection unavailable";
        }

        return "Device connection unavailable";
    }
}
