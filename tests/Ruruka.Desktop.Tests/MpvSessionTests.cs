using Ruruka.Desktop.Player;

namespace Ruruka.Desktop.Tests;

public sealed class MpvSessionTests
{
    [Fact]
    public void IpcServerArgument_UsesTheFullNamedPipePrefix()
    {
        Assert.Equal(@"--input-ipc-server=\\.\pipe\ruruka-mpv-test", MpvSession.IpcServerArgument("ruruka-mpv-test"));
    }
}
