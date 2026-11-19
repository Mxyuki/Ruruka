namespace Ruruka.Desktop.Capture;

/// <summary>A rectangle as fractions (0 to 1) of the frame, so the UI needn't know the video's real size.</summary>
public sealed record CropArea(double X, double Y, double Width, double Height);

/// <summary>What the capture workshop is offered when the person presses the capture button.</summary>
public sealed record CaptureOffer(int MediaId, int Episode, string Title, double PositionSeconds, double DurationSeconds, bool HasSubtitles, bool CanClip);

/// <param name="Quality">"max" keeps the best quality; "discord" fits the clip under 10 MB.</param>
/// <param name="Format">"mp4" (H.264, plays everywhere) or "webm" (VP9, light and fine for the web).</param>
/// <param name="PresetId">With the ffmpeg engine, the preset that encodes the clip; then quality and format are ignored.</param>
public sealed record ClipRequest(double StartSeconds, double EndSeconds, CropArea? Crop, bool WithSubtitles, string Quality, string FileName, string Format = ClipEncoder.FormatMp4, string? PresetId = null);

/// <summary>The range, crop and subtitles the preview should show.</summary>
public sealed record ClipPreviewRequest(double StartSeconds, double EndSeconds, CropArea? Crop, bool WithSubtitles);

public sealed record ClipSaved(string Path, string Folder);

/// <summary>What the encoder needs from the player that was open when the capture was asked.</summary>
/// <param name="SubtitleTrackId">The id the selected subtitles will have in the encoding mpv; null when none are selected.</param>
/// <param name="ExternalSubtitlePath">Set when the selected subtitles are a separate file, which the encoding mpv must load itself.</param>
internal sealed record ClipSource(
    string MpvPath,
    string FilePath,
    int VideoWidth,
    int VideoHeight,
    int? AudioTrackId,
    int? SubtitleTrackId,
    string? ExternalSubtitlePath,
    double SubtitleDelaySeconds);
