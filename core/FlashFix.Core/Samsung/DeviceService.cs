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
            var connected = await _odin.IsOdinAsync();
            var portInfo = MapPort(port);

            if (!connected || IsEmptyPort(port))
            {
                return new DeviceInfo
                {
                    Connected = false,
                    ConnectionMode = "Download Mode",
                    Status = "not_detected",
                    Warnings = new List<string> { "No Samsung device detected in Download Mode" },
                    Raw = new(StringComparer.OrdinalIgnoreCase)
                    {
                        ["connected"] = connected.ToString(),
                    },
                };
            }

            return new DeviceInfo
            {
                Connected = true,
                ConnectionMode = "Download Mode",
                Status = "detected",
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
                },
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

            device.Model = FindValue(info, "model", "product", "device", "name", "model_name");
            device.Warnings = info.Count == 0
                ? new List<string> { "SharpOdinClient returned no extra device info" }
                : new List<string>();
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
