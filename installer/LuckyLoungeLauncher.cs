using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Lucky Lounge")]
[assembly: AssemblyProduct("Lucky Lounge")]
[assembly: AssemblyDescription("Official Lucky Lounge desktop and server launcher")]
[assembly: AssemblyCompany("Lucky Lounge")]
[assembly: AssemblyVersion("__VERSION__.0")]
[assembly: AssemblyFileVersion("__VERSION__.0")]

namespace LuckyLounge
{
    internal static class Launcher
    {
        [STAThread]
        private static int Main()
        {
            var directory = FindApplicationDirectory(AppDomain.CurrentDomain.BaseDirectory);
            if (directory == null)
            {
                MessageBox.Show(
                    "No se encontro start-lounge-tray.cmd. Reinstala Lucky Lounge desde el instalador oficial.",
                    "Lucky Lounge",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 2;
            }

            var command = Path.Combine(directory, "start-lounge-tray.cmd");
            try
            {
                var process = new ProcessStartInfo
                {
                    FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
                    Arguments = "/d /c \"\"" + command + "\"\"",
                    WorkingDirectory = directory,
                    UseShellExecute = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                Process.Start(process);
                return 0;
            }
            catch (Exception error)
            {
                MessageBox.Show(
                    "Lucky Lounge no pudo iniciar: " + error.Message,
                    "Lucky Lounge",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }
        }

        private static string FindApplicationDirectory(string start)
        {
            var directory = new DirectoryInfo(start);
            for (var depth = 0; depth < 6 && directory != null; depth += 1)
            {
                if (File.Exists(Path.Combine(directory.FullName, "start-lounge-tray.cmd"))) return directory.FullName;
                directory = directory.Parent;
            }
            return null;
        }
    }
}
