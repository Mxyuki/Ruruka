using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Discord;
using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Windowing;

/// <summary>
/// Forwards host events to the UI and, while the window is hidden in the notification area,
/// confirms watched episodes with a tray notification. Join requests get one as soon as the
/// window is in the background, since they expire quickly.
/// </summary>
internal sealed class BackgroundPlaybackNotifier(IBridgeEvents inner, Form window, TrayIcon tray) : IBridgeEvents
{
    public void Emit(string name, object payload)
    {
        inner.Emit(name, payload);
        if (payload is EpisodeWatched watched)
        {
            window.BeginInvoke(() =>
            {
                if (!window.Visible) tray.Notify($"Épisode {watched.Episode} de {watched.Title} vu : ta liste se met à jour.");
            });
        }
        if (payload is JoinAsked asked)
        {
            window.BeginInvoke(() =>
            {
                if (Form.ActiveForm != window) tray.Notify($"{asked.Name} demande à rejoindre ta séance : réponds dans Ruruka.");
            });
        }
    }
}
