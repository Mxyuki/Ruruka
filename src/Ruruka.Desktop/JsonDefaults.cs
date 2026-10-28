using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ruruka.Desktop;

internal static class JsonDefaults
{
    public static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public static JsonSerializerOptions Indented { get; } = new(Options) { WriteIndented = true };

    /// <summary>Reads a JSON file, returning <paramref name="fallback"/> when it is missing or unreadable.</summary>
    public static T ReadFile<T>(string path, T fallback)
    {
        if (!File.Exists(path)) return fallback;
        try
        {
            return JsonSerializer.Deserialize<T>(File.ReadAllText(path), Options) ?? fallback;
        }
        catch (JsonException)
        {
            return fallback;
        }
    }

    /// <summary>Writes through a temp file so a crash mid-write never leaves a truncated file behind.</summary>
    public static void WriteFile<T>(string path, T value)
    {
        var temp = path + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(value, Indented));
        File.Move(temp, path, overwrite: true);
    }
}
