using Ruruka.Desktop.Bridge;
using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Windowing;

/// <summary>
/// Forwards host events to the UI and, while the window is hidden in the notification area,
/// confirms watched episodes with a tray notification.
/// </summary>
internal sealed class BackgroundPlaybackNotifier(IBridgeEvents inner, Form window, TrayIcon tray) : IBridgeEvents
{
    public void Emit(string name, object payload)
    {
        inner.Emit(name, payload);
        if (payload is not EpisodeWatched watched) return;
        window.BeginInvoke(() =>
        {
            if (!window.Visible) tray.Notify($"Épisode {watched.Episode} de {watched.Title} vu : ta liste se met à jour.");
        });
    }
}
