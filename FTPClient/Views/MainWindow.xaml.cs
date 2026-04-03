using System.Windows;
using System.Windows.Input;
using FTPClient.Models;
using FTPClient.ViewModels;

namespace FTPClient.Views;

public partial class MainWindow : Window
{
    private readonly MainViewModel _vm = new();

    public MainWindow()
    {
        InitializeComponent();
        DataContext = _vm;

        // Keyboard shortcuts
        InputBindings.Add(new KeyBinding(_vm.OpenConnectionManagerCommand, Key.N, ModifierKeys.Control));
        InputBindings.Add(new KeyBinding(_vm.AddBookmarkCommand, Key.D, ModifierKeys.Control));
    }

    private void QuickPassword_Changed(object sender, RoutedEventArgs e)
    {
        _vm.QuickPassword = QuickPasswordBox.Password;
    }

    private void Bookmark_Click(object sender, RoutedEventArgs e)
    {
        if (sender is System.Windows.Controls.MenuItem menuItem &&
            menuItem.DataContext is Bookmark bookmark)
        {
            _ = _vm.NavigateToBookmarkAsync(bookmark);
        }
    }

    private void Exit_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void About_Click(object sender, RoutedEventArgs e)
    {
        MessageBox.Show(
            "FTP Client v1.0\n\nFTP/SFTP 파일 전송 클라이언트\n바이너리 전송 모드 지원\nSSH 개인키 인증 지원",
            "FTP Client 정보",
            MessageBoxButton.OK,
            MessageBoxImage.Information);
    }
}
