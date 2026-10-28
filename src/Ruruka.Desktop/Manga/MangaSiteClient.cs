using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Settings;
using Ruruka.Desktop.Updates;

namespace Ruruka.Desktop.Manga;

/// <summary>
/// Read-only gateway to the API of the manga site chosen in Settings. That API refuses browser
/// requests from other sites (no CORS), so the UI asks the host; chapter images load directly in the page.
/// </summary>
internal sealed partial class MangaSiteClient(SettingsStore settings)
{
    // The API allows about 5 requests per second per client; a short gap keeps every burst under it.
    private static readonly TimeSpan MinRequestGap = TimeSpan.FromMilliseconds(250);

    private static readonly HttpClient Http = CreateClient();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly Stopwatch _sinceLastRequest = new();

    /// <summary>Only the searches and lookups the reader needs: manga search, a manga's chapter feed, chapter pages.</summary>
    [GeneratedRegex(@"^/(manga(/[0-9a-f-]{36}(/feed)?)?|at-home/server/[0-9a-f-]{36})(\?[^#\s]*)?$")]
    private static partial Regex AllowedPath();

    internal static bool IsAllowedPath(string path) => AllowedPath().IsMatch(path);

    public async Task<JsonElement> GetAsync(string path)
    {
        if (!IsAllowedPath(path)) throw new BridgeException("Requête vers le site de lecture non autorisée.");
        var apiBase = ApiBaseFor(settings.Current.MangaSiteUrl)
            ?? throw new BridgeException("Indique un site de lecture des manga dans les réglages.");
        await _gate.WaitAsync();
        try
        {
            var wait = MinRequestGap - _sinceLastRequest.Elapsed;
            if (_sinceLastRequest.IsRunning && wait > TimeSpan.Zero) await Task.Delay(wait);
            _sinceLastRequest.Restart();
            using var response = await Http.GetAsync(apiBase + path);
            if (response.StatusCode == HttpStatusCode.TooManyRequests) throw new BridgeException("Le site de lecture demande de ralentir, réessaie dans un instant.");
            if (!response.IsSuccessStatusCode) throw new BridgeException($"Le site de lecture a refusé la demande ({(int)response.StatusCode}).");
            await using var body = await response.Content.ReadAsStreamAsync();
            using var document = await JsonDocument.ParseAsync(body);
            return document.RootElement.Clone();
        }
        catch (HttpRequestException)
        {
            throw new BridgeException("Le site de lecture ne répond pas.");
        }
        catch (TaskCanceledException)
        {
            throw new BridgeException("Le site de lecture met trop de temps à répondre.");
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>The API lives on the "api" subdomain of the manga site; null when no valid site is set.</summary>
    internal static string? ApiBaseFor(string mangaSite) =>
        SiteAddress.Parse(mangaSite) is { } site ? SiteAddress.WithSubdomain(site, "api").GetLeftPart(UriPartial.Authority) : null;

    // The API asks its clients to identify themselves with a User-Agent.
    private static HttpClient CreateClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Ruruka", UpdateService.CurrentVersion.ToString(3)));
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return client;
    }
}
