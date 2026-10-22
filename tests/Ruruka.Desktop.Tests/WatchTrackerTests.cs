using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Tests;

public sealed class WatchTrackerTests
{
    private const double EpisodeSeconds = 1440;

    [Fact]
    public void ContinuousPlayback_CrossesThresholdOnceAtEightyPercent()
    {
        var tracker = new WatchTracker { DurationSeconds = EpisodeSeconds };
        var crossings = new List<double>();

        for (var position = 0.0; position <= EpisodeSeconds; position += 0.5)
        {
            if (tracker.RecordPosition(position)) crossings.Add(position);
        }

        var crossing = Assert.Single(crossings);
        Assert.InRange(crossing, EpisodeSeconds * 0.8, EpisodeSeconds * 0.8 + 1);
    }

    [Fact]
    public void SeekingToTheEnd_DoesNotCountAsWatched()
    {
        var tracker = new WatchTracker { DurationSeconds = EpisodeSeconds };
        for (var position = 0.0; position <= 60; position += 0.5) tracker.RecordPosition(position);

        var crossed = false;
        for (var position = 1300.0; position <= EpisodeSeconds; position += 0.5) crossed |= tracker.RecordPosition(position);

        Assert.False(crossed);
        Assert.InRange(tracker.WatchedRatio, 0.1, 0.2);
    }

    [Fact]
    public void RewindingAndRewatching_StillReachesThreshold()
    {
        var tracker = new WatchTracker { DurationSeconds = EpisodeSeconds };
        for (var position = 0.0; position <= 600; position += 0.5) tracker.RecordPosition(position);

        var crossed = false;
        for (var position = 300.0; position <= 1200; position += 0.5) crossed |= tracker.RecordPosition(position);

        Assert.True(crossed);
    }

    [Fact]
    public void UnknownDuration_NeverCrosses()
    {
        var tracker = new WatchTracker();
        var crossed = false;
        for (var position = 0.0; position <= EpisodeSeconds; position += 0.5) crossed |= tracker.RecordPosition(position);

        Assert.False(crossed);
    }
}
