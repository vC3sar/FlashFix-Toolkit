namespace FlashFix.Core.Safety;

internal static class Warnings
{
    public const string NoDevice = "No Samsung device detected in Download Mode";
    public const string DeviceUnavailable = "Device connection unavailable";
    public const string FirmwareMissing = "Firmware folder does not contain all expected Samsung packages";
    public const string UnmappedImage = "Unmapped image excluded from flash plan";
    public const string UserDataExcluded = "USERDATA is excluded by default";
    public const string CscMayWipe = "CSC may wipe user data";
    public const string HomeCscNotGuaranteed = "HOME_CSC may preserve data, but this is not guaranteed";
    public const string PlanHasCriticalWarnings = "Flash plan contains blocking safety warnings";
}
