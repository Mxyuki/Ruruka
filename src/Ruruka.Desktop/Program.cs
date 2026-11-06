using System.Diagnostics;
using Ruruka.Desktop.Calendar;
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
        using var instanceMutex = new Mutex(true, InstanceMutexName + AppPaths.DevInstanceSuffix, out var isFirstInstance);
        using var showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShowEventName + AppPaths.DevInstanceSuffix);
        var mediaLink = MediaLink.Find(args);
        if (!isFirstInstance)
        {
            if (mediaLink is { } mediaId) MediaLink.LeaveForRunningInstance(mediaId);
            WindowChrome.AllowForegroundForOtherInstance();
            showEvent.Set();
            return;
        }

        // <-- Une copie de développement ne doit pas prendre les liens de la version installée -->
        if (MainForm.DevServerUrl is null && AppPaths.DevInstanceSuffix.Length == 0) MediaLink.Register();

        ApplicationConfiguration.Initialize();

        var settings = new SettingsStore(AppPaths.SettingsFile);
        var links = new LinkStore(AppPaths.LibraryLinksFile);
        var calendar = new CalendarStore(AppPaths.CalendarFile);
        var window = new MainForm(settings, links, calendar, mediaLink, isStartingHidden: args.Contains(StartupRegistration.StartupArgument));

        var showRequests = ThreadPool.RegisterWaitForSingleObject(showEvent, (_, _) =>
        {
            if (window.IsHandleCreated) window.BeginInvoke(window.ShowForOtherInstance);
        }, null, Timeout.Infinite, executeOnlyOnce: false);

        Application.Run(window);
        showRequests.Unregister(null);

        // <-- L'installateur refuse de tourner tant que le mutex d'instance existe : on le libère avant de le lancer -->
        if (window.PendingInstaller is not { } installer) return;
        instanceMutex.Dispose();
        Process.Start(new ProcessStartInfo(installer, "/SILENT /SP- /NOCANCEL") { UseShellExecute = true });
    }
}
