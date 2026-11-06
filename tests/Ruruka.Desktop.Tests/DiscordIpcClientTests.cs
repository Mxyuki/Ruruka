using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using Ruruka.Desktop.Discord;

namespace Ruruka.Desktop.Tests;

public class DiscordIpcClientTests
{
    private const int HandshakeOpcode = 0;
    private const int FrameOpcode = 1;
    private const int CloseOpcode = 2;
    private const int PingOpcode = 3;
    private const int PongOpcode = 4;

    private static readonly TimeSpan TestTimeout = TimeSpan.FromSeconds(5);

    private static string UniquePrefix() => $"ruruka-test-{Guid.NewGuid():N}-";

    private static NamedPipeServerStream FakeDiscord(string prefix) =>
        new($"{prefix}0", PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);

    private static async Task<(int Opcode, string Json)> ReadFrameAsync(Stream pipe)
    {
        var header = new byte[8];
        await pipe.ReadExactlyAsync(header);
        var body = new byte[BitConverter.ToInt32(header, 4)];
        await pipe.ReadExactlyAsync(body);
        return (BitConverter.ToInt32(header, 0), Encoding.UTF8.GetString(body));
    }

    private static async Task WriteFrameAsync(Stream pipe, int opcode, string json)
    {
        await pipe.WriteAsync(DiscordIpcClient.EncodeFrame(opcode, json));
        await pipe.FlushAsync();
    }

    private static async Task AcceptHandshakeAsync(NamedPipeServerStream server)
    {
        await server.WaitForConnectionAsync();
        await ReadFrameAsync(server);
        await WriteFrameAsync(server, FrameOpcode, "{\"cmd\":\"DISPATCH\",\"evt\":\"READY\"}");
        await ReadFrameAsync(server);
        await ReadFrameAsync(server);
    }

    [Fact]
    public async Task HandshakeNamesTheApplicationThenSendsTheActivity()
    {
        var prefix = UniquePrefix();
        await using var server = FakeDiscord(prefix);
        var connection = server.WaitForConnectionAsync();

        var connecting = DiscordIpcClient.ConnectAsync("42", _ => { }, _ => { }, prefix);
        await connection.WaitAsync(TestTimeout);
        var (handshakeOpcode, handshake) = await ReadFrameAsync(server).WaitAsync(TestTimeout);
        await WriteFrameAsync(server, FrameOpcode, "{\"cmd\":\"DISPATCH\",\"evt\":\"READY\"}");
        var (_, subscription) = await ReadFrameAsync(server).WaitAsync(TestTimeout);
        var (_, requestSubscription) = await ReadFrameAsync(server).WaitAsync(TestTimeout);
        await using var client = await connecting.WaitAsync(TestTimeout);

        Assert.Equal(HandshakeOpcode, handshakeOpcode);
        Assert.Equal("42", JsonDocument.Parse(handshake).RootElement.GetProperty("client_id").GetString());
        Assert.Equal("ACTIVITY_JOIN", JsonDocument.Parse(subscription).RootElement.GetProperty("evt").GetString());
        Assert.Equal("ACTIVITY_JOIN_REQUEST", JsonDocument.Parse(requestSubscription).RootElement.GetProperty("evt").GetString());
        Assert.NotNull(client);

        var watching = new NowWatching(123, 5, "Precure", null, 60, 1440, false);
        var reading = ReadFrameAsync(server);
        Assert.True(await client.TrySetActivityAsync(DiscordActivity.From(watching, DateTimeOffset.UtcNow)).WaitAsync(TestTimeout));
        var (opcode, json) = await reading.WaitAsync(TestTimeout);
        var message = JsonDocument.Parse(json).RootElement;

        Assert.Equal(FrameOpcode, opcode);
        Assert.Equal("SET_ACTIVITY", message.GetProperty("cmd").GetString());
        Assert.Equal(3, message.GetProperty("args").GetProperty("activity").GetProperty("type").GetInt32());
        Assert.False(message.GetProperty("args").GetProperty("activity").GetProperty("assets").TryGetProperty("small_image", out _));
    }

    [Fact]
    public async Task AcceptedInvitationGivesItsSecret()
    {
        var prefix = UniquePrefix();
        var secret = new TaskCompletionSource<string>();
        await using var server = FakeDiscord(prefix);
        var discord = AcceptHandshakeAsync(server);
        await using var client = await DiscordIpcClient.ConnectAsync("42", code => secret.TrySetResult(code), _ => { }, prefix).WaitAsync(TestTimeout);
        await discord.WaitAsync(TestTimeout);

        await WriteFrameAsync(server, FrameOpcode, "{\"cmd\":\"DISPATCH\",\"evt\":\"ACTIVITY_JOIN\",\"data\":{\"secret\":\"7KX3P-QM9TZ\"}}");

        Assert.Equal("7KX3P-QM9TZ", await secret.Task.WaitAsync(TestTimeout));
    }

    [Theory]
    [InlineData("{\"id\":\"99\",\"username\":\"ruruka\",\"global_name\":\"Ruruka\"}", "Ruruka")]
    [InlineData("{\"id\":\"99\",\"username\":\"ruruka\",\"global_name\":null}", "ruruka")]
    [InlineData("{\"id\":\"99\",\"username\":\"ruruka\"}", "ruruka")]
    public async Task JoinRequestNamesThePersonThenAcceptingSendsTheirId(string user, string expectedName)
    {
        var prefix = UniquePrefix();
        var asked = new TaskCompletionSource<JoinAsked>();
        await using var server = FakeDiscord(prefix);
        var discord = AcceptHandshakeAsync(server);
        await using var client = await DiscordIpcClient.ConnectAsync("42", _ => { }, request => asked.TrySetResult(request), prefix).WaitAsync(TestTimeout);
        await discord.WaitAsync(TestTimeout);

        await WriteFrameAsync(server, FrameOpcode, $"{{\"cmd\":\"DISPATCH\",\"evt\":\"ACTIVITY_JOIN_REQUEST\",\"data\":{{\"user\":{user}}}}}");
        var request = await asked.Task.WaitAsync(TestTimeout);

        Assert.Equal(new JoinAsked("99", expectedName), request);

        var reading = ReadFrameAsync(server);
        Assert.True(await client!.TryAcceptJoinAsync(request.UserId).WaitAsync(TestTimeout));
        var message = JsonDocument.Parse((await reading.WaitAsync(TestTimeout)).Json).RootElement;

        Assert.Equal("SEND_ACTIVITY_JOIN_INVITE", message.GetProperty("cmd").GetString());
        Assert.Equal("99", message.GetProperty("args").GetProperty("user_id").GetString());
    }

    [Fact]
    public async Task PingIsAnsweredWithThePongOfTheSameData()
    {
        var prefix = UniquePrefix();
        await using var server = FakeDiscord(prefix);
        var discord = AcceptHandshakeAsync(server);
        await using var client = await DiscordIpcClient.ConnectAsync("42", _ => { }, _ => { }, prefix).WaitAsync(TestTimeout);
        await discord.WaitAsync(TestTimeout);

        await WriteFrameAsync(server, PingOpcode, "{\"n\":1}");
        var (opcode, json) = await ReadFrameAsync(server).WaitAsync(TestTimeout);

        Assert.Equal(PongOpcode, opcode);
        Assert.Equal("{\"n\":1}", json);
    }

    [Fact]
    public async Task DiscordClosingThePipeMarksTheClientClosed()
    {
        var prefix = UniquePrefix();
        await using var server = FakeDiscord(prefix);
        var discord = AcceptHandshakeAsync(server);
        await using var client = await DiscordIpcClient.ConnectAsync("42", _ => { }, _ => { }, prefix).WaitAsync(TestTimeout);
        await discord.WaitAsync(TestTimeout);

        await WriteFrameAsync(server, CloseOpcode, "{}");
        for (var attempt = 0; client!.IsOpen && attempt < 50; attempt++) await Task.Delay(20);

        Assert.False(client!.IsOpen);
    }

    [Fact]
    public async Task NoDiscordGivesNoClient()
    {
        Assert.Null(await DiscordIpcClient.ConnectAsync("42", _ => { }, _ => { }, UniquePrefix()));
    }
}
