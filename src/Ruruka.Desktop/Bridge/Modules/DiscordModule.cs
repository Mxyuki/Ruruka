using System.Text.RegularExpressions;
using Ruruka.Desktop.Discord;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed partial class DiscordModule(DiscordPresence presence) : IBridgeModule
{
    private const int MaxMemberCount = 999;
    private const int MaxNameLength = 100;

    public void Register(BridgeRouter router)
    {
        router.Register<SessionParams, bool>("discord.setSession", parameters =>
        {
            if (parameters.CompanionNames.Count > MaxMemberCount || parameters.CompanionNames.Any(name => name.Length is 0 or > MaxNameLength))
            {
                throw new BridgeException("Liste de détectives invalide.");
            }
            presence.SetSession(ToInvite(parameters), parameters.CompanionNames);
            return Task.FromResult(true);
        });
        router.Register("discord.takeJoinCode", () => Task.FromResult(presence.TakeJoinCode()));
        router.Register<AcceptParams, bool>("discord.acceptJoin", async parameters =>
        {
            if (!UserId().IsMatch(parameters.UserId)) throw new BridgeException("Compte Discord invalide.");
            if (!await presence.TryAcceptJoinAsync(parameters.UserId)) throw new BridgeException("Discord ne répond pas.");
            return true;
        });
    }

    private static SessionInvite? ToInvite(SessionParams parameters)
    {
        if (parameters.Code is null) return null;
        if (!WatchCode().IsMatch(parameters.Code)) throw new BridgeException("Code de séance invalide.");
        if (parameters.MemberCount is < 1 or > MaxMemberCount) throw new BridgeException("Nombre de détectives invalide.");
        return new SessionInvite(parameters.Code, parameters.MemberCount);
    }

    [GeneratedRegex("^[2-9A-Z]{5}-[2-9A-Z]{5}$")]
    private static partial Regex WatchCode();

    [GeneratedRegex(@"^\d{1,20}$")]
    private static partial Regex UserId();

    private sealed record SessionParams(string? Code, int MemberCount, IReadOnlyList<string> CompanionNames);

    private sealed record AcceptParams(string UserId);
}
