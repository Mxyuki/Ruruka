using System.Web;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Ruruka.Desktop.Auth;

/// <summary>
/// Shows AniList's login page and captures the token from the implicit-grant redirect.
/// The API client must use <see cref="RedirectUri"/>. That page also shows the token
/// for manual copying if capture ever fails.
/// </summary>
internal sealed class AniListAuthForm : Form
{
    public const string RedirectUri = "https://anilist.co/api/v2/oauth/pin";

    private readonly WebView2 _webView = new() { Dock = DockStyle.Fill };
    private readonly TaskCompletionSource<string?> _token = new();
    private readonly CoreWebView2Environment _environment;
    private readonly string _clientId;

    private AniListAuthForm(CoreWebView2Environment environment, string clientId, Icon? icon)
    {
        _environment = environment;
        _clientId = clientId;
        Text = "Connexion à AniList";
        Icon = icon;
        ClientSize = new Size(520, 720);
        StartPosition = FormStartPosition.CenterParent;
        Controls.Add(_webView);
    }

    /// <summary>Resolves with the access token, or null if the window was closed first.</summary>
    public static Task<string?> RequestTokenAsync(Form owner, CoreWebView2Environment environment, string clientId)
    {
        var form = new AniListAuthForm(environment, clientId, owner.Icon);
        form.FormClosed += (_, _) => form._token.TrySetResult(null);
        form.Show(owner);
        return form._token.Task;
    }

    protected override async void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        await _webView.EnsureCoreWebView2Async(_environment);
        _webView.CoreWebView2.NavigationStarting += (_, args) => TryCapture(args.Uri);
        _webView.CoreWebView2.SourceChanged += (_, _) => TryCapture(_webView.Source.ToString());
        _webView.CoreWebView2.Navigate(
            $"https://anilist.co/api/v2/oauth/authorize?client_id={Uri.EscapeDataString(_clientId)}&response_type=token");
    }

    private void TryCapture(string uri)
    {
        if (!uri.StartsWith(RedirectUri, StringComparison.OrdinalIgnoreCase)) return;
        var fragment = new Uri(uri).Fragment.TrimStart('#');
        var token = HttpUtility.ParseQueryString(fragment)["access_token"];
        if (string.IsNullOrEmpty(token)) return;

        _token.TrySetResult(token);
        BeginInvoke(Close);
    }
}
