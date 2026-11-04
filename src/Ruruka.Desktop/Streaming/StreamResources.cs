using Microsoft.Web.WebView2.Core;
using Ruruka.Desktop.Bridge;

namespace Ruruka.Desktop.Streaming;

/// <summary>
/// Carries file bytes between the UI and the host. JSON bridge messages would base64 every chunk, so
/// the UI uses fetch on this fake address, which WebView2 hands to the host without opening any port.
/// </summary>
internal sealed class StreamResources(StreamService stream, CoreWebView2Environment environment, Func<string, bool> isTrustedOrigin)
{
    private const string Address = "https://stream.ruruka/";

    public void Attach(CoreWebView2 webView)
    {
        webView.AddWebResourceRequestedFilter(Address + "*", CoreWebView2WebResourceContext.All);
        webView.WebResourceRequested += OnRequested;
    }

    private async void OnRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs args)
    {
        var uri = new Uri(args.Request.Uri);
        var origin = args.Request.Headers.Contains("Origin") ? args.Request.Headers.GetHeader("Origin") : "";
        if (!isTrustedOrigin(origin))
        {
            args.Response = Respond(null, 403, origin);
            return;
        }

        var deferral = args.GetDeferral();
        try
        {
            args.Response = uri.AbsolutePath switch
            {
                "/read" when args.Request.Method == "GET" => Respond(await ReadAsync(uri), 200, origin),
                "/chunk" when args.Request.Method == "POST" => Deliver(uri, args.Request.Content, origin),
                _ => Respond(null, 404, origin),
            };
        }
        catch (Exception error) when (error is BridgeException or IOException or ObjectDisposedException or FormatException or OverflowException)
        {
            args.Response = Respond(null, 500, origin);
        }
        finally
        {
            deferral.Complete();
        }
    }

    private Task<byte[]> ReadAsync(Uri uri) =>
        stream.ReadSharedAsync(long.Parse(Query(uri, "offset")), int.Parse(Query(uri, "length")));

    private CoreWebView2WebResourceResponse Deliver(Uri uri, Stream? content, string origin)
    {
        using var body = new MemoryStream();
        content?.CopyTo(body);
        stream.DeliverChunk(Query(uri, "requestId"), body.ToArray());
        return Respond(null, 204, origin);
    }

    private static string Query(Uri uri, string name) => uri.Query.TrimStart('?').Split('&')
        .Select(pair => pair.Split('=', 2))
        .Where(pair => pair.Length == 2 && pair[0] == name)
        .Select(pair => Uri.UnescapeDataString(pair[1]))
        .FirstOrDefault() ?? throw new FormatException($"Missing {name}.");

    private CoreWebView2WebResourceResponse Respond(byte[]? body, int status, string origin) => environment.CreateWebResourceResponse(
        body is null ? null : new MemoryStream(body),
        status,
        status < 400 ? "OK" : "Error",
        $"Access-Control-Allow-Origin: {origin}\nContent-Type: application/octet-stream");
}
