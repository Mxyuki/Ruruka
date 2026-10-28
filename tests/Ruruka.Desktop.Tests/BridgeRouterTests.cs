using System.Text.Json;
using Ruruka.Desktop.Bridge;

namespace Ruruka.Desktop.Tests;

public sealed class BridgeRouterTests
{
    [Fact]
    public async Task DispatchAsync_TurnsUnexpectedErrorsIntoResponses()
    {
        var router = new BridgeRouter();
        router.Register<int>("library.scan", () => throw new FormatException("bad digit"));

        var response = await router.DispatchAsync("""{"id":7,"method":"library.scan","params":null}""");

        using var json = JsonDocument.Parse(response);
        Assert.Equal(7, json.RootElement.GetProperty("id").GetInt32());
        Assert.Contains("bad digit", json.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public async Task DispatchAsync_KeepsBridgeExceptionMessages()
    {
        var router = new BridgeRouter();
        router.Register<int>("player.play", () => throw new BridgeException("mpv introuvable"));

        var response = await router.DispatchAsync("""{"id":1,"method":"player.play","params":null}""");

        using var json = JsonDocument.Parse(response);
        Assert.Equal("mpv introuvable", json.RootElement.GetProperty("error").GetString());
    }
}
