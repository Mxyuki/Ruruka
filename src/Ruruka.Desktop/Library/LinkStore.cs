namespace Ruruka.Desktop.Library;

public enum LinkKind
{
    Auto,
    Manual,
    Unmatched,
}

/// <summary>
/// How a library folder maps to an AniList entry. <see cref="EpisodeOffset"/> is subtracted from
/// file episode numbers, for releases that number a second season 13, 14, …
/// </summary>
public sealed record FolderLink(int? MediaId, LinkKind Kind, int EpisodeOffset = 0);

/// <summary>Persists folder links keyed by folder name, so moving the whole library keeps them.</summary>
public sealed class LinkStore
{
    private readonly string _path;
    private readonly object _gate = new();
    private readonly Dictionary<string, FolderLink> _links;

    public LinkStore(string path)
    {
        _path = path;
        var saved = JsonDefaults.ReadFile(path, new Dictionary<string, FolderLink>());
        _links = new Dictionary<string, FolderLink>(saved, StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyDictionary<string, FolderLink> GetAll()
    {
        lock (_gate) return new Dictionary<string, FolderLink>(_links);
    }

    public void Set(string folderName, FolderLink link) => Mutate(links => links[folderName] = link);

    public void Remove(string folderName) => Mutate(links => links.Remove(folderName));

    private void Mutate(Action<Dictionary<string, FolderLink>> change)
    {
        lock (_gate)
        {
            change(_links);
            JsonDefaults.WriteFile(_path, _links);
        }
    }
}
