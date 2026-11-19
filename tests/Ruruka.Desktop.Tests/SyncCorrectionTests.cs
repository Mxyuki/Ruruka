using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Tests;

public sealed class SyncCorrectionTests
{
    [Fact]
    public void Decide_LeavesPlaybackAloneWithinTolerance()
    {
        Assert.Equal(new SyncAdjustment(null, 1), SyncCorrection.Decide(100, 100.1, isHostPaused: false));
    }

    [Theory]
    [InlineData(100, 100.2, 1.05)]
    [InlineData(100.2, 100, 0.95)]
    [InlineData(100, 100.8, 1.06)]
    [InlineData(100.8, 100, 0.94)]
    public void Decide_ChangesSpeedForASmallDrift(double local, double host, double speed)
    {
        Assert.Equal(new SyncAdjustment(null, speed), SyncCorrection.Decide(local, host, isHostPaused: false));
    }

    [Fact]
    public void Decide_SeeksPastALargeDrift()
    {
        Assert.Equal(new SyncAdjustment(120, 1), SyncCorrection.Decide(100, 120, isHostPaused: false));
        Assert.Equal(new SyncAdjustment(101.5, 1), SyncCorrection.Decide(100, 101.5, isHostPaused: false));
    }

    [Fact]
    public void Decide_AlignsTheFrameWhileThePauseLasts()
    {
        Assert.Equal(new SyncAdjustment(101, 1), SyncCorrection.Decide(100, 101, isHostPaused: true));
        Assert.Equal(new SyncAdjustment(null, 1), SyncCorrection.Decide(100, 100.1, isHostPaused: true));
    }
}
