namespace Ruruka.Desktop.Settings;

/// <summary>Site addresses typed by the user in Settings; no site ships with the app.</summary>
public static class SiteAddress
{
    /// <summary>"monsite.org/" becomes https://monsite.org; null when empty or not an http(s) address.</summary>
    public static Uri? Parse(string rawSite)
    {
        var site = rawSite.Trim().TrimEnd('/');
        if (site.Length == 0) return null;
        if (!site.Contains("://", StringComparison.Ordinal)) site = "https://" + site;
        return Uri.TryCreate(site, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https" ? uri : null;
    }

    /// <summary>The same site under a subdomain ("api" turns monsite.org into api.monsite.org), unless it is already there.</summary>
    public static Uri WithSubdomain(Uri site, string subdomain)
    {
        var prefix = subdomain + ".";
        if (site.Host.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return site;
        return new UriBuilder(site) { Host = prefix + site.Host, Path = "" }.Uri;
    }
}
