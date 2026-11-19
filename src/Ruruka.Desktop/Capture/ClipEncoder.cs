using System.Diagnostics;
using System.Globalization;
using Ruruka.Desktop.Bridge;

namespace Ruruka.Desktop.Capture;

/// <summary>
/// Cuts a clip with mpv's own encoder, the program already shipped with the player: no ffmpeg to add.
/// The clip is read from the original file, so it keeps the episode's full quality.
/// </summary>
internal static class ClipEncoder
{
    internal const string QualityMax = "max";
    internal const string QualityDiscord = "discord";
    internal const string QualityPreview = "preview";
    internal const string FormatMp4 = "mp4";
    internal const string FormatWebm = "webm";
    internal const double MaxClipSeconds = 300;

    // <-- L'aperçu est petit et vite fait : il sert à vérifier les bornes, pas à garder le clip -->
    internal const double MaxPreviewSeconds = 60;
    private const int PreviewHeight = 360;

    private const string ProgressPrefix = "RURUKA ";
    private const int DefaultAudioBitsPerSecond = 128_000;
    private const int PreviewAudioBitsPerSecond = 64_000;
    private const int DiscordLimitBytes = 9_300_000;
    private const int MinimumVideoBitsPerSecond = 150_000;
    private const int DiscordMaxHeight = 720;

    /// <summary>The mpv arguments that produce the clip; separate from the process so the choices can be tested.</summary>
    internal static IReadOnlyList<string> BuildArguments(ClipSource source, ClipRequest request, string outputPath)
    {
        var duration = request.EndSeconds - request.StartSeconds;
        var arguments = new List<string>
        {
            "--no-config",
            "--load-scripts=no",
            "--idle=no",
            "--keep-open=no",
            $"--start={Format(request.StartSeconds)}",
            $"--end={Format(request.EndSeconds)}",
            "--hr-seek=yes",
            $"--o={outputPath}",
            $"--ovc={(IsWebm(request) ? "libvpx-vp9" : "libx264")}",
            $"--ovcopts={VideoOptions(request, duration)}",
            $"--oac={(IsWebm(request) ? "libopus" : "aac")}",
            $"--oacopts=b={AudioBitsPerSecond(request) / 1000}k",
            "--audio-channels=stereo",
            $"--vf={FilterChain(source, request)}",
            $"--term-status-msg={ProgressPrefix}${{=time-pos}}",
        };
        if (!IsWebm(request)) arguments.Add("--ofopts=movflags=+faststart");
        if (source.AudioTrackId is { } audio) arguments.Add($"--aid={audio}");
        arguments.AddRange(SubtitleArguments(source, request.WithSubtitles));
        arguments.Add("--");
        arguments.Add(source.FilePath);
        return arguments;
    }

    /// <summary>The crop in source pixels. Even numbers, because yuv420p can't hold an odd width or height.</summary>
    internal static (int X, int Y, int Width, int Height) CropInPixels(CropArea crop, int frameWidth, int frameHeight)
    {
        var width = Math.Max(EvenWithin(crop.Width * frameWidth, frameWidth), 2);
        var height = Math.Max(EvenWithin(crop.Height * frameHeight, frameHeight), 2);
        var x = EvenWithin(crop.X * frameWidth, frameWidth - width);
        var y = EvenWithin(crop.Y * frameHeight, frameHeight - height);
        return (x, y, width, height);
    }

    /// <summary>Runs the encoding, reporting how far it is (0 to 1); returns once the file is written.</summary>
    internal static async Task RunAsync(ClipSource source, ClipRequest request, string outputPath, Action<double> reportProgress, CancellationToken cancellation)
    {
        var startInfo = new ProcessStartInfo(source.MpvPath)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        foreach (var argument in BuildArguments(source, request, outputPath)) startInfo.ArgumentList.Add(argument);

        using var process = new Process { StartInfo = startInfo };
        var lastLines = new Queue<string>();
        process.Start();
        var errors = process.StandardError.ReadToEndAsync(CancellationToken.None);
        var length = request.EndSeconds - request.StartSeconds;

        try
        {
            while (await process.StandardOutput.ReadLineAsync(cancellation) is { } line)
            {
                if (TryReadPosition(line, out var position)) reportProgress(Math.Clamp((position - request.StartSeconds) / length, 0, 1));
                else if (line.Length > 0) Remember(lastLines, line);
            }
            await process.WaitForExitAsync(cancellation);
        }
        catch (OperationCanceledException)
        {
            process.Kill(entireProcessTree: true);
            DeletePartialFile(outputPath);
            throw;
        }

        var isWritten = File.Exists(outputPath) && new FileInfo(outputPath).Length > 0;
        if (process.ExitCode == 0 && isWritten) return;
        DeletePartialFile(outputPath);
        Debug.WriteLine($"[clip] mpv exited with {process.ExitCode}: {string.Join(" | ", lastLines)} {await errors}");
        throw new BridgeException("Le clip n'a pas pu être découpé : le lecteur a refusé cet extrait.");
    }

    private static bool IsWebm(ClipRequest request) => request.Format == FormatWebm && request.Quality != QualityPreview;

    private static int AudioBitsPerSecond(ClipRequest request) => request.Quality == QualityPreview ? PreviewAudioBitsPerSecond : DefaultAudioBitsPerSecond;

    private static string VideoOptions(ClipRequest request, double durationSeconds)
    {
        if (request.Quality == QualityPreview) return "crf=30,preset=ultrafast";
        var isWebm = IsWebm(request);
        // <-- VP9 : `cpu-used` et `row-mt` gardent l'encodage à une durée raisonnable sur un clip de quelques minutes -->
        var common = isWebm ? "deadline=good,cpu-used=3,row-mt=1" : "preset=slow,tune=animation";
        if (request.Quality != QualityDiscord) return isWebm ? $"crf=18,b=0,{common}" : $"crf=14,{common}";
        var totalBitsPerSecond = DiscordLimitBytes * 8 / Math.Max(durationSeconds, 1);
        var videoBitsPerSecond = (long)Math.Max(totalBitsPerSecond - DefaultAudioBitsPerSecond, MinimumVideoBitsPerSecond);
        return string.Create(CultureInfo.InvariantCulture, $"b={videoBitsPerSecond},maxrate={videoBitsPerSecond * 13 / 10},bufsize={videoBitsPerSecond * 2},{common}");
    }

    private static string FilterChain(ClipSource source, ClipRequest request)
    {
        var filters = new List<string>();
        var outputHeight = source.VideoHeight;
        if (request.Crop is { } crop && source.VideoWidth > 0 && source.VideoHeight > 0)
        {
            var (x, y, width, height) = CropInPixels(crop, source.VideoWidth, source.VideoHeight);
            filters.Add($"crop={width}:{height}:{x}:{y}");
            outputHeight = height;
        }
        var maxHeight = request.Quality switch
        {
            QualityDiscord => DiscordMaxHeight,
            QualityPreview => PreviewHeight,
            _ => int.MaxValue,
        };
        if (outputHeight > maxHeight) filters.Add($"scale=-2:{maxHeight}");
        filters.Add("format=yuv420p");
        return string.Join(',', filters);
    }

    // <-- Sans sous-titres, la piste est coupée ; un fichier externe est rechargé, puisque ce mpv-ci ne cherche rien tout seul -->
    private static IEnumerable<string> SubtitleArguments(ClipSource source, bool isShown)
    {
        yield return "--sub-auto=no";
        if (!isShown || source.SubtitleTrackId is not { } track)
        {
            yield return "--sid=no";
            yield break;
        }
        if (source.ExternalSubtitlePath is { } file) yield return $"--sub-file={file}";
        yield return $"--sid={track}";
        yield return $"--sub-delay={Format(source.SubtitleDelaySeconds)}";
    }

    private static int EvenWithin(double value, int limit)
    {
        var clamped = (int)Math.Clamp(Math.Round(value), 0, Math.Max(limit, 0));
        return clamped - clamped % 2;
    }

    private static bool TryReadPosition(string line, out double position)
    {
        position = 0;
        return line.StartsWith(ProgressPrefix, StringComparison.Ordinal)
            && double.TryParse(line.AsSpan(ProgressPrefix.Length), NumberStyles.Float, CultureInfo.InvariantCulture, out position);
    }

    private static void Remember(Queue<string> lastLines, string line)
    {
        if (lastLines.Count == 8) lastLines.Dequeue();
        lastLines.Enqueue(line);
    }

    private static void DeletePartialFile(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            Debug.WriteLine($"[clip] partial file kept: {error.Message}");
        }
    }

    private static string Format(double value) => value.ToString("0.###", CultureInfo.InvariantCulture);
}
