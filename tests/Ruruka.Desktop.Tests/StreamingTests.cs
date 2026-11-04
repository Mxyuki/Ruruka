using System.Net;
using System.Net.Http.Headers;
using Ruruka.Desktop.Streaming;

namespace Ruruka.Desktop.Tests;

public sealed class StreamingTests
{
    private static readonly byte[] File = Enumerable.Range(0, 3_500_000).Select(index => (byte)(index % 251)).ToArray();

    private static LoopbackStreamServer NewServer(List<long>? offsets = null) => new((offset, length, _) =>
    {
        offsets?.Add(offset);
        return Task.FromResult(File.AsSpan((int)offset, length).ToArray());
    }, File.Length, ".mkv");

    [Theory]
    [InlineData("bytes=0-", 0, 99)]
    [InlineData("bytes=10-19", 10, 19)]
    [InlineData("bytes=90-500", 90, 99)]
    [InlineData("bytes=-10", 90, 99)]
    public void HttpByteRange_ReadsValidRanges(string header, long start, long end)
    {
        Assert.True(HttpByteRange.TryParse(header, 100, out var range));
        Assert.Equal(new HttpByteRange(start, end), range);
    }

    [Theory]
    [InlineData("bytes=100-")]
    [InlineData("bytes=20-10")]
    [InlineData("bytes=-0")]
    [InlineData("bytes=1-2,4-5")]
    [InlineData("items=1-2")]
    public void HttpByteRange_RefusesOthers(string header)
    {
        Assert.False(HttpByteRange.TryParse(header, 100, out _));
    }

    [Fact]
    public async Task Server_ServesTheWholeFileAcrossChunks()
    {
        using var server = NewServer();
        using var client = new HttpClient();
        Assert.Equal(File, await client.GetByteArrayAsync(server.Url));
    }

    [Fact]
    public async Task Server_ServesARangeFromTheRightOffset()
    {
        using var server = NewServer();
        using var client = new HttpClient();
        var request = new HttpRequestMessage(HttpMethod.Get, server.Url);
        request.Headers.Range = new RangeHeaderValue(2_000_000, 2_000_009);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.PartialContent, response.StatusCode);
        Assert.Equal($"bytes 2000000-2000009/{File.Length}", response.Content.Headers.ContentRange?.ToString());
        Assert.Equal(File.AsSpan(2_000_000, 10).ToArray(), await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Server_RefusesAnAddressWithoutTheToken()
    {
        using var server = NewServer();
        using var client = new HttpClient();
        var wrongToken = new Uri(new Uri(server.Url), "/0000/video.mkv");

        using var response = await client.GetAsync(wrongToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Server_RefusesAnotherHostName()
    {
        using var server = NewServer();
        using var client = new HttpClient();
        var request = new HttpRequestMessage(HttpMethod.Get, server.Url);
        request.Headers.Host = "evil.example";

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Server_StopsAskingForChunksWhenTheReaderLeaves()
    {
        var offsets = new List<long>();
        using var server = NewServer(offsets);
        using var client = new HttpClient();

        using (await client.GetAsync(server.Url, HttpCompletionOption.ResponseHeadersRead))
        {
            await Task.Delay(100);
        }
        await Task.Delay(100);

        Assert.True(offsets.Count <= 4);
    }
}
