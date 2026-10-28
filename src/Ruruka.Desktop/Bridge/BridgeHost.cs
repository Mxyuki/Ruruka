using System.Text.Json;
using Microsoft.Web.WebView2.Core;

namespace Ruruka.Desktop.Bridge;

public interface IBridgeEvents
{
    /// <summary>Sends an event to the UI. Safe to call from any thread.</summary>
    void Emit(string name, object payload);
}

/// <summary>Connects a <see cref="BridgeRouter"/> to a WebView2 instance.</summary>
public sealed class BridgeHost(SynchronizationContext uiContext) : IBridgeEvents
{
    private CoreWebView2? _webView;
    private BridgeRouter? _router;

    public void Attach(CoreWebView2 webView, BridgeRouter router)
    {
        _webView = webView;
        _router = router;
        webView.WebMessageReceived += OnWebMessageReceived;
    }

    public void Emit(string name, object payload)
    {
        var json = JsonSerializer.Serialize(new { @event = name, payload }, JsonDefaults.Options);
        uiContext.Post(_ => _webView?.PostWebMessageAsJson(json), null);
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        if (_router is null || !IsTrustedSource(args.Source)) return;
        var response = await _router.DispatchAsync(args.WebMessageAsJson);
        _webView?.PostWebMessageAsJson(response);
    }

    // AniList's login page runs in a separate window, but this guard keeps any stray
    // third-party frame from reaching host methods.
    private static bool IsTrustedSource(string source) =>
        source.StartsWith(MainForm.AppOrigin, StringComparison.OrdinalIgnoreCase)
        || (MainForm.DevServerUrl is { } devUrl && source.StartsWith(devUrl, StringComparison.OrdinalIgnoreCase));
}
