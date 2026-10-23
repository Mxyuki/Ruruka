namespace Ruruka.Desktop.Player;

/// <summary>
/// Measures how much of an episode was actually played from a stream of playback positions.
/// An episode counts as watched once playback reaches <c>completionRatio</c> of it and at least
/// <c>minimumWatchedRatio</c> of it was really played, so skipping openings is fine but seeking
/// straight to the end is not.
/// </summary>
internal sealed class WatchTracker(double completionRatio, double minimumWatchedRatio)
{
    // mpv reports time-pos many times per second; a bigger jump means the user seeked.
    private const double MaxContinuousStepSeconds = 3;

    // Played stretches kept merged, so rewinding to rewatch a scene never counts it twice.
    private readonly List<(double Start, double End)> _playedRanges = [];
    private double _lastPosition = -1;
    private bool _hasCountedAsWatched;

    public double DurationSeconds { get; set; }

    public double WatchedRatio => DurationSeconds > 0 ? Math.Min(PlayedSeconds / DurationSeconds, 1) : 0;

    private double PlayedSeconds => _playedRanges.Sum(range => range.End - range.Start);

    /// <summary>Records a playback position; returns true only on the update where the episode first counts as watched.</summary>
    public bool RecordPosition(double positionSeconds)
    {
        var step = positionSeconds - _lastPosition;
        if (_lastPosition >= 0 && step > 0 && step <= MaxContinuousStepSeconds) AddPlayedRange(_lastPosition, positionSeconds);
        _lastPosition = positionSeconds;

        if (_hasCountedAsWatched || DurationSeconds <= 0) return false;
        if (positionSeconds < DurationSeconds * completionRatio || WatchedRatio < minimumWatchedRatio) return false;
        _hasCountedAsWatched = true;
        return true;
    }

    private void AddPlayedRange(double start, double end)
    {
        var merged = (Start: start, End: end);
        _playedRanges.RemoveAll(range =>
        {
            if (range.End < merged.Start || range.Start > merged.End) return false;
            merged = (Math.Min(range.Start, merged.Start), Math.Max(range.End, merged.End));
            return true;
        });
        _playedRanges.Add(merged);
    }
}
