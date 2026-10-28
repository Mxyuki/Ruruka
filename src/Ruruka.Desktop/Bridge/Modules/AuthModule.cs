using Microsoft.Web.WebView2.Core;
using Ruruka.Desktop.Auth;
using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed class AuthModule(SettingsStore settings, Form owner, Func<CoreWebView2Environment> environment) : IBridgeModule
{
    public void Register(BridgeRouter router)
    {
        router.Register("auth.login", LoginAsync);
        router.Register<TokenParams, bool>("auth.setToken", parameters => SetToken(parameters.Token));
        router.Register("auth.getToken", () => Task.FromResult(settings.ReadToken()));
        router.Register("auth.logout", () =>
        {
            settings.SaveToken(null);
            return Task.FromResult(true);
        });
    }

    private async Task<bool> LoginAsync()
    {
        var clientId = settings.Current.AniListClientId;
        if (string.IsNullOrWhiteSpace(clientId)) throw new BridgeException("Indique d'abord l'ID de ton client AniList.");

        var token = await AniListAuthForm.RequestTokenAsync(owner, environment(), clientId);
        if (token is null) return false;
        settings.SaveToken(token);
        return true;
    }

    private Task<bool> SetToken(string token)
    {
        var trimmed = token.Trim();
        if (trimmed.Length < 20) throw new BridgeException("Ça ne ressemble pas à un jeton AniList.");
        settings.SaveToken(trimmed);
        return Task.FromResult(true);
    }

    private sealed record TokenParams(string Token);
}
