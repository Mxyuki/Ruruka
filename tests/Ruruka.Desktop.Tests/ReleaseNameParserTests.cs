using Ruruka.Desktop.Library;

namespace Ruruka.Desktop.Tests;

public sealed class ReleaseNameParserTests
{
    [Theory]
    [InlineData("[SubsPlease] Sousou no Frieren - 05 (1080p) [A1B2C3D4].mkv", 5)]
    [InlineData("[Erai-raws] Kusuriya no Hitorigoto - 12v2 [1080p][Multiple Subtitle].mkv", 12)]
    [InlineData("Spy.x.Family.S02E07.1080p.WEB.H264-GROUP.mkv", 7)]
    [InlineData("Bocchi the Rock! E03 [BD 1080p].mkv", 3)]
    [InlineData("Mahou Shoujo Episode 10.mp4", 10)]
    [InlineData("[Judas] Dungeon Meshi - S01E24.mkv", 24)]
    [InlineData("[Group] Title [07][1080p].mkv", 7)]
    [InlineData("Precure 2024 - 113 [720p].mkv", 113)]
    [InlineData("Some_Show_08_[720p].mkv", 8)]
    public void ParseEpisode_ReadsCommonReleaseNames(string fileName, int expected)
    {
        Assert.Equal(expected, ReleaseNameParser.ParseEpisode(fileName));
    }

    [Theory]
    [InlineData("[Group] Title - NCOP1 [1080p].mkv")]
    [InlineData("[Group] Title - NCED [1080p].mkv")]
    [InlineData("[Group] Title - Preview 03.mkv")]
    [InlineData("[Group] Title - 12.5 [1080p].mkv")]
    public void ParseEpisode_IgnoresExtrasAndSpecials(string fileName)
    {
        Assert.Null(ReleaseNameParser.ParseEpisode(fileName));
    }

    [Theory]
    [InlineData("[SubsPlease] Sousou no Frieren (1080p)", "Sousou no Frieren")]
    [InlineData("[Judas] Dungeon Meshi S01 [BD 1080p][HEVC x265][Dual Audio]", "Dungeon Meshi")]
    [InlineData("Spy.x.Family.S02.1080p.WEB.H264-GROUP", "Spy x Family Season 2")]
    [InlineData("[Erai-raws] Kusuriya no Hitorigoto - 01 ~ 24 [1080p]", "Kusuriya no Hitorigoto")]
    [InlineData("Mob_Psycho_100_III", "Mob Psycho 100 III")]
    [InlineData("Meitantei Precure! (2026) [Batch]", "Meitantei Precure!")]
    public void CleanTitle_StripsReleaseNoise(string folderName, string expected)
    {
        Assert.Equal(expected, ReleaseNameParser.CleanTitle(folderName));
    }
}
