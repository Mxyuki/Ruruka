namespace Ruruka.Desktop.Windowing;

/// <summary>The notification-area icon that keeps Ruruka reachable while its window is hidden.</summary>
internal sealed class TrayIcon : IDisposable
{
    private readonly NotifyIcon _icon;
    private bool _hasExplainedHiding;

    /// <param name="onOpen">Brings the window back.</param>
    /// <param name="onExit">Really quits the app.</param>
    public TrayIcon(Icon? icon, Action onOpen, Action onExit)
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Ouvrir Ruruka", null, (_, _) => onOpen());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quitter", null, (_, _) => onExit());

        _icon = new NotifyIcon
        {
            Icon = icon ?? SystemIcons.Application,
            Text = "Ruruka",
            ContextMenuStrip = menu,
            Visible = true,
        };
        _icon.MouseClick += (_, args) =>
        {
            if (args.Button == MouseButtons.Left) onOpen();
        };
    }

    /// <summary>Tells the user once per session where the window went.</summary>
    public void ExplainHiding()
    {
        if (_hasExplainedHiding) return;
        _hasExplainedHiding = true;
        Notify("Ruruka continue l'enquête ici. Le suivi des épisodes reste actif.");
    }

    public void Notify(string message) => _icon.ShowBalloonTip(4000, "Ruruka", message, ToolTipIcon.None);

    public void Dispose()
    {
        _icon.Visible = false;
        _icon.ContextMenuStrip?.Dispose();
        _icon.Dispose();
    }
}
