using Ruruka.Desktop.Capture;

namespace Ruruka.Desktop.Tests;

public sealed class FfmpegClipEncoderTests
{
    private static readonly ClipSource Source = new(@"C:\player\mpv.exe", @"D:\anime\ep01.mkv", 1920, 1080, 2, 3, null, 0);

    private static ClipRequest Request(CropArea? crop = null, bool withSubtitles = false) =>
        new(10, 20, crop, withSubtitles, "max", "clip", PresetId: "max");

    private static ClipPreset Preset(string arguments) => new("mine", "Mon réglage", arguments, "mp4");

    [Fact]
    public void Tokenize_KeepsQuotedValuesTogether()
    {
        var tokens = ClipPresetCatalog.Tokenize("-c:v libx265 -x265-params \"aq-mode=3:aq-strength=0.7\" -crf 24");

        Assert.Equal(["-c:v", "libx265", "-x265-params", "aq-mode=3:aq-strength=0.7", "-crf", "24"], tokens);
    }

    [Fact]
    public void Tokenize_RefusesAnOpenQuote()
    {
        Assert.Null(ClipPresetCatalog.Tokenize("-x265-params \"aq-mode=3"));
    }

    [Fact]
    public void Arguments_SeekBeforeTheInputAndPickTheChosenAudioTrack()
    {
        var arguments = FfmpegClipEncoder.BuildArguments(Source, Request(), Preset("-crf 24"), @"C:\out.mp4");

        Assert.True(arguments.ToList().IndexOf("-ss") < arguments.ToList().IndexOf("-i"));
        Assert.Contains("10", arguments);
        Assert.Contains("0:a:1", arguments);
        Assert.Equal(@"C:\out.mp4", arguments[^1]);
        Assert.Equal("24", arguments[^2]);
    }

    [Fact]
    public void UserCommand_ComesAfterRurukasOptionsAndBeforeTheOutput()
    {
        var arguments = FfmpegClipEncoder.BuildArguments(Source, Request(), Preset("-map_metadata -1 -c:v libx265 -b:a 256k"), @"C:\out.mp4");

        var list = arguments.ToList();
        Assert.True(list.IndexOf("-map") < list.IndexOf("-map_metadata"));
        Assert.True(list.IndexOf("-c:v") < list.Count - 1);
    }

    [Fact]
    public void UserFilter_JoinsTheCropInsteadOfReplacingIt()
    {
        var arguments = FfmpegClipEncoder.BuildArguments(Source, Request(new CropArea(0, 0, 0.5, 0.5)), Preset("-vf scale=-2:720 -crf 20"), @"C:\out.mp4");

        var list = arguments.ToList();
        Assert.Equal("crop=960:540:0:0,scale=-2:720", list[list.IndexOf("-vf") + 1]);
        Assert.Single(list, "-vf");
    }

    [Fact]
    public void WithoutAnyFilter_NoFilterOptionIsSent()
    {
        var arguments = FfmpegClipEncoder.BuildArguments(Source, Request(), Preset("-crf 20"), @"C:\out.mp4");

        Assert.DoesNotContain("-vf", arguments);
    }

    [Fact]
    public void Subtitles_AreBurnedFromTheEmbeddedTrackAtTheFileTime()
    {
        var filter = FfmpegClipEncoder.SubtitleFilter(Source with { SubtitleDelaySeconds = 0.5 }, 10);

        Assert.Equal(@"setpts=PTS+(9.5)/TB,subtitles=filename=D\\:/anime/ep01.mkv:si=2,setpts=PTS-(9.5)/TB", filter);
    }

    [Fact]
    public void Subtitles_OfAnExternalFileUseThatFile()
    {
        var filter = FfmpegClipEncoder.SubtitleFilter(Source with { ExternalSubtitlePath = @"D:\anime\ep01.fr.ass" }, 0);

        Assert.Contains(@"filename=D\\:/anime/ep01.fr.ass,", filter);
        Assert.DoesNotContain(":si=", filter);
    }

    [Fact]
    public void FilterPath_EscapesApostrophesAndSeparators()
    {
        Assert.Equal(@"D\\:/Frieren\\\'s [x].mkv".Replace("[", @"\[").Replace("]", @"\]"), FfmpegClipEncoder.EscapeFilterValue(@"D:\Frieren's [x].mkv"));
    }

    [Fact]
    public void DiscordPreset_FitsTheBitrateToTheClipLength()
    {
        var discord = ClipPresetCatalog.BuiltIn.Single(preset => preset.Id == ClipPresetCatalog.DiscordId);

        var tokens = ClipPresetCatalog.Expand(discord.Arguments, 10);

        var videoKbps = ClipEncoder.DiscordVideoBitsPerSecond(10) / 1000;
        Assert.Contains($"{videoKbps}k", tokens);
        Assert.DoesNotContain(tokens, token => token.Contains('{'));
    }

    [Theory]
    [InlineData("-i other.mkv")]
    [InlineData("-crf 20 -ss 5")]
    [InlineData("-progress file.txt")]
    public void Preset_RefusesOptionsRurukaSetsItself(string arguments)
    {
        Assert.NotNull(ClipPresetCatalog.Problem(Preset(arguments)));
    }

    [Fact]
    public void Preset_AcceptsTheUsersOwnCommand()
    {
        const string arguments = "-map_metadata -1 -map_chapters -1 -shortest -pix_fmt yuv420p10le -c:v libx265 -x265-params \"aq-mode=3:aq-strength=0.7:vbv-maxrate=8000:vbv-bufsize=16000\" -crf 24 -threads 5 -c:a libopus -movflags +faststart -b:a 256k -ac 2";

        Assert.Null(ClipPresetCatalog.Problem(Preset(arguments)));
    }

    [Fact]
    public void Preset_NeedsAUsableNameAndIdentifier()
    {
        Assert.NotNull(ClipPresetCatalog.Problem(new ClipPreset("max", "Doublon", "-crf 20", "mp4")));
        Assert.NotNull(ClipPresetCatalog.Problem(new ClipPreset("Mine!", "Nom", "-crf 20", "mp4")));
        Assert.NotNull(ClipPresetCatalog.Problem(new ClipPreset("mine", "  ", "-crf 20", "mp4")));
        Assert.NotNull(ClipPresetCatalog.Problem(new ClipPreset("mine", "Nom", "-crf 20", "avi")));
    }

    [Fact]
    public void ADeletedPreset_FallsBackToMaxQuality()
    {
        Assert.Equal(ClipPresetCatalog.MaxId, ClipPresetCatalog.Find([], "gone").Id);
    }
}

public sealed class FrameGrabberTests
{
    private static readonly ClipSource Source = new(@"C:\player\mpv.exe", @"D:\anime\ep01.mkv", 1920, 1080, 2, 3, null, 0);

    [Fact]
    public void Frame_IsOnePictureAtTheChosenSecond()
    {
        var arguments = FrameGrabber.BuildArguments(Source, 12.5, true, @"C:\scrub");

        Assert.Contains("--start=12.5", arguments);
        Assert.Contains("--frames=1", arguments);
        Assert.Contains("--sid=3", arguments);
        Assert.Equal(@"D:\anime\ep01.mkv", arguments[^1]);
    }

    [Fact]
    public void Frame_WithoutSubtitlesSwitchesTheTrackOff()
    {
        var arguments = FrameGrabber.BuildArguments(Source, 0, false, @"C:\scrub");

        Assert.Contains("--sid=no", arguments);
    }
}
