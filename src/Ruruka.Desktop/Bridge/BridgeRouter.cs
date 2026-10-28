using System.Text.Json;

namespace Ruruka.Desktop.Bridge;

/// <summary>A failure whose message is safe and meaningful to show in the UI.</summary>
public sealed class BridgeException(string message) : Exception(message);

public interface IBridgeModule
{
    void Register(BridgeRouter router);
}

/// <summary>Maps <c>area.verb</c> method names to handlers and turns requests into responses.</summary>
public sealed class BridgeRouter
{
    private readonly Dictionary<string, Func<JsonElement, Task<object?>>> _handlers = new(StringComparer.Ordinal);

    public void Register<TResult>(string method, Func<Task<TResult>> handler) =>
        Add(method, async _ => await handler());

    public void Register<TParams, TResult>(string method, Func<TParams, Task<TResult>> handler) =>
        Add(method, async raw =>
        {
            var parameters = raw.Deserialize<TParams>(JsonDefaults.Options)
                ?? throw new BridgeException($"Paramètres manquants pour {method}.");
            return await handler(parameters);
        });

    public async Task<string> DispatchAsync(string requestJson)
    {
        BridgeRequest? request;
        try
        {
            request = JsonSerializer.Deserialize<BridgeRequest>(requestJson, JsonDefaults.Options);
        }
        catch (JsonException)
        {
            request = null;
        }
        if (request is null) return Serialize(new BridgeResponse(0, null, "Malformed bridge request."));

        if (!_handlers.TryGetValue(request.Method, out var handler))
        {
            return Serialize(new BridgeResponse(request.Id, null, $"Unknown bridge method \"{request.Method}\"."));
        }

        try
        {
            var result = await handler(request.Params);
            return Serialize(new BridgeResponse(request.Id, result, null));
        }
        catch (BridgeException error)
        {
            return Serialize(new BridgeResponse(request.Id, null, error.Message));
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException)
        {
            return Serialize(new BridgeResponse(request.Id, null, error.Message));
        }
        // An unexpected bug in one handler must reach the UI as an error, not take the whole app down.
        catch (Exception error)
        {
            return Serialize(new BridgeResponse(request.Id, null, $"Erreur inattendue ({request.Method}) : {error.Message}"));
        }
    }

    private void Add(string method, Func<JsonElement, Task<object?>> handler)
    {
        if (!_handlers.TryAdd(method, handler))
        {
            throw new InvalidOperationException($"Bridge method \"{method}\" is registered twice.");
        }
    }

    private static string Serialize(BridgeResponse response) => JsonSerializer.Serialize(response, JsonDefaults.Options);

    private sealed record BridgeRequest(int Id, string Method, JsonElement Params);

    private sealed record BridgeResponse(int Id, object? Result, string? Error);
}
