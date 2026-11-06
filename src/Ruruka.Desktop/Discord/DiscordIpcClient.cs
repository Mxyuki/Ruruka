using System.Diagnostics;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ruruka.Desktop.Discord;

/// <summary>Discord's local RPC: frames of a little-endian opcode, a length and JSON, over a named pipe.</summary>
internal sealed class DiscordIpcClient : IAsyncDisposable
{
    private const int HandshakeOpcode = 0;
    private const int FrameOpcode = 1;
    private const int CloseOpcode = 2;
    private const int PingOpcode = 3;
    private const int PongOpcode = 4;

    private const string JoinEvent = "ACTIVITY_JOIN";

    private const int HeaderLength = 8;
    private const int MaxFrameLength = 1024 * 1024;

    // Discord takes the first free pipe of 0 to 9, one per running client.
    private const int PipeCount = 10;
    private const string DiscordPipePrefix = "discord-ipc-";
    private const int PipeConnectTimeoutMs = 100;
    private static readonly TimeSpan HandshakeTimeout = TimeSpan.FromSeconds(5);

    private static readonly JsonSerializerOptions PayloadOptions = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    private readonly NamedPipeClientStream _pipe;
    private readonly SemaphoreSlim _writeGate = new(1, 1);
    private readonly Action<string> _onJoin;
    private volatile bool _isOpen = true;

    private DiscordIpcClient(NamedPipeClientStream pipe, Action<string> onJoin)
    {
        _pipe = pipe;
        _onJoin = onJoin;
    }

    public bool IsOpen => _isOpen;

    /// <summary>The Discord app on this PC, or null when it isn't running.</summary>
    /// <param name="onJoin">Receives the join secret of an invitation accepted on this PC, on the reading thread.</param>
    public static async Task<DiscordIpcClient?> ConnectAsync(string applicationId, Action<string> onJoin, string pipePrefix = DiscordPipePrefix)
    {
        for (var pipeNumber = 0; pipeNumber < PipeCount; pipeNumber++)
        {
            var pipe = new NamedPipeClientStream(".", $"{pipePrefix}{pipeNumber}", PipeDirection.InOut, PipeOptions.Asynchronous);
            var client = new DiscordIpcClient(pipe, onJoin);
            try
            {
                await pipe.ConnectAsync(PipeConnectTimeoutMs);
                using var timeout = new CancellationTokenSource(HandshakeTimeout);
                if (await client.TryHandshakeAsync(applicationId, timeout.Token))
                {
                    _ = client.ReadUntilClosedAsync();
                    await client.TrySendAsync(FrameOpcode, new { cmd = "SUBSCRIBE", evt = JoinEvent, args = new { }, nonce = Guid.NewGuid() });
                    return client;
                }
            }
            catch (Exception error) when (error is TimeoutException or IOException or UnauthorizedAccessException or OperationCanceledException or InvalidDataException)
            {
                Debug.WriteLine($"[discord] pipe {pipeNumber}: {error.Message}");
            }
            await client.DisposeAsync();
        }
        return null;
    }

    public Task<bool> TrySetActivityAsync(DiscordActivity activity) =>
        TrySendAsync(FrameOpcode, new { cmd = "SET_ACTIVITY", args = new { pid = Environment.ProcessId, activity = activity.ToPayload() }, nonce = Guid.NewGuid() });

    /// <summary>Discord removes the activity when the app sends none.</summary>
    public Task<bool> TryClearActivityAsync() =>
        TrySendAsync(FrameOpcode, new { cmd = "SET_ACTIVITY", args = new { pid = Environment.ProcessId }, nonce = Guid.NewGuid() });

    /// <summary>Discord removes the activity by itself when the pipe closes.</summary>
    public async ValueTask DisposeAsync()
    {
        _isOpen = false;
        await _pipe.DisposeAsync();
    }

    internal static byte[] EncodeFrame(int opcode, string json)
    {
        var body = Encoding.UTF8.GetBytes(json);
        var frame = new byte[HeaderLength + body.Length];
        BitConverter.TryWriteBytes(frame.AsSpan(0, 4), opcode);
        BitConverter.TryWriteBytes(frame.AsSpan(4, 4), body.Length);
        body.CopyTo(frame, HeaderLength);
        return frame;
    }

    private async Task<bool> TryHandshakeAsync(string applicationId, CancellationToken cancellation)
    {
        if (!await TrySendAsync(HandshakeOpcode, new { v = 1, client_id = applicationId })) return false;
        var (opcode, _) = await ReadFrameAsync(cancellation);
        return opcode == FrameOpcode;
    }

    // <-- Les réponses sont lues même si on les ignore : sinon le tube se remplit et Discord cesse d'écouter -->
    private async Task ReadUntilClosedAsync()
    {
        try
        {
            while (_isOpen)
            {
                var (opcode, json) = await ReadFrameAsync(CancellationToken.None);
                if (opcode == CloseOpcode) break;
                if (opcode == PingOpcode) await SendRawAsync(EncodeFrame(PongOpcode, json));
                if (opcode == FrameOpcode) HandleFrame(json);
            }
        }
        catch (Exception error) when (error is IOException or ObjectDisposedException or InvalidDataException or OperationCanceledException or JsonException or KeyNotFoundException or InvalidOperationException)
        {
            Debug.WriteLine($"[discord] connection lost: {error.Message}");
        }
        finally
        {
            _isOpen = false;
        }
    }

    private void HandleFrame(string json)
    {
        using var message = JsonDocument.Parse(json);
        var root = message.RootElement;
        if (!root.TryGetProperty("evt", out var eventName) || eventName.ValueKind != JsonValueKind.String) return;
        if (eventName.GetString() == "ERROR") Debug.WriteLine($"[discord] refused: {json}");
        if (eventName.GetString() != JoinEvent) return;
        if (root.GetProperty("data").GetProperty("secret").GetString() is { } secret) _onJoin(secret);
    }

    private async Task<(int Opcode, string Json)> ReadFrameAsync(CancellationToken cancellation)
    {
        var header = new byte[HeaderLength];
        await _pipe.ReadExactlyAsync(header, cancellation);
        var length = BitConverter.ToInt32(header, 4);
        if (length is < 0 or > MaxFrameLength) throw new InvalidDataException("Trame Discord invalide.");
        var body = new byte[length];
        await _pipe.ReadExactlyAsync(body, cancellation);
        return (BitConverter.ToInt32(header, 0), Encoding.UTF8.GetString(body));
    }

    private async Task<bool> TrySendAsync(int opcode, object message)
    {
        try
        {
            await SendRawAsync(EncodeFrame(opcode, JsonSerializer.Serialize(message, PayloadOptions)));
            return true;
        }
        catch (Exception error) when (error is IOException or ObjectDisposedException)
        {
            Debug.WriteLine($"[discord] not sent: {error.Message}");
            _isOpen = false;
            return false;
        }
    }

    private async Task SendRawAsync(byte[] frame)
    {
        await _writeGate.WaitAsync();
        try
        {
            await _pipe.WriteAsync(frame);
            await _pipe.FlushAsync();
        }
        finally
        {
            _writeGate.Release();
        }
    }
}
