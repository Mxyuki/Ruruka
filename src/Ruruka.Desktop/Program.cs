using System.Diagnostics;
using Ruruka.Desktop.Library;
using Ruruka.Desktop.Settings;
using Ruruka.Desktop.Windowing;

namespace Ruruka.Desktop;

internal static class Program
{
    private const string InstanceMutexName = "Ruruka.SingleInstance";
    private const string ShowEventName = "Ruruka.ShowWindow";

    [STAThread]
    private static void Main(string[] args)
    {
        // <-- Une seule instance : relancer Ruruka réaffiche la fenêtre rangée dans la zone de notification -->
        using var instanceMutex = new Mutex(true, InstanceMutexName, out var isFirstInstance);
        using var showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShowEventName);
        if (!isFirstInstance)
        {
            showEvent.Set();
            return;
        }

        ApplicationConfiguration.Initialize();

        var settings = new SettingsStore(AppPaths.SettingsFile);
        var links = new LinkStore(AppPaths.LibraryLinksFile);
        var window = new MainForm(settings, links, isStartingHidden: args.Contains(StartupRegistration.StartupArgument));

        var showRequests = ThreadPool.RegisterWaitForSingleObject(showEvent, (_, _) =>
        {
            if (window.IsHandleCreated) window.BeginInvoke(window.ShowFromTray);
        }, null, Timeout.Infinite, executeOnlyOnce: false);

        Application.Run(window);
        showRequests.Unregister(null);

        // <-- L'installateur refuse de tourner tant que le mutex d'instance existe : on le libère avant de le lancer -->
        if (window.PendingInstaller is not { } installer) return;
        instanceMutex.Dispose();
        Process.Start(new ProcessStartInfo(installer, "/SILENT /SP- /NOCANCEL") { UseShellExecute = true });
    }
}
