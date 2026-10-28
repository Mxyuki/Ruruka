using Ruruka.Desktop.Windowing;

namespace Ruruka.Desktop.Tests;

public sealed class StartupRegistrationTests
{
    [Fact]
    public void CommandFor_QuotesThePathAndAddsTheStartupArgument()
    {
        Assert.Equal(@"""C:\Program Files\Ruruka\Ruruka.exe"" --startup", StartupRegistration.CommandFor(@"C:\Program Files\Ruruka\Ruruka.exe"));
    }
}
