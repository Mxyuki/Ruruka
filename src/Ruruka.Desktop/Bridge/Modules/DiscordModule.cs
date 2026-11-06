using System.Text.RegularExpressions;
using Ruruka.Desktop.Discord;

namespace Ruruka.Desktop.Bridge.Modules;

internal sealed partial class DiscordModule(DiscordPresence presence) : IBridgeModule
{
    private const int MaxMemberCount = 999;

    public void Register(BridgeRouter router)
    {
        router.Register<InviteParams, bool>("discord.setInvite", parameters =>
        {
            presence.SetInvite(ToInvite(parameters));
            return Task.FromResult(true);
        });
        router.Register("discord.takeJoinCode", () => Task.FromResult(presence.TakeJoinCode()));
    }

    private static SessionInvite? ToInvite(InviteParams parameters)
    {
        if (parameters.Code is null) return null;
        if (!WatchCode().IsMatch(parameters.Code)) throw new BridgeException("Code de séance invalide.");
        if (parameters.MemberCount is < 1 or > MaxMemberCount) throw new BridgeException("Nombre de détectives invalide.");
        return new SessionInvite(parameters.Code, parameters.MemberCount);
    }

    [GeneratedRegex("^[2-9A-Z]{5}-[2-9A-Z]{5}$")]
    private static partial Regex WatchCode();

    private sealed record InviteParams(string? Code, int MemberCount);
}
