using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Ruruka.Desktop.Capture;

/// <summary>A named ffmpeg command for cutting clips: the output options only, Ruruka adds the input, range, tracks and crop.</summary>
/// <param name="Arguments">Options placed before the output file, with the tokens {videoKbps}, {maxrateKbps} and {bufsizeKbps}.</param>
/// <param name="Extension">"mp4", "webm" or "mkv": the container the output options are meant for.</param>
public sealed record ClipPreset(string Id, string Name, string Arguments, string Extension, bool IsBuiltIn = false);

internal static partial class ClipPresetCatalog
{
    internal const string MaxId = "max";
    internal const string DiscordId = "discord";

    private const int MaxNameLength = 40;
    private const int MaxArgumentsLength = 2000;
    private const int MaxBufferFactorPercent = 130;

    private static readonly string[] Extensions = ["mp4", "webm", "mkv"];

    // <-- Ruruka pose lui-même l'entrée, l'extrait, le fichier de sortie et le suivi : ces options les feraient entrer en conflit -->
    private static readonly string[] ReservedOptions = ["-i", "-y", "-n", "-ss", "-to", "-t", "-filter_complex", "-lavfi", "-progress", "-nostdin"];

    internal static readonly IReadOnlyList<ClipPreset> BuiltIn =
    [
        new(MaxId, "Qualité max",
            "-map_metadata -1 -map_chapters -1 -c:v libx264 -preset slow -tune animation -crf 14 -pix_fmt yuv420p -c:a aac -b:a 192k -ac 2 -movflags +faststart",
            "mp4", IsBuiltIn: true),
        new(DiscordId, "Léger pour Discord",
            "-map_metadata -1 -map_chapters -1 -vf scale=-2:'min(720,ih)' -c:v libx264 -preset slow -tune animation -b:v {videoKbps}k -maxrate {maxrateKbps}k -bufsize {bufsizeKbps}k -pix_fmt yuv420p -c:a aac -b:a 128k -ac 2 -movflags +faststart",
            "mp4", IsBuiltIn: true),
    ];

    /// <summary>The built-in presets first, then the user's.</summary>
    internal static IReadOnlyList<ClipPreset> All(IReadOnlyList<ClipPreset> custom) => [.. BuiltIn, .. custom];

    /// <summary>The chosen preset, or « Qualité max » when it was deleted.</summary>
    internal static ClipPreset Find(IReadOnlyList<ClipPreset> custom, string? id) =>
        All(custom).FirstOrDefault(preset => preset.Id == id) ?? BuiltIn[0];

    /// <summary>What is wrong with a preset the user wrote, in words they can act on; null when it is fine.</summary>
    internal static string? Problem(ClipPreset preset)
    {
        if (!PresetId().IsMatch(preset.Id) || preset.Id is MaxId or DiscordId) return "Identifiant de réglage invalide.";
        if (preset.Name.Trim().Length is 0 or > MaxNameLength) return $"Le nom d'un réglage fait de 1 à {MaxNameLength} caractères.";
        if (!Extensions.Contains(preset.Extension)) return "Le fichier d'un réglage est MP4, WebM ou MKV.";
        if (preset.Arguments.Length > MaxArgumentsLength) return "Cette commande est trop longue.";
        if (Tokenize(preset.Arguments) is not { } tokens) return "Un guillemet de la commande n'est pas refermé.";
        var reserved = tokens.FirstOrDefault(token => ReservedOptions.Contains(token, StringComparer.OrdinalIgnoreCase));
        return reserved is null ? null : $"« {reserved} » est posé par Ruruka (extrait, fichier, pistes) : retire-le de la commande.";
    }

    /// <summary>Splits a command like a shell would: spaces separate, double quotes group. Null when a quote stays open.</summary>
    internal static IReadOnlyList<string>? Tokenize(string text)
    {
        var tokens = new List<string>();
        var current = new StringBuilder();
        var isInQuote = false;
        var isStarted = false;
        foreach (var character in text)
        {
            if (character == '"')
            {
                isInQuote = !isInQuote;
                isStarted = true;
                continue;
            }
            if (char.IsWhiteSpace(character) && !isInQuote)
            {
                if (isStarted) tokens.Add(current.ToString());
                current.Clear();
                isStarted = false;
                continue;
            }
            current.Append(character);
            isStarted = true;
        }
        if (isInQuote) return null;
        if (isStarted) tokens.Add(current.ToString());
        return tokens;
    }

    /// <summary>The command's tokens with the bitrate placeholders filled for a clip of this length.</summary>
    internal static IReadOnlyList<string> Expand(string arguments, double lengthSeconds)
    {
        var videoKbps = ClipEncoder.DiscordVideoBitsPerSecond(lengthSeconds) / 1000;
        var filled = arguments
            .Replace("{videoKbps}", videoKbps.ToString(CultureInfo.InvariantCulture))
            .Replace("{maxrateKbps}", (videoKbps * MaxBufferFactorPercent / 100).ToString(CultureInfo.InvariantCulture))
            .Replace("{bufsizeKbps}", (videoKbps * 2).ToString(CultureInfo.InvariantCulture));
        return Tokenize(filled) ?? [];
    }

    [GeneratedRegex("^[a-z0-9-]{1,40}$")]
    private static partial Regex PresetId();
}
