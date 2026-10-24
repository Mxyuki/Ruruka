using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Bridge.Modules;
using Ruruka.Desktop.Library;
using Ruruka.Desktop.Player;
using Ruruka.Desktop.Settings;
using Ruruka.Desktop.Updates;
using Ruruka.Desktop.Windowing;

namespace Ruruka.Desktop;

internal sealed class MainForm : Form
{
    private const string AppHost = "app.ruruka";

    public const string AppOrigin = $"https://{AppHost}/";

    /// <summary>Set RURUKA_DEV_URL to load the UI from the Vite dev server instead of the bundled files.</summary>
    public static readonly string? DevServerUrl = Environment.GetEnvironmentVariable("RURUKA_DEV_URL");

    private readonly WebView2 _webView = new() { Dock = DockStyle.Fill };
    private readonly SettingsStore _settings;
    private readonly LinkStore _links;
    private readonly TrayIcon _tray;
    private CoreWebView2Environment? _environment;
    private bool _isExiting;
    private BridgeHost? _bridge;
    private bool _isUiFinished;
    private bool _isWaitingForUi;
    private readonly TaskCompletionSource _uiFinishedSignal = new(TaskCreationOptions.RunContinuationsAsynchronously);

    // The UI gets a short moment to publish the idle profile; quitting never waits longer than this.
    private static readonly TimeSpan UiFinishTimeout = TimeSpan.FromSeconds(5);

    /// <summary>An installer downloaded by <c>update.install</c>, launched once the app has fully quit.</summary>
    public string? PendingInstaller { get; private set; }

    public MainForm(SettingsStore settings, LinkStore links)
    {
        _settings = settings;
        _links = links;

        Text = "Ruruka";
        Icon = LoadIcon();
        MinimumSize = new Size(980, 640);
        ClientSize = new Size(1360, 860);
        StartPosition = FormStartPosition.CenterScreen;

        BackColor = TitleBarTheme.Background;
        _webView.DefaultBackgroundColor = BackColor;
        Controls.Add(_webView);

        _tray = new TrayIcon(Icon, ShowFromTray, Exit);
    }

    /// <summary>Brings the window back from the notification area or the taskbar.</summary>
    public void ShowFromTray()
    {
        Show();
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate();
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        TitleBarTheme.Apply(Handle);
        WindowChrome.RefreshFrame(Handle);
    }

    // <-- La barre de titre est dessinée par l'interface : on masque celle de Windows en gardant le cadre -->
    protected override void WndProc(ref Message m)
    {
        if (WindowChrome.TryHandleCalcSize(ref m, message => base.WndProc(ref message), WindowState == FormWindowState.Maximized, DeviceDpi)) return;
        base.WndProc(ref m);
    }

    // <-- La croix range la fenêtre dans la zone de notification pour que mpv reste suivi -->
    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        var isHiding = e.CloseReason == CloseReason.UserClosing && !_isExiting && _settings.Current.IsCloseToTray;
        if (isHiding)
        {
            e.Cancel = true;
            Hide();
            _tray.ExplainHiding();
            return;
        }
        if (!_isUiFinished && _bridge is not null && e.CloseReason != CloseReason.WindowsShutDown)
        {
            e.Cancel = true;
            _ = CloseAfterUiAsync();
            return;
        }
        base.OnFormClosing(e);
    }

    // <-- Avant de quitter, l'interface remet le profil « au repos » pour qu'il ne reste pas bloqué sur un épisode -->
    private async Task CloseAfterUiAsync()
    {
        if (_isWaitingForUi) return;
        _isWaitingForUi = true;
        Hide();
        _bridge!.Emit("window.closing", new { });
        await Task.WhenAny(_uiFinishedSignal.Task, Task.Delay(UiFinishTimeout));
        _isUiFinished = true;
        _isExiting = true;
        Close();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        _tray.Dispose();
        base.OnFormClosed(e);
    }

    protected override void OnVisibleChanged(EventArgs e)
    {
        base.OnVisibleChanged(e);
        UpdateMemoryTarget();
    }

    private void Exit()
    {
        _isExiting = true;
        Close();
    }

    // <-- La réponse du pont part avant que la fenêtre se ferme -->
    private void QuitForUpdate(string installerPath)
    {
        PendingInstaller = installerPath;
        BeginInvoke(Exit);
    }

    protected override async void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        try
        {
            await InitializeWebViewAsync();
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(this, "Ruruka a besoin du runtime Microsoft Edge WebView2.\nInstalle-le depuis https://go.microsoft.com/fwlink/p/?LinkId=2124703",
                "WebView2 manquant", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Exit();
        }
    }

    // A minimized or hidden window doesn't need WebView2's caches; this hint lets it trim memory.
    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        UpdateMemoryTarget();
        if (WindowState != FormWindowState.Minimized) ApplyInterfaceScale();
    }

    private void UpdateMemoryTarget()
    {
        if (_webView.CoreWebView2 is not { } core) return;
        var isAway = !Visible || WindowState == FormWindowState.Minimized;
        core.MemoryUsageTargetLevel = isAway ? CoreWebView2MemoryUsageTargetLevel.Low : CoreWebView2MemoryUsageTargetLevel.Normal;
    }

    protected override void OnDpiChanged(DpiChangedEventArgs e)
    {
        base.OnDpiChanged(e);
        ApplyInterfaceScale();
    }

    private void ApplyInterfaceScale()
    {
        if (_webView.CoreWebView2 is null) return;
        var widthDip = ClientSize.Width * 96.0 / DeviceDpi;
        var zoom = InterfaceScale.For(widthDip, _settings.Current.InterfaceScale);
        if (Math.Abs(_webView.ZoomFactor - zoom) > 0.001) _webView.ZoomFactor = zoom;
    }

    private async Task InitializeWebViewAsync()
    {
        _environment = await CoreWebView2Environment.CreateAsync(null, AppPaths.WebViewData);
        await _webView.EnsureCoreWebView2Async(_environment);
        var core = _webView.CoreWebView2;

        var isDev = DevServerUrl is not null;
        core.Settings.AreDevToolsEnabled = isDev;
        core.Settings.AreDefaultContextMenusEnabled = isDev;
        core.Settings.AreBrowserAcceleratorKeysEnabled = isDev;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsZoomControlEnabled = false;

        core.NewWindowRequested += OnNewWindowRequested;
        core.NavigationStarting += OnNavigationStarting;

        ApplyInterfaceScale();

        var bridge = new BridgeHost(SynchronizationContext.Current!);
        bridge.Attach(core, CreateRouter(bridge));
        _bridge = bridge;

        if (isDev)
        {
            core.Navigate(DevServerUrl);
            return;
        }
        core.SetVirtualHostNameToFolderMapping(AppHost, AppPaths.WebRoot, CoreWebView2HostResourceAccessKind.Deny);
        core.Navigate(AppOrigin + "index.html");
    }

    private BridgeRouter CreateRouter(IBridgeEvents events)
    {
        var router = new BridgeRouter();
        IBridgeModule[] modules =
        [
            new SettingsModule(_settings, ApplyInterfaceScale),
            new AuthModule(_settings, this, () => _environment!),
            new LibraryModule(_settings, _links),
            new PlayerModule(new PlayerService(_settings, new BackgroundPlaybackNotifier(events, this, _tray))),
            new ShellModule(this),
            new WindowModule(this, () => _uiFinishedSignal.TrySetResult()),
            new UpdateModule(new UpdateService(), QuitForUpdate),
        ];
        foreach (var module in modules) module.Register(router);
        return router;
    }

    private static void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs args)
    {
        args.Handled = true;
        TryOpenExternally(args.Uri);
    }

    // The app is a single page; any navigation away from it is an outbound link for the browser.
    private static void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs args)
    {
        var isAppPage = args.Uri.StartsWith(AppOrigin, StringComparison.OrdinalIgnoreCase)
            || (DevServerUrl is not null && args.Uri.StartsWith(DevServerUrl, StringComparison.OrdinalIgnoreCase));
        if (isAppPage) return;
        args.Cancel = true;
        TryOpenExternally(args.Uri);
    }

    private static void TryOpenExternally(string uri)
    {
        try
        {
            ShellModule.OpenUrl(uri);
        }
        catch (BridgeException)
        {
            // Non-web schemes (javascript:, file:) are simply blocked.
        }
    }

    private static Icon? LoadIcon()
    {
        using var stream = typeof(MainForm).Assembly.GetManifestResourceStream("Ruruka.ico");
        return stream is null ? null : new Icon(stream);
    }
}
