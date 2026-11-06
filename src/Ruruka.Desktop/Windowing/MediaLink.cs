using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace Ruruka.Desktop.Windowing;

/// <summary>The ruruka://media/{id} links of the Discord button: registered with Windows and handed to the running app.</summary>
internal static partial class MediaLink
{
    private const string ProtocolKeyPath = @"Software\Classes\ruruka";

    /// <summary>The AniList id in the arguments Windows passes; anything else is ignored, since any website can open such a link.</summary>
    public static int? Find(IEnumerable<string> arguments)
    {
        foreach (var argument in arguments)
        {
            var match = LinkPattern().Match(argument);
            if (match.Success) return int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
        }
        return null;
    }

    // <-- Écrit à chaque lancement pour suivre l'exe s'il change de dossier ; HKCU ne demande aucun droit admin -->
    public static void Register()
    {
        var executablePath = Environment.ProcessPath!;
        try
        {
            using var protocolKey = Registry.CurrentUser.CreateSubKey(ProtocolKeyPath, writable: true);
            protocolKey.SetValue("", "URL:Ruruka");
            protocolKey.SetValue("URL Protocol", "");
            using var iconKey = protocolKey.CreateSubKey("DefaultIcon", writable: true);
            iconKey.SetValue("", $"\"{executablePath}\",0");
            using var commandKey = protocolKey.CreateSubKey(@"shell\open\command", writable: true);
            commandKey.SetValue("", CommandFor(executablePath));
        }
        catch (Exception error) when (error is UnauthorizedAccessException or System.Security.SecurityException or IOException)
        {
            Debug.WriteLine($"[link] protocol not registered: {error.Message}");
        }
    }

    /// <summary>A second Ruruka started by a link leaves the id for the running one, then quits.</summary>
    public static void LeaveForRunningInstance(int mediaId)
    {
        try
        {
            File.WriteAllText(AppPaths.PendingMediaLinkFile, mediaId.ToString(CultureInfo.InvariantCulture));
        }
        catch (Exception error) when (error is UnauthorizedAccessException or IOException)
        {
            Debug.WriteLine($"[link] not handed over: {error.Message}");
        }
    }

    /// <summary>The id left by a second Ruruka, if any.</summary>
    public static int? TakeLeftByOtherInstance()
    {
        try
        {
            if (!File.Exists(AppPaths.PendingMediaLinkFile)) return null;
            var text = File.ReadAllText(AppPaths.PendingMediaLinkFile);
            File.Delete(AppPaths.PendingMediaLinkFile);
            return int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var mediaId) ? mediaId : null;
        }
        catch (Exception error) when (error is UnauthorizedAccessException or IOException)
        {
            Debug.WriteLine($"[link] not read: {error.Message}");
            return null;
        }
    }

    internal static string CommandFor(string executablePath) => $"\"{executablePath}\" \"%1\"";

    [GeneratedRegex(@"^ruruka://media/(\d{1,9})/?$", RegexOptions.IgnoreCase)]
    private static partial Regex LinkPattern();
}
