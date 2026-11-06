using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;
using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Streaming;

/// <summary>What friends need to know about the shared file. The path never leaves this PC.</summary>
public sealed record SharedFile(long FileSize, string Extension);

/// <summary>Payload of "stream.chunkNeeded": mpv reads these bytes, the UI asks the host for them.</summary>
public sealed record StreamChunkRequest(string RequestId, long Offset, int Length);

/// <summary>
/// Both ends of a stream. The host shares only the file its player opened, so a friend can
/// never name a path. A friend gets a local address for mpv, fed by the UI's WebRTC link.
/// </summary>
public sealed partial class StreamService(PlayerService player, IBridgeEvents events)
{
    public const int MaxChunkBytes = 1024 * 1024;

    private static readonly TimeSpan ChunkTimeout = TimeSpan.FromSeconds(30);

    private readonly ConcurrentDictionary<string, TaskCompletionSource<byte[]>> _pendingChunks = new();
    private readonly object _gate = new();
    private SafeFileHandle? _sharedFile;
    private LoopbackStreamServer? _server;

    /// <summary>Host side: shares the file playing right now, replacing the previous one.</summary>
    public SharedFile Share()
    {
        var path = player.CurrentFilePath
            ?? throw new BridgeException("Lance d'abord un épisode depuis tes dossiers pour le partager.");
        var file = File.OpenHandle(path, FileMode.Open, FileAccess.Read, FileShare.Read, FileOptions.Asynchronous | FileOptions.RandomAccess);
        var size = RandomAccess.GetLength(file);
        lock (_gate)
        {
            _sharedFile?.Dispose();
            _sharedFile = file;
        }
        return new SharedFile(size, Path.GetExtension(path).ToLowerInvariant());
    }

    public void StopSharing()
    {
        lock (_gate)
        {
            _sharedFile?.Dispose();
            _sharedFile = null;
        }
    }

    /// <summary>Host side: reads bytes of the shared file; empty past its end.</summary>
    public async Task<byte[]> ReadSharedAsync(long offset, int length)
    {
        if (offset < 0 || length is <= 0 or > MaxChunkBytes) throw new BridgeException("Morceau de fichier invalide.");
        SafeFileHandle file;
        lock (_gate)
        {
            file = _sharedFile ?? throw new BridgeException("Aucun fichier n'est partagé.");
        }
        var buffer = new byte[length];
        var total = 0;
        while (total < length)
        {
            var read = await RandomAccess.ReadAsync(file, buffer.AsMemory(total), offset + total);
            if (read == 0) break;
            total += read;
        }
        return buffer[..total];
    }

    /// <summary>Friend side: plays the host's file; the local address replaces the previous one.</summary>
    public async Task PlayAsync(int mediaId, int episode, string title, string? coverUrl, long fileSize, string extension)
    {
        var url = OpenViewer(fileSize, extension);
        try
        {
            await player.PlayStreamAsync(new PlaybackTarget(mediaId, episode, url, title, coverUrl));
        }
        catch (BridgeException)
        {
            CloseViewer();
            throw;
        }
    }

    private string OpenViewer(long fileSize, string extension)
    {
        if (fileSize <= 0) throw new BridgeException("Le fichier partagé est vide.");
        if (!SafeExtension().IsMatch(extension)) throw new BridgeException("Ce type de fichier n'est pas accepté.");
        CloseViewer();
        var server = new LoopbackStreamServer(RequestChunkAsync, fileSize, extension);
        lock (_gate)
        {
            _server = server;
        }
        return server.Url;
    }

    public void CloseViewer()
    {
        lock (_gate)
        {
            _server?.Dispose();
            _server = null;
        }
        foreach (var requestId in _pendingChunks.Keys)
        {
            if (_pendingChunks.TryRemove(requestId, out var pending)) pending.TrySetCanceled();
        }
    }

    /// <summary>Friend side: delivers the bytes of a "stream.chunkNeeded" request.</summary>
    public void DeliverChunk(string requestId, byte[] bytes)
    {
        if (_pendingChunks.TryRemove(requestId, out var pending)) pending.TrySetResult(bytes);
    }

    private async Task<byte[]> RequestChunkAsync(long offset, int length, CancellationToken cancellation)
    {
        var requestId = Guid.NewGuid().ToString("N");
        var pending = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pendingChunks[requestId] = pending;
        try
        {
            events.Emit("stream.chunkNeeded", new StreamChunkRequest(requestId, offset, length));
            var chunk = await pending.Task.WaitAsync(ChunkTimeout, cancellation);
            if (chunk.Length > length) throw new IOException("The host sent more bytes than requested.");
            return chunk;
        }
        finally
        {
            _pendingChunks.TryRemove(requestId, out _);
        }
    }

    // <-- L'extension vient d'un ami et finit dans une adresse : rien d'autre que des lettres et des chiffres -->
    [GeneratedRegex(@"^\.[a-z0-9]{1,8}$")]
    private static partial Regex SafeExtension();
}
