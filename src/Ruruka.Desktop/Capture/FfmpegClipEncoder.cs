using System.Diagnostics;
using System.Globalization;
using System.Text;
using Ruruka.Desktop.Bridge;

namespace Ruruka.Desktop.Capture;

/// <summary>
/// Cuts a clip with the user's ffmpeg command (a <see cref="ClipPreset"/>). Ruruka adds the input, the range, the
/// tracks, the subtitles and the crop; the preset only says how the result is encoded.
/// </summary>
internal static class FfmpegClipEncoder
{
    private const string ProgressKey = "out_time_us=";
    private const double MicrosecondsPerSecond = 1_000_000;
    private const int RememberedErrorLines = 4;

    /// <summary>The ffmpeg arguments that produce the clip; separate from the process so the choices can be tested.</summary>
    internal static IReadOnlyList<string> BuildArguments(ClipSource source, ClipRequest request, ClipPreset preset, string outputPath)
    {
        var length = request.EndSeconds - request.StartSeconds;
        var (options, presetFilters) = SplitFilters(ClipPresetCatalog.Expand(preset.Arguments, length));

        var arguments = new List<string>
        {
            "-hide_banner", "-nostdin", "-loglevel", "error", "-progress", "pipe:1", "-nostats", "-y",
            "-ss", ClipEncoder.Format(request.StartSeconds),
            "-i", source.FilePath,
            "-t", ClipEncoder.Format(length),
            "-map", "0:v:0",
        };
        if (source.AudioTrackId is { } audio)
        {
            arguments.Add("-map");
            arguments.Add($"0:a:{audio - 1}");
        }

        var filters = FilterChain(source, request);
        filters.AddRange(presetFilters);
        if (filters.Count > 0)
        {
            arguments.Add("-vf");
            arguments.Add(string.Join(',', filters));
        }
        arguments.AddRange(options);
        arguments.Add(outputPath);
        return arguments;
    }

    /// <summary>Runs the encoding, reporting how far it is (0 to 1); returns once the file is written.</summary>
    internal static async Task RunAsync(string ffmpegPath, ClipSource source, ClipRequest request, ClipPreset preset, string outputPath, Action<double> reportProgress, CancellationToken cancellation)
    {
        var startInfo = new ProcessStartInfo(ffmpegPath)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        foreach (var argument in BuildArguments(source, request, preset, outputPath)) startInfo.ArgumentList.Add(argument);

        using var process = new Process { StartInfo = startInfo };
        process.Start();
        var errors = ReadLastLinesAsync(process.StandardError);
        var length = request.EndSeconds - request.StartSeconds;

        try
        {
            while (await process.StandardOutput.ReadLineAsync(cancellation) is { } line)
            {
                if (TryReadSeconds(line, out var seconds)) reportProgress(Math.Clamp(seconds / length, 0, 1));
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
        var reason = await errors;
        Debug.WriteLine($"[clip] ffmpeg exited with {process.ExitCode}: {reason}");
        throw new BridgeException($"ffmpeg a refusé ce réglage : {(reason.Length > 0 ? reason : "aucune explication")}");
    }

    /// <summary>The ffmpeg filter that burns the subtitle track of the player into the picture, the way it was on screen.</summary>
    internal static string SubtitleFilter(ClipSource source, double startSeconds)
    {
        var file = source.ExternalSubtitlePath ?? source.FilePath;
        var track = source.ExternalSubtitlePath is null ? $":si={(source.SubtitleTrackId ?? 1) - 1}" : "";
        // <-- Avec -ss avant l'entrée, les images repartent de 0 : le filtre doit retrouver le temps du fichier, décalage de l'utilisateur compris -->
        var shift = ClipEncoder.Format(startSeconds - source.SubtitleDelaySeconds);
        return $"setpts=PTS+({shift})/TB,subtitles=filename={EscapeFilterValue(file)}{track},setpts=PTS-({shift})/TB";
    }

    /// <summary>A path as an ffmpeg filter option value: slashes, and the characters the two parsing levels read, escaped.</summary>
    internal static string EscapeFilterValue(string path)
    {
        var escaped = new StringBuilder();
        foreach (var character in path.Replace('\\', '/'))
        {
            switch (character)
            {
                case ':':
                    escaped.Append(@"\\:");
                    break;
                case '\'':
                    escaped.Append(@"\\\'");
                    break;
                case ',' or ';' or '[' or ']':
                    escaped.Append('\\').Append(character);
                    break;
                default:
                    escaped.Append(character);
                    break;
            }
        }
        return escaped.ToString();
    }

    // <-- Les sous-titres d'abord, sur l'image entière comme à l'écran ; le cadrage vient ensuite -->
    private static List<string> FilterChain(ClipSource source, ClipRequest request)
    {
        var filters = new List<string>();
        if (request.WithSubtitles && source.SubtitleTrackId is not null) filters.Add(SubtitleFilter(source, request.StartSeconds));
        if (request.Crop is { } crop && source.VideoWidth > 0 && source.VideoHeight > 0)
        {
            var (x, y, width, height) = ClipEncoder.CropInPixels(crop, source.VideoWidth, source.VideoHeight);
            filters.Add($"crop={width}:{height}:{x}:{y}");
        }
        return filters;
    }

    // <-- Un -vf écrit par l'utilisateur est fusionné dans la chaîne de Ruruka : sinon il remplacerait le cadrage et les sous-titres -->
    private static (List<string> Options, List<string> Filters) SplitFilters(IReadOnlyList<string> tokens)
    {
        var options = new List<string>();
        var filters = new List<string>();
        for (var index = 0; index < tokens.Count; index++)
        {
            var isFilterOption = tokens[index] is "-vf" or "-filter:v";
            if (isFilterOption && index + 1 < tokens.Count)
            {
                filters.Add(tokens[++index]);
                continue;
            }
            options.Add(tokens[index]);
        }
        return (options, filters);
    }

    private static bool TryReadSeconds(string line, out double seconds)
    {
        seconds = 0;
        if (!line.StartsWith(ProgressKey, StringComparison.Ordinal)) return false;
        if (!double.TryParse(line.AsSpan(ProgressKey.Length), NumberStyles.Float, CultureInfo.InvariantCulture, out var microseconds)) return false;
        seconds = microseconds / MicrosecondsPerSecond;
        return true;
    }

    private static async Task<string> ReadLastLinesAsync(StreamReader errors)
    {
        var lastLines = new Queue<string>();
        while (await errors.ReadLineAsync(CancellationToken.None) is { } line)
        {
            if (line.Length == 0) continue;
            if (lastLines.Count == RememberedErrorLines) lastLines.Dequeue();
            lastLines.Enqueue(line);
        }
        return string.Join(" | ", lastLines);
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
}
