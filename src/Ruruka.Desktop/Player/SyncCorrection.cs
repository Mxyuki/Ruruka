namespace Ruruka.Desktop.Player;

/// <summary>What a friend's mpv does to stay on the host's position.</summary>
/// <param name="SeekToSeconds">Where to jump, or null when the speed is enough.</param>
/// <param name="Speed">Playback speed until the next sync point.</param>
internal sealed record SyncAdjustment(double? SeekToSeconds, double Speed);

internal static class SyncCorrection
{
    // Below this gap nobody notices, so playback stays untouched and doesn't hunt around the target.
    private const double ToleratedDriftSeconds = 0.15;

    // Past this gap, catching up would take too long: a jump is less visible than a long drift.
    private const double SeekDriftSeconds = 1.2;

    // Stopped images show no drift, but a seek there costs nothing and leaves both on the same frame.
    private const double PausedDriftSeconds = 0.2;

    // <-- La vitesse suit l'écart : un petit retard se rattrape sans qu'on l'entende, un plus grand plus vite, jusqu'à ce plafond -->
    private const double SpeedPerSecondOfDrift = 0.25;
    private const double MaxSpeedChange = 0.06;

    public static SyncAdjustment Decide(double localSeconds, double hostSeconds, bool isHostPaused)
    {
        var drift = hostSeconds - localSeconds;
        if (isHostPaused) return new SyncAdjustment(Math.Abs(drift) > PausedDriftSeconds ? hostSeconds : null, 1);
        if (Math.Abs(drift) > SeekDriftSeconds) return new SyncAdjustment(hostSeconds, 1);
        if (Math.Abs(drift) <= ToleratedDriftSeconds) return new SyncAdjustment(null, 1);
        var speedChange = Math.Clamp(drift * SpeedPerSecondOfDrift, -MaxSpeedChange, MaxSpeedChange);
        return new SyncAdjustment(null, Math.Round(1 + speedChange, 3));
    }
}
