using System.Windows;
using System.Windows.Controls;
using FTPClient.Models;
using FTPClient.ViewModels;

namespace FTPClient.Views;

public partial class ConnectionManagerDialog : Window
{
    private readonly ConnectionManagerViewModel _vm = new();

    public ConnectionProfile? SelectedProfile => _vm.ConnectResult;

    public ConnectionManagerDialog()
    {
        InitializeComponent();
        DataContext = _vm;

        // Sync UI when selected profile changes
        _vm.PropertyChanged += (_, args) =>
        {
            if (args.PropertyName == nameof(_vm.SelectedProfile) && _vm.SelectedProfile != null)
            {
                ProtocolCombo.SelectedItem = _vm.SelectedProfile.Protocol;
                AuthMethodCombo.SelectedItem = _vm.SelectedProfile.AuthMethod;
                PasswordField.Password = _vm.SelectedProfile.Password;
                KeyPassphraseField.Password = _vm.SelectedProfile.PrivateKeyPassphrase;
            }
        };
    }

    private void AddProfile_Click(object sender, RoutedEventArgs e) => _vm.AddProfileCommand.Execute(null);
    private void DeleteProfile_Click(object sender, RoutedEventArgs e) => _vm.DeleteProfileCommand.Execute(null);

    private void Protocol_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (_vm.SelectedProfile != null && ProtocolCombo.SelectedItem is Models.ProtocolType protocol)
        {
            _vm.SelectedProfile.Protocol = protocol;
            _vm.OnProtocolChanged();
        }
    }

    private void AuthMethod_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (_vm.SelectedProfile != null && AuthMethodCombo.SelectedItem is Models.AuthMethod authMethod)
        {
            _vm.SelectedProfile.AuthMethod = authMethod;
            _vm.OnAuthMethodChanged();
        }
    }

    private void PasswordField_Changed(object sender, RoutedEventArgs e)
    {
        if (_vm.SelectedProfile != null)
            _vm.SelectedProfile.Password = PasswordField.Password;
    }

    private void KeyPassphrase_Changed(object sender, RoutedEventArgs e)
    {
        if (_vm.SelectedProfile != null)
            _vm.SelectedProfile.PrivateKeyPassphrase = KeyPassphraseField.Password;
    }

    private void BrowseKey_Click(object sender, RoutedEventArgs e) => _vm.BrowseKeyCommand.Execute(null);

    private void BrowseLocalPath_Click(object sender, RoutedEventArgs e)
    {
        if (_vm.SelectedProfile == null) return;

        // Use OpenFileDialog with folder picker trick
        var dialog = new Microsoft.Win32.OpenFolderDialog
        {
            Title = "로컬 초기 경로 선택"
        };

        if (dialog.ShowDialog() == true)
        {
            _vm.SelectedProfile.InitialLocalPath = dialog.FolderName;
        }
    }

    private void Save_Click(object sender, RoutedEventArgs e) => _vm.SaveProfiles();

    private void Connect_Click(object sender, RoutedEventArgs e)
    {
        if (_vm.SelectedProfile == null)
        {
            MessageBox.Show("연결할 프로필을 선택하세요.", "알림",
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        _vm.SaveProfiles();
        _vm.SetConnectResult(_vm.SelectedProfile);
        DialogResult = true;
        Close();
    }

    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }
}
