namespace Ruruka.Desktop.Player;

/// <summary>
/// Measures how much of an episode was actually played from a stream of playback positions,
/// so seeking to the end doesn't count as watching it.
/// </summary>
internal sealed class WatchTracker
{
    public const double WatchedThreshold = 0.8;

    // mpv reports time-pos many times per second; a bigger jump means the user seeked.
    private const double MaxContinuousStepSeconds = 3;

    private double _lastPosition = -1;
    private double _watchedSeconds;
    private bool _hasReachedThreshold;

    public double DurationSeconds { get; set; }

    public double WatchedRatio => DurationSeconds > 0 ? Math.Min(_watchedSeconds / DurationSeconds, 1) : 0;

    /// <summary>Records a playback position; returns true only on the update that first crosses the watched threshold.</summary>
    public bool RecordPosition(double positionSeconds)
    {
        var step = positionSeconds - _lastPosition;
        if (_lastPosition >= 0 && step > 0 && step <= MaxContinuousStepSeconds) _watchedSeconds += step;
        _lastPosition = positionSeconds;

        if (_hasReachedThreshold || WatchedRatio < WatchedThreshold) return false;
        _hasReachedThreshold = true;
        return true;
    }
}
