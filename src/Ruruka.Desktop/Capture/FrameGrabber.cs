using System.Diagnostics;
using Ruruka.Desktop.Bridge;

namespace Ruruka.Desktop.Capture;

/// <summary>One picture of the episode at a chosen second, from a one-frame mpv run: it needs no ffmpeg.</summary>
internal static class FrameGrabber
{
    private const int JpegQuality = 85;

    /// <summary>The mpv arguments that write one JPEG into <paramref name="outputFolder"/>.</summary>
    internal static IReadOnlyList<string> BuildArguments(ClipSource source, double seconds, bool withSubtitles, string outputFolder)
    {
        var arguments = new List<string>
        {
            "--no-config",
            "--load-scripts=no",
            "--idle=no",
            "--keep-open=no",
            "--ao=null",
            "--aid=no",
            $"--start={ClipEncoder.Format(seconds)}",
            "--hr-seek=yes",
            "--frames=1",
            "--vo=image",
            "--vo-image-format=jpg",
            $"--vo-image-jpeg-quality={JpegQuality}",
            $"--vo-image-outdir={outputFolder}",
        };
        arguments.AddRange(ClipEncoder.SubtitleArguments(source, withSubtitles));
        arguments.Add("--");
        arguments.Add(source.FilePath);
        return arguments;
    }

    /// <summary>Writes the picture and returns its path.</summary>
    internal static async Task<string> RenderAsync(ClipSource source, double seconds, bool withSubtitles, string outputFolder, CancellationToken cancellation)
    {
        Directory.CreateDirectory(outputFolder);
        var startInfo = new ProcessStartInfo(source.MpvPath)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        foreach (var argument in BuildArguments(source, seconds, withSubtitles, outputFolder)) startInfo.ArgumentList.Add(argument);

        using var process = new Process { StartInfo = startInfo };
        process.Start();
        // <-- Les sorties sont lues jusqu'au bout, sinon mpv se bloque quand leur tampon est plein -->
        _ = process.StandardOutput.ReadToEndAsync(CancellationToken.None);
        _ = process.StandardError.ReadToEndAsync(CancellationToken.None);
        try
        {
            await process.WaitForExitAsync(cancellation);
        }
        catch (OperationCanceledException)
        {
            process.Kill(entireProcessTree: true);
            throw;
        }

        var picture = Directory.EnumerateFiles(outputFolder, "*.jpg").FirstOrDefault();
        if (process.ExitCode == 0 && picture is not null) return picture;
        Debug.WriteLine($"[capture] frame at {seconds}s: mpv exited with {process.ExitCode}");
        throw new BridgeException("L'image de ce moment n'a pas pu être lue.");
    }
}
