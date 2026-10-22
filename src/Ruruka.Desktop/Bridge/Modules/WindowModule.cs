using Ruruka.Desktop.Windowing;

namespace Ruruka.Desktop.Bridge.Modules;

/// <summary>The buttons and drag area of the title bar drawn by the UI.</summary>
internal sealed class WindowModule(Form window) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register("window.minimize", () => Run(() => window.WindowState = FormWindowState.Minimized));
        router.Register("window.toggleMaximize", () => Run(ToggleMaximize));
        router.Register("window.close", () => Run(window.Close));
        router.Register("window.startDrag", () => Run(() => WindowChrome.StartDrag(window.Handle)));
        router.Register("window.startResize", () => Run(StartResizeTop));
    }

    private void ToggleMaximize() =>
        window.WindowState = window.WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;

    private void StartResizeTop()
    {
        if (window.WindowState == FormWindowState.Normal) WindowChrome.StartResizeTop(window.Handle);
    }

    // The move and resize loops block until the mouse is released, so the reply is sent first.
    private Task<bool> Run(Action action)
    {
        window.BeginInvoke(action);
        return Task.FromResult(true);
    }
}
