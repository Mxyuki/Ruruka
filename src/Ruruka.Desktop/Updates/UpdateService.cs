using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json.Serialization;
using Ruruka.Desktop.Bridge;

namespace Ruruka.Desktop.Updates;

public sealed record UpdateInfo(string Version, string CurrentVersion, string NotesUrl);

/// <summary>Finds a newer Ruruka release on GitHub and downloads its installer.</summary>
internal sealed class UpdateService
{
    private const string LatestReleaseUrl = "https://api.github.com/repos/Mxyuki/Ruruka/releases/latest";
    private const string InstallerPrefix = "Ruruka-Setup-";

    public static Version CurrentVersion { get; } = Assembly.GetExecutingAssembly().GetName().Version ?? new Version(0, 0, 0);

    // <-- Après CurrentVersion : les champs statiques s'initialisent dans l'ordre du fichier et le User-Agent en a besoin -->
    private static readonly HttpClient Http = CreateClient();

    private GitHubAsset? _installer;

    /// <summary>Returns the latest release when it is newer than this build and ships an installer, otherwise null.</summary>
    public async Task<UpdateInfo?> CheckAsync()
    {
        var release = await Fetch(() => Http.GetFromJsonAsync<GitHubRelease>(LatestReleaseUrl, JsonDefaults.Options));
        if (release is null || !TryParseTag(release.TagName, out var latest) || !IsNewer(latest, CurrentVersion)) return null;

        _installer = release.Assets.FirstOrDefault(IsInstaller);
        if (_installer is null) return null;
        return new UpdateInfo(Format(latest), Format(CurrentVersion), release.HtmlUrl);
    }

    /// <summary>Downloads the installer found by the last check into the temp folder and returns its path.</summary>
    public async Task<string> DownloadInstallerAsync()
    {
        var installer = _installer ?? throw new BridgeException("Aucune mise à jour à installer.");
        var path = Path.Combine(Path.GetTempPath(), installer.Name);
        await Fetch(async () =>
        {
            await using var download = await Http.GetStreamAsync(installer.BrowserDownloadUrl);
            await using var file = File.Create(path);
            await download.CopyToAsync(file);
            return true;
        });
        return path;
    }

    internal static bool TryParseTag(string tag, out Version version) =>
        Version.TryParse(tag.TrimStart('v', 'V'), out version!);

    internal static bool IsNewer(Version latest, Version current) => Normalize(latest) > Normalize(current);

    // <-- Seul un installateur hébergé sur GitHub est accepté, jamais un lien arbitraire -->
    private static bool IsInstaller(GitHubAsset asset) =>
        asset.Name.StartsWith(InstallerPrefix, StringComparison.OrdinalIgnoreCase)
        && asset.Name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)
        && Uri.TryCreate(asset.BrowserDownloadUrl, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && uri.Host.Equals("github.com", StringComparison.OrdinalIgnoreCase);

    // <-- La version de l'assembly a quatre parties (0.1.0.0), le tag GitHub trois (0.1.0) -->
    private static Version Normalize(Version version) =>
        new(version.Major, version.Minor, Math.Max(version.Build, 0), Math.Max(version.Revision, 0));

    private static string Format(Version version) => Normalize(version).ToString(3);

    private static async Task<T> Fetch<T>(Func<Task<T>> request)
    {
        try
        {
            return await request();
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            throw new BridgeException("GitHub est injoignable, impossible de vérifier les mises à jour.");
        }
    }

    // <-- L'API GitHub refuse les requêtes sans User-Agent -->
    private static HttpClient CreateClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Ruruka", Format(CurrentVersion)));
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        return client;
    }

    private sealed record GitHubRelease(
        [property: JsonPropertyName("tag_name")] string TagName,
        [property: JsonPropertyName("html_url")] string HtmlUrl,
        GitHubAsset[] Assets);

    private sealed record GitHubAsset(
        string Name,
        [property: JsonPropertyName("browser_download_url")] string BrowserDownloadUrl);
}
