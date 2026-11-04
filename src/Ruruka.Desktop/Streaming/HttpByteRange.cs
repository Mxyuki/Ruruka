using System.Globalization;

namespace Ruruka.Desktop.Streaming;

/// <summary>An inclusive byte range of a file.</summary>
internal readonly record struct HttpByteRange(long Start, long End)
{
    public long Length => End - Start + 1;

    /// <summary>Reads a single-range "bytes=" header; false when the range can't be served for this file size.</summary>
    public static bool TryParse(string header, long fileSize, out HttpByteRange range)
    {
        range = default;
        const string prefix = "bytes=";
        if (!header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return false;
        var bounds = header[prefix.Length..].Trim().Split('-');
        if (bounds.Length != 2) return false;

        if (bounds[0].Length == 0)
        {
            if (!TryReadNumber(bounds[1], out var suffixLength) || suffixLength == 0) return false;
            range = new HttpByteRange(Math.Max(0, fileSize - suffixLength), fileSize - 1);
            return true;
        }

        if (!TryReadNumber(bounds[0], out var start) || start >= fileSize) return false;
        var end = fileSize - 1;
        if (bounds[1].Length > 0)
        {
            if (!TryReadNumber(bounds[1], out var requestedEnd) || requestedEnd < start) return false;
            end = Math.Min(end, requestedEnd);
        }
        range = new HttpByteRange(start, end);
        return true;
    }

    private static bool TryReadNumber(string text, out long number) =>
        long.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out number);
}
