using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;

namespace Ruruka.Desktop.Streaming;

/// <summary>Supplies the bytes of the streamed file, at most <paramref name="length"/> from <paramref name="offset"/>.</summary>
internal delegate Task<byte[]> ChunkReader(long offset, int length, CancellationToken cancellation);

/// <summary>
/// The HTTP address a friend's mpv reads the stream from. It listens on this PC only, and the
/// random token keeps other local programs out. Bytes come from a <see cref="ChunkReader"/>.
/// </summary>
internal sealed class LoopbackStreamServer : IDisposable
{
    private const int MaxHeaderBytes = 8 * 1024;
    private const int ChunkBytes = 1024 * 1024;

    private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource _closing = new();
    private readonly ChunkReader _readChunk;
    private readonly long _fileSize;
    private readonly string _path;
    private readonly string _expectedHost;

    public LoopbackStreamServer(ChunkReader readChunk, long fileSize, string extension)
    {
        _readChunk = readChunk;
        _fileSize = fileSize;
        _path = $"/{Convert.ToHexString(RandomNumberGenerator.GetBytes(32))}/video{extension}";
        _listener.Start();
        _expectedHost = $"127.0.0.1:{((IPEndPoint)_listener.LocalEndpoint).Port}";
        Url = $"http://{_expectedHost}{_path}";
        _ = AcceptAsync();
    }

    public string Url { get; }

    public void Dispose()
    {
        _closing.Cancel();
        _listener.Stop();
    }

    private async Task AcceptAsync()
    {
        try
        {
            while (!_closing.IsCancellationRequested)
            {
                var client = await _listener.AcceptTcpClientAsync(_closing.Token);
                _ = ServeAsync(client);
            }
        }
        catch (Exception error) when (error is OperationCanceledException or SocketException or ObjectDisposedException)
        {
            Debug.WriteLine($"[stream] listener stopped: {error.Message}");
        }
    }

    // <-- mpv rouvre une connexion à chaque saut : une requête par connexion suffit -->
    private async Task ServeAsync(TcpClient client)
    {
        using (client)
        {
            try
            {
                var stream = client.GetStream();
                var request = await ReadRequestAsync(stream);
                if (request is not null) await RespondAsync(stream, request);
            }
            catch (Exception error) when (error is IOException or OperationCanceledException or TimeoutException or SocketException or ObjectDisposedException)
            {
                Debug.WriteLine($"[stream] request ended: {error.Message}");
            }
        }
    }

    private async Task<StreamRequest?> ReadRequestAsync(NetworkStream stream)
    {
        var received = new byte[MaxHeaderBytes];
        var size = 0;
        while (size < received.Length)
        {
            var read = await stream.ReadAsync(received.AsMemory(size), _closing.Token);
            if (read == 0) return null;
            size += read;
            var text = Encoding.ASCII.GetString(received, 0, size);
            if (text.Contains("\r\n\r\n", StringComparison.Ordinal)) return StreamRequest.Parse(text);
        }
        return null;
    }

    private async Task RespondAsync(NetworkStream stream, StreamRequest request)
    {
        var isAuthorized = request.Path == _path && request.Host == _expectedHost && request.Method is "GET" or "HEAD";
        if (!isAuthorized)
        {
            await WriteHeadAsync(stream, "404 Not Found", ["Content-Length: 0"]);
            return;
        }

        var range = new HttpByteRange(0, _fileSize - 1);
        var hasValidRange = request.Range is not null && HttpByteRange.TryParse(request.Range, _fileSize, out range);
        if (request.Range is not null && !hasValidRange)
        {
            await WriteHeadAsync(stream, "416 Range Not Satisfiable", [$"Content-Range: bytes */{_fileSize}", "Content-Length: 0"]);
            return;
        }

        var headers = new List<string>
        {
            "Accept-Ranges: bytes",
            "Content-Type: application/octet-stream",
            $"Content-Length: {range.Length.ToString(CultureInfo.InvariantCulture)}",
        };
        if (hasValidRange) headers.Add($"Content-Range: bytes {range.Start}-{range.End}/{_fileSize}");
        await WriteHeadAsync(stream, hasValidRange ? "206 Partial Content" : "200 OK", headers);
        if (request.Method == "GET") await CopyRangeAsync(stream, range);
    }

    // <-- Un seul morceau à la fois : si mpv cesse de lire, plus rien n'est demandé à l'hôte -->
    private async Task CopyRangeAsync(NetworkStream stream, HttpByteRange range)
    {
        var cursor = range.Start;
        while (cursor <= range.End)
        {
            var length = (int)Math.Min(ChunkBytes, range.End - cursor + 1);
            var chunk = await _readChunk(cursor, length, _closing.Token);
            if (chunk.Length == 0) return;
            await stream.WriteAsync(chunk, _closing.Token);
            cursor += chunk.Length;
        }
    }

    private async Task WriteHeadAsync(NetworkStream stream, string status, IEnumerable<string> headers)
    {
        var lines = headers.Prepend($"HTTP/1.1 {status}").Append("Connection: close");
        var head = string.Join("\r\n", lines) + "\r\n\r\n";
        await stream.WriteAsync(Encoding.ASCII.GetBytes(head), _closing.Token);
    }

    private sealed record StreamRequest(string Method, string Path, string? Host, string? Range)
    {
        public static StreamRequest? Parse(string text)
        {
            var lines = text.Split("\r\n");
            var requestLine = lines[0].Split(' ');
            if (requestLine.Length != 3) return null;
            return new StreamRequest(requestLine[0], requestLine[1], Header(lines, "Host"), Header(lines, "Range"));
        }

        private static string? Header(string[] lines, string name) => lines
            .Skip(1)
            .Where(line => line.StartsWith(name + ":", StringComparison.OrdinalIgnoreCase))
            .Select(line => line[(name.Length + 1)..].Trim())
            .FirstOrDefault();
    }
}
