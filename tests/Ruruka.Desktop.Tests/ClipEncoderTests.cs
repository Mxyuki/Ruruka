using Ruruka.Desktop.Capture;

namespace Ruruka.Desktop.Tests;

public sealed class ClipEncoderTests
{
    private static readonly ClipSource Source = new(@"C:\player\mpv.exe", @"D:\anime\ep01.mkv", 1920, 1080, 2, 3, null, 0);

    private static ClipRequest Request(CropArea? crop = null, bool withSubtitles = true, string quality = ClipEncoder.QualityMax, string format = ClipEncoder.FormatMp4) =>
        new(10, 20, crop, withSubtitles, quality, "clip", format);

    [Fact]
    public void Crop_FallsOnEvenPixelsInsideTheFrame()
    {
        var (x, y, width, height) = ClipEncoder.CropInPixels(new CropArea(0.1005, 0.2, 0.5, 0.4999), 1920, 1080);

        Assert.Equal((192, 216, 960, 540), (x, y, width, height));
    }

    [Fact]
    public void Crop_NeverLeavesTheFrame()
    {
        var (x, y, width, height) = ClipEncoder.CropInPixels(new CropArea(0.9, 0.9, 0.5, 0.5), 1920, 1080);

        Assert.True(x + width <= 1920);
        Assert.True(y + height <= 1080);
    }

    [Fact]
    public void MaxQuality_UsesConstantQualityAndKeepsTheFrameSize()
    {
        var arguments = ClipEncoder.BuildArguments(Source, Request(), @"C:\out.mp4");

        Assert.Contains("--ovcopts=crf=14,preset=slow,tune=animation", arguments);
        Assert.Contains("--vf=format=yuv420p", arguments);
        Assert.Contains("--start=10", arguments);
        Assert.Contains("--end=20", arguments);
    }

    [Fact]
    public void DiscordQuality_TargetsABitrateAndShrinksTallFrames()
    {
        var arguments = ClipEncoder.BuildArguments(Source, Request(quality: ClipEncoder.QualityDiscord), @"C:\out.mp4");

        Assert.Contains(arguments, argument => argument.StartsWith("--ovcopts=b=", StringComparison.Ordinal));
        Assert.Contains("--vf=scale=-2:720,format=yuv420p", arguments);
    }

    [Fact]
    public void Crop_GoesBeforeTheScaleAndTheFormat()
    {
        var arguments = ClipEncoder.BuildArguments(Source, Request(new CropArea(0, 0, 0.5, 0.5)), @"C:\out.mp4");

        Assert.Contains("--vf=crop=960:540:0:0,format=yuv420p", arguments);
    }

    [Fact]
    public void WithoutSubtitles_TheTrackIsSwitchedOff()
    {
        var arguments = ClipEncoder.BuildArguments(Source, Request(withSubtitles: false), @"C:\out.mp4");

        Assert.Contains("--sid=no", arguments);
        Assert.DoesNotContain("--sid=3", arguments);
    }

    [Fact]
    public void ExternalSubtitles_AreLoadedByTheEncodingPlayer()
    {
        var source = Source with { SubtitleTrackId = 4, ExternalSubtitlePath = @"D:\anime\ep01.fr.ass" };

        var arguments = ClipEncoder.BuildArguments(source, Request(), @"C:\out.mp4");

        Assert.Contains(@"--sub-file=D:\anime\ep01.fr.ass", arguments);
        Assert.Contains("--sid=4", arguments);
    }

    [Fact]
    public void TheFileComesLastAfterTheSeparator()
    {
        var arguments = ClipEncoder.BuildArguments(Source, Request(), @"C:\out.mp4");

        Assert.Equal(["--", @"D:\anime\ep01.mkv"], arguments.TakeLast(2));
    }

    [Fact]
    public void Webm_UsesVp9AndOpusWithoutTheMp4Options()
    {
        var arguments = ClipEncoder.BuildArguments(Source, Request(format: ClipEncoder.FormatWebm), @"C:\out.webm");

        Assert.Contains("--ovc=libvpx-vp9", arguments);
        Assert.Contains("--oac=libopus", arguments);
        Assert.Contains("--ovcopts=crf=18,b=0,deadline=good,cpu-used=3,row-mt=1", arguments);
        Assert.DoesNotContain(arguments, argument => argument.StartsWith("--ofopts", StringComparison.Ordinal));
    }

    [Fact]
    public void Mp4_KeepsH264AndFaststart()
    {
        var arguments = ClipEncoder.BuildArguments(Source, Request(), @"C:\out.mp4");

        Assert.Contains("--ovc=libx264", arguments);
        Assert.Contains("--oac=aac", arguments);
        Assert.Contains("--ofopts=movflags=+faststart", arguments);
    }

    [Fact]
    public void Preview_IsASmallFastMp4EvenWhenWebmIsChosen()
    {
        var arguments = ClipEncoder.BuildArguments(Source, Request(quality: ClipEncoder.QualityPreview, format: ClipEncoder.FormatWebm), @"C:\preview.mp4");

        Assert.Contains("--ovc=libx264", arguments);
        Assert.Contains("--ovcopts=crf=30,preset=ultrafast", arguments);
        Assert.Contains("--vf=scale=-2:360,format=yuv420p", arguments);
    }
}
