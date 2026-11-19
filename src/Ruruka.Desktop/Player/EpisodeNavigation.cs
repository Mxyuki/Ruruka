using System.Globalization;

namespace Ruruka.Desktop.Player;

/// <summary>
/// What the Ruruka player's bar may offer around the episode it plays; the UI decides, since it knows which files exist
/// and whether a chain of episodes is running.
/// </summary>
/// <param name="PreviousEpisode">The episode the « précédent » arrow plays; null hides the arrow.</param>
/// <param name="NextEpisode">The episode the « suivant » arrow plays; null hides the arrow.</param>
/// <param name="PromptEpisode">The episode offered in the card shown in the last seconds; null shows no card.</param>
public sealed record EpisodeNavigation(int? PreviousEpisode, int? NextEpisode, int? PromptEpisode)
{
    /// <summary>The script-opts the player's script reads: an episode number, or "no".</summary>
    internal string ToScriptOptions() =>
        $"ruruka-previous={Format(PreviousEpisode)},ruruka-next={Format(NextEpisode)},ruruka-prompt={Format(PromptEpisode)}";

    private static string Format(int? episode) => episode?.ToString(CultureInfo.InvariantCulture) ?? "no";
}
