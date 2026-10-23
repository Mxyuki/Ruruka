using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Tests;

public sealed class WatchTrackerTests
{
    private const double EpisodeSeconds = 1440;
    private const double CompletionRatio = 0.85;
    private const double MinimumWatchedRatio = 0.5;

    private static WatchTracker NewTracker() => new(CompletionRatio, MinimumWatchedRatio) { DurationSeconds = EpisodeSeconds };

    private static bool Play(WatchTracker tracker, double from, double to)
    {
        var crossed = false;
        for (var position = from; position <= to; position += 0.5) crossed |= tracker.RecordPosition(position);
        return crossed;
    }

    [Fact]
    public void ContinuousPlayback_CrossesOnceAtCompletionRatio()
    {
        var tracker = NewTracker();
        var crossings = new List<double>();

        for (var position = 0.0; position <= EpisodeSeconds; position += 0.5)
        {
            if (tracker.RecordPosition(position)) crossings.Add(position);
        }

        var crossing = Assert.Single(crossings);
        Assert.InRange(crossing, EpisodeSeconds * CompletionRatio, EpisodeSeconds * CompletionRatio + 1);
    }

    [Fact]
    public void SeekingToTheEnd_DoesNotCountAsWatched()
    {
        var tracker = NewTracker();
        Play(tracker, 0, 60);

        Assert.False(Play(tracker, 1300, EpisodeSeconds));
        Assert.InRange(tracker.WatchedRatio, 0.1, 0.2);
    }

    [Fact]
    public void SkippingTheOpening_StillCountsAsWatched()
    {
        var tracker = NewTracker();
        Play(tracker, 0, 60);

        Assert.True(Play(tracker, 150, 1300));
    }

    [Fact]
    public void RewatchingAScene_CountsItOnlyOnce()
    {
        var tracker = NewTracker();
        Play(tracker, 0, 600);
        Play(tracker, 300, 600);

        Assert.InRange(tracker.WatchedRatio, 600 / EpisodeSeconds - 0.01, 600 / EpisodeSeconds + 0.01);
    }

    [Fact]
    public void RewindingThenFinishing_CountsAsWatched()
    {
        var tracker = NewTracker();
        Play(tracker, 0, 600);

        Assert.True(Play(tracker, 300, EpisodeSeconds));
    }

    [Fact]
    public void WatchingSkippedPartsAfterTheEnd_CountsOnceCompletionIsReachedAgain()
    {
        var tracker = NewTracker();
        Play(tracker, 0, 60);
        Play(tracker, 1240, 1300);

        Assert.False(Play(tracker, 60, 1000));
        Assert.True(Play(tracker, 1000, 1240));
    }

    [Fact]
    public void UnknownDuration_NeverCrosses()
    {
        var tracker = new WatchTracker(CompletionRatio, MinimumWatchedRatio);

        Assert.False(Play(tracker, 0, EpisodeSeconds));
    }
}
