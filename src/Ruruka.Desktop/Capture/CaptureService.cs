using System.Diagnostics;
using System.Text.Json;
using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Capture;

/// <summary>
/// The capture workshop's host side. When the player's capture button is pressed it takes the frame at full
/// resolution (with and without subtitles) and tells the UI; a clip is cut afterwards from the original file.
/// </summary>
internal sealed class CaptureService(PlayerService player, IBridgeEvents events, Action showWindow)
{
    private const string PlainFrameName = "frame.png";
    private const string SubtitledFrameName = "frame-subtitles.png";
    private const string PreviewName = "preview.mp4";

    private static string FolderPath => Path.Combine(AppPaths.LocalData, "captures");

    private ClipSource? _clipSource;
    private CancellationTokenSource? _clipCancellation;
    private CancellationTokenSource? _previewCancellation;

    public void Attach() => player.CaptureRequested += session => _ = Task.Run(() => OfferAsync(session));

    /// <summary>The frame as PNG, in base64; null once the workshop's files were cleared.</summary>
    public async Task<string?> ReadFrameAsync(bool withSubtitles)
    {
        var path = Path.Combine(FolderPath, withSubtitles ? SubtitledFrameName : PlainFrameName);
        return File.Exists(path) ? Convert.ToBase64String(await File.ReadAllBytesAsync(path)) : null;
    }

    /// <summary>Cuts the clip into <paramref name="outputPath"/>; the UI follows it with "capture.clipProgress".</summary>
    public async Task<ClipSaved?> SaveClipAsync(ClipRequest request, Func<string, string?> askPath)
    {
        var source = _clipSource ?? throw new BridgeException("Ce clip n'est plus disponible : relance la capture depuis le lecteur.");
        var length = request.EndSeconds - request.StartSeconds;
        if (request.StartSeconds < 0 || length <= 0) throw new BridgeException("L'extrait est vide : la fin doit venir après le début.");
        if (length > ClipEncoder.MaxClipSeconds) throw new BridgeException("Un clip dure 5 minutes au plus.");
        if (request.Format is not (ClipEncoder.FormatMp4 or ClipEncoder.FormatWebm)) throw new BridgeException("Format de clip inconnu : choisis MP4 ou WebM.");
        if (askPath(request.FileName) is not { } outputPath) return null;

        _clipCancellation?.Cancel();
        using var cancellation = _clipCancellation = new CancellationTokenSource();
        try
        {
            await ClipEncoder.RunAsync(source, request, outputPath, ratio => events.Emit("capture.clipProgress", new { ratio }), cancellation.Token);
            return new ClipSaved(outputPath, Path.GetDirectoryName(outputPath) ?? outputPath);
        }
        catch (OperationCanceledException)
        {
            return null;
        }
    }

    public void CancelClip() => _clipCancellation?.Cancel();

    /// <summary>
    /// A small MP4 of the range (its first minute at most) with the chosen crop and subtitles, as base64; null when a newer
    /// preview replaced this one. It is read back from the same file the clip would come from, so it shows exactly the cut.
    /// </summary>
    public async Task<string?> PreviewClipAsync(ClipPreviewRequest preview)
    {
        var source = _clipSource ?? throw new BridgeException("Ce clip n'est plus disponible : relance la capture depuis le lecteur.");
        var end = Math.Min(preview.EndSeconds, preview.StartSeconds + ClipEncoder.MaxPreviewSeconds);
        if (preview.StartSeconds < 0 || end <= preview.StartSeconds) throw new BridgeException("L'extrait est vide : la fin doit venir après le début.");

        _previewCancellation?.Cancel();
        using var cancellation = _previewCancellation = new CancellationTokenSource();
        Directory.CreateDirectory(FolderPath);
        var path = Path.Combine(FolderPath, PreviewName);
        var request = new ClipRequest(preview.StartSeconds, end, preview.Crop, preview.WithSubtitles, ClipEncoder.QualityPreview, "preview");
        try
        {
            await ClipEncoder.RunAsync(source, request, path, _ => { }, cancellation.Token);
            return Convert.ToBase64String(await File.ReadAllBytesAsync(path, cancellation.Token));
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        finally
        {
            DeleteFile(path);
        }
    }

    /// <summary>Removes the frames and forgets the player, once the workshop closes.</summary>
    public void Discard()
    {
        _previewCancellation?.Cancel();
        _clipSource = null;
        DeleteFrames();
    }

    private async Task OfferAsync(MpvSession session)
    {
        try
        {
            var offer = await TakeFramesAsync(session);
            if (offer is null) return;
            events.Emit("capture.ready", offer);
            showWindow();
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or BridgeException)
        {
            Debug.WriteLine($"[capture] {error.Message}");
            events.Emit("capture.failed", new { message = error is BridgeException ? error.Message : "Impossible d'enregistrer l'image : le dossier temporaire est inaccessible." });
        }
    }

    private async Task<CaptureOffer?> TakeFramesAsync(MpvSession session)
    {
        var position = await NumberAsync(session, "time-pos");
        if (position is null) return null;
        var duration = await NumberAsync(session, "duration") ?? 0;
        var tracks = await session.GetPropertyAsync("track-list");
        var subtitle = SelectedTrack(tracks, "sub");
        var isSubtitleVisible = await session.GetPropertyAsync("sub-visibility") is not { ValueKind: JsonValueKind.False };
        var hasSubtitles = subtitle is not null && isSubtitleVisible;

        DeleteFrames();
        Directory.CreateDirectory(FolderPath);
        if (!await session.RunAsync("screenshot-to-file", Path.Combine(FolderPath, PlainFrameName), "video"))
        {
            throw new BridgeException("Le lecteur n'a pas pu prendre l'image.");
        }
        if (hasSubtitles && !await session.RunAsync("screenshot-to-file", Path.Combine(FolderPath, SubtitledFrameName), "subtitles"))
        {
            throw new BridgeException("Le lecteur n'a pas pu prendre l'image avec les sous-titres.");
        }

        var filePath = player.CurrentFilePath;
        var canClip = filePath is not null && File.Exists(filePath);
        _clipSource = canClip ? await DescribeSourceAsync(session, filePath!, tracks, subtitle) : null;

        var target = session.Target;
        return new CaptureOffer(target.MediaId, target.Episode, target.Title, position.Value, duration, hasSubtitles, canClip);
    }

    private static async Task<ClipSource> DescribeSourceAsync(MpvSession session, string filePath, JsonElement? tracks, JsonElement? subtitle)
    {
        var audio = SelectedTrack(tracks, "audio");
        var isExternal = subtitle is { } track && track.TryGetProperty("external", out var external) && external.ValueKind == JsonValueKind.True;
        var externalPath = isExternal && subtitle!.Value.TryGetProperty("external-filename", out var name) ? name.GetString() : null;

        // <-- Les pistes intégrées gardent leur numéro ; un fichier externe prend la place juste après elles dans le mpv de l'encodage -->
        int? subtitleId = null;
        if (subtitle is { } selected && selected.TryGetProperty("id", out var id))
        {
            subtitleId = isExternal ? CountEmbedded(tracks, "sub") + 1 : id.GetInt32();
        }

        return new ClipSource(
            session.Launch.ExecutablePath,
            filePath,
            (int)(await NumberAsync(session, "width") ?? 0),
            (int)(await NumberAsync(session, "height") ?? 0),
            audio is { } audioTrack && audioTrack.TryGetProperty("id", out var audioId) ? audioId.GetInt32() : null,
            subtitleId,
            externalPath,
            await NumberAsync(session, "sub-delay") ?? 0);
    }

    private static async Task<double?> NumberAsync(MpvSession session, string property) =>
        await session.GetPropertyAsync(property) is { ValueKind: JsonValueKind.Number } value ? value.GetDouble() : null;

    private static JsonElement? SelectedTrack(JsonElement? tracks, string type)
    {
        if (tracks is not { ValueKind: JsonValueKind.Array } list) return null;
        foreach (var track in list.EnumerateArray())
        {
            var isType = track.TryGetProperty("type", out var trackType) && trackType.GetString() == type;
            var isSelected = track.TryGetProperty("selected", out var selected) && selected.ValueKind == JsonValueKind.True;
            if (isType && isSelected) return track;
        }
        return null;
    }

    private static int CountEmbedded(JsonElement? tracks, string type)
    {
        if (tracks is not { ValueKind: JsonValueKind.Array } list) return 0;
        return list.EnumerateArray().Count(track =>
            track.TryGetProperty("type", out var trackType) && trackType.GetString() == type
            && !(track.TryGetProperty("external", out var external) && external.ValueKind == JsonValueKind.True));
    }

    private static void DeleteFrames()
    {
        foreach (var name in new[] { PlainFrameName, SubtitledFrameName, PreviewName }) DeleteFile(Path.Combine(FolderPath, name));
    }

    private static void DeleteFile(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            Debug.WriteLine($"[capture] file kept: {error.Message}");
        }
    }
}
