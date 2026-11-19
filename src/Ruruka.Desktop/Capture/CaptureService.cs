using System.Diagnostics;
using System.Text.Json;
using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Player;
using Ruruka.Desktop.Settings;

namespace Ruruka.Desktop.Capture;

/// <summary>
/// The capture workshop's host side. When the player's capture button is pressed it takes the frame at full
/// resolution (with and without subtitles) and tells the UI; a clip is cut afterwards from the original file.
/// </summary>
internal sealed class CaptureService(PlayerService player, SettingsStore settings, IBridgeEvents events, Action showWindow)
{
    private const string PlainFrameName = "frame.png";
    private const string SubtitledFrameName = "frame-subtitles.png";
    private const string PreviewName = "preview.mp4";
    private const string ScrubFolderName = "scrub";

    private static string FolderPath => Path.Combine(AppPaths.LocalData, "captures");

    private ClipSource? _clipSource;
    private CancellationTokenSource? _clipCancellation;
    private CancellationTokenSource? _previewCancellation;
    private CancellationTokenSource? _scrubCancellation;

    public void Attach() => player.CaptureRequested += session => _ = Task.Run(() => OfferAsync(session));

    /// <summary>The frame as PNG, in base64; null once the workshop's files were cleared.</summary>
    public async Task<string?> ReadFrameAsync(bool withSubtitles)
    {
        var path = Path.Combine(FolderPath, withSubtitles ? SubtitledFrameName : PlainFrameName);
        return File.Exists(path) ? Convert.ToBase64String(await File.ReadAllBytesAsync(path)) : null;
    }

    /// <summary>
    /// Cuts the clip where <paramref name="askPath"/> says (it gets the suggested name and the file extension); the UI
    /// follows it with "capture.clipProgress". It uses ffmpeg with the chosen preset when that engine is on, else mpv.
    /// </summary>
    public async Task<ClipSaved?> SaveClipAsync(ClipRequest request, Func<string, string, string?> askPath)
    {
        var source = _clipSource ?? throw new BridgeException("Ce clip n'est plus disponible : relance la capture depuis le lecteur.");
        var length = request.EndSeconds - request.StartSeconds;
        if (request.StartSeconds < 0 || length <= 0) throw new BridgeException("L'extrait est vide : la fin doit venir après le début.");
        if (length > ClipEncoder.MaxClipSeconds) throw new BridgeException("Un clip dure 5 minutes au plus.");
        var preset = IsFfmpegEngine ? ClipPresetCatalog.Find(settings.Current.ClipPresets, request.PresetId) : null;
        if (preset is null && request.Format is not (ClipEncoder.FormatMp4 or ClipEncoder.FormatWebm)) throw new BridgeException("Format de clip inconnu : choisis MP4 ou WebM.");
        if (askPath(request.FileName, preset?.Extension ?? request.Format) is not { } outputPath) return null;

        Cancel(_clipCancellation);
        using var cancellation = _clipCancellation = new CancellationTokenSource();
        try
        {
            void ReportProgress(double ratio) => events.Emit("capture.clipProgress", new { ratio });
            if (preset is null) await ClipEncoder.RunAsync(source, request, outputPath, ReportProgress, cancellation.Token);
            else await FfmpegClipEncoder.RunAsync(FfmpegService.ExecutablePath, source, request, preset, outputPath, ReportProgress, cancellation.Token);
            return new ClipSaved(outputPath, Path.GetDirectoryName(outputPath) ?? outputPath);
        }
        catch (OperationCanceledException)
        {
            return null;
        }
    }

    private bool IsFfmpegEngine => settings.Current.ClipEngine == "ffmpeg" && FfmpegService.IsInstalled;

    public void CancelClip() => Cancel(_clipCancellation);

    /// <summary>
    /// A small MP4 of the range (its first minute at most) with the chosen crop and subtitles, as base64; null when a newer
    /// preview replaced this one. It is read back from the same file the clip would come from, so it shows exactly the cut.
    /// </summary>
    public async Task<string?> PreviewClipAsync(ClipPreviewRequest preview)
    {
        var source = _clipSource ?? throw new BridgeException("Ce clip n'est plus disponible : relance la capture depuis le lecteur.");
        var end = Math.Min(preview.EndSeconds, preview.StartSeconds + ClipEncoder.MaxPreviewSeconds);
        if (preview.StartSeconds < 0 || end <= preview.StartSeconds) throw new BridgeException("L'extrait est vide : la fin doit venir après le début.");

        Cancel(_previewCancellation);
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

    /// <summary>
    /// The picture at <paramref name="seconds"/> as JPEG in base64, to choose a clip's bounds by sight; null when a newer
    /// request replaced this one. The subtitles are drawn when asked, like in the clip.
    /// </summary>
    public async Task<string?> ReadFrameAtAsync(double seconds, bool withSubtitles)
    {
        var source = _clipSource ?? throw new BridgeException("Ce clip n'est plus disponible : relance la capture depuis le lecteur.");
        if (seconds < 0) throw new BridgeException("Ce moment est avant le début de l'épisode.");

        Cancel(_scrubCancellation);
        using var cancellation = _scrubCancellation = new CancellationTokenSource();
        var folder = Path.Combine(FolderPath, ScrubFolderName);
        try
        {
            var path = await FrameGrabber.RenderAsync(source, seconds, withSubtitles, folder, cancellation.Token);
            return Convert.ToBase64String(await File.ReadAllBytesAsync(path, cancellation.Token));
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        finally
        {
            DeleteFolder(folder);
        }
    }

    /// <summary>Removes the frames and forgets the player, once the workshop closes.</summary>
    public void Discard()
    {
        Cancel(_previewCancellation);
        Cancel(_scrubCancellation);
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

    // <-- Une demande finie a déjà libéré sa source : l'annuler après coup n'est pas une erreur -->
    private static void Cancel(CancellationTokenSource? source)
    {
        try
        {
            source?.Cancel();
        }
        catch (ObjectDisposedException)
        {
            Debug.WriteLine("[capture] request already finished");
        }
    }

    private static void DeleteFolder(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            Debug.WriteLine($"[capture] folder kept: {error.Message}");
        }
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
