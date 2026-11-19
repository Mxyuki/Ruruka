using System.Diagnostics;
using System.Security.Cryptography;
using Ruruka.Desktop.Bridge;

namespace Ruruka.Desktop.Capture;

/// <summary>
/// The optional ffmpeg of the clip workshop: a pinned, hash-checked Windows build downloaded on request into
/// %LOCALAPPDATA%/Ruruka/ffmpeg. ffmpeg stays a separate program (GPL), with its licence next to it.
/// </summary>
internal sealed class FfmpegService
{
    private const string Release = "2026-11-19-git-01ca75d350";
    private const string ArchiveName = $"ffmpeg-{Release}-essentials_build.7z";
    private const string ArchiveUrl = $"https://github.com/GyanD/codexffmpeg/releases/download/{Release}/{ArchiveName}";
    private const string ArchiveSha256 = "e66ef760a0dfe4f9306aef15eb7a81bba2d87caa5e021d17e62e0797952d11c0";
    private const string ExecutableName = "ffmpeg.exe";
    private const string LicenseName = "LICENSE";
    private const int BufferSize = 81920;

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(15) };

    private readonly SemaphoreSlim _installGate = new(1, 1);
    private CancellationTokenSource? _installCancellation;

    private static string Folder => Path.Combine(AppPaths.LocalData, "ffmpeg");

    private static string WorkFolder => Path.Combine(AppPaths.LocalData, "ffmpeg-download");

    /// <summary>The installer drops this file when the person ticked the ffmpeg option; the UI then runs the download.</summary>
    private static string InstallRequestFile => Path.Combine(AppPaths.LocalData, "install-ffmpeg.flag");

    internal static string ExecutablePath => Path.Combine(Folder, ExecutableName);

    internal static bool IsInstalled => File.Exists(ExecutablePath);

    internal bool IsInstalling => _installGate.CurrentCount == 0;

    /// <summary>True once when the installer asked for ffmpeg; the request is forgotten as it is read.</summary>
    internal static bool TakeInstallRequest()
    {
        if (!File.Exists(InstallRequestFile)) return false;
        DeleteFile(InstallRequestFile);
        return true;
    }

    /// <summary>Downloads, checks and unpacks ffmpeg, reporting how far the download is (0 to 1).</summary>
    internal async Task InstallAsync(Action<double> reportProgress)
    {
        if (!await _installGate.WaitAsync(0)) throw new BridgeException("ffmpeg est déjà en cours de téléchargement.");
        using var cancellation = _installCancellation = new CancellationTokenSource();
        try
        {
            await DownloadAndUnpackAsync(reportProgress, cancellation.Token);
        }
        catch (OperationCanceledException)
        {
            throw new BridgeException("Le téléchargement de ffmpeg a été annulé.");
        }
        catch (Exception error) when (error is HttpRequestException or IOException or UnauthorizedAccessException)
        {
            Debug.WriteLine($"[ffmpeg] {error}");
            throw new BridgeException("ffmpeg n'a pas pu être téléchargé : vérifie ta connexion et l'espace disque.");
        }
        finally
        {
            DeleteFolder(WorkFolder);
            _installCancellation = null;
            _installGate.Release();
        }
    }

    internal void CancelInstall() => _installCancellation?.Cancel();

    /// <summary>Deletes the downloaded ffmpeg to free its disk space.</summary>
    internal static void Remove() => DeleteFolder(Folder);

    private static async Task DownloadAndUnpackAsync(Action<double> reportProgress, CancellationToken cancellation)
    {
        DeleteFolder(WorkFolder);
        Directory.CreateDirectory(WorkFolder);
        var archive = Path.Combine(WorkFolder, ArchiveName);

        // <-- Téléchargement avec progression -->
        using (var response = await Http.GetAsync(ArchiveUrl, HttpCompletionOption.ResponseHeadersRead, cancellation))
        {
            response.EnsureSuccessStatusCode();
            var total = response.Content.Headers.ContentLength ?? 0;
            await using var source = await response.Content.ReadAsStreamAsync(cancellation);
            await using var file = File.Create(archive);
            var buffer = new byte[BufferSize];
            long received = 0;
            int read;
            while ((read = await source.ReadAsync(buffer, cancellation)) > 0)
            {
                await file.WriteAsync(buffer.AsMemory(0, read), cancellation);
                received += read;
                if (total > 0) reportProgress(Math.Clamp((double)received / total, 0, 1));
            }
        }

        // <-- L'empreinte est vérifiée avant toute extraction : seul ce fichier-là est accepté -->
        await using (var downloaded = File.OpenRead(archive))
        {
            var hash = Convert.ToHexString(await SHA256.HashDataAsync(downloaded, cancellation));
            if (!hash.Equals(ArchiveSha256, StringComparison.OrdinalIgnoreCase))
            {
                throw new BridgeException("Le fichier ffmpeg téléchargé n'est pas celui attendu : il a été refusé.");
            }
        }

        // <-- Le tar de Windows 11 lit le 7z, donc aucun outil en plus -->
        var unpacked = Path.Combine(WorkFolder, "unpacked");
        Directory.CreateDirectory(unpacked);
        await ExtractAsync(archive, unpacked, cancellation);

        var executable = Directory.EnumerateFiles(unpacked, ExecutableName, SearchOption.AllDirectories).FirstOrDefault()
            ?? throw new BridgeException("ffmpeg est introuvable dans l'archive téléchargée.");
        var license = Directory.EnumerateFiles(unpacked, LicenseName, SearchOption.AllDirectories).FirstOrDefault();

        DeleteFolder(Folder);
        Directory.CreateDirectory(Folder);
        File.Move(executable, ExecutablePath);
        if (license is not null) File.Move(license, Path.Combine(Folder, LicenseName));
        reportProgress(1);
    }

    private static async Task ExtractAsync(string archive, string destination, CancellationToken cancellation)
    {
        var startInfo = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "tar.exe"))
        {
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var argument in new[] { "-xf", archive, "-C", destination }) startInfo.ArgumentList.Add(argument);
        using var process = Process.Start(startInfo) ?? throw new BridgeException("Windows n'a pas pu ouvrir l'archive de ffmpeg.");
        await process.WaitForExitAsync(cancellation);
        if (process.ExitCode != 0) throw new BridgeException("Windows n'a pas pu ouvrir l'archive de ffmpeg.");
    }

    private static void DeleteFolder(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            Debug.WriteLine($"[ffmpeg] folder kept: {error.Message}");
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
            Debug.WriteLine($"[ffmpeg] file kept: {error.Message}");
        }
    }
}
