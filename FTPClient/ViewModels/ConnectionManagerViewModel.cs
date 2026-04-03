using System.Collections.ObjectModel;
using FTPClient.Models;
using FTPClient.Services;
using FTPClient.ViewModels.Base;

namespace FTPClient.ViewModels;

public class ConnectionManagerViewModel : ViewModelBase
{
    private readonly ProfileService _profileService = new();
    private ConnectionProfile? _selectedProfile;
    private bool _showPrivateKey;

    public ObservableCollection<ConnectionProfile> Profiles { get; } = new();

    public ConnectionProfile? SelectedProfile
    {
        get => _selectedProfile;
        set
        {
            if (SetProperty(ref _selectedProfile, value))
            {
                OnPropertyChanged(nameof(HasSelection));
                UpdateShowPrivateKey();
            }
        }
    }

    public bool HasSelection => SelectedProfile != null;

    public bool ShowPrivateKey
    {
        get => _showPrivateKey;
        set => SetProperty(ref _showPrivateKey, value);
    }

    public ConnectionProfile? ConnectResult { get; private set; }

    public RelayCommand AddProfileCommand { get; }
    public RelayCommand DeleteProfileCommand { get; }
    public RelayCommand SaveCommand { get; }
    public RelayCommand BrowseKeyCommand { get; }

    public ConnectionManagerViewModel()
    {
        AddProfileCommand = new RelayCommand(AddProfile);
        DeleteProfileCommand = new RelayCommand(DeleteProfile, () => HasSelection);
        SaveCommand = new RelayCommand(SaveProfiles);
        BrowseKeyCommand = new RelayCommand(BrowseKey);

        LoadProfiles();
    }

    private void LoadProfiles()
    {
        Profiles.Clear();
        foreach (var p in _profileService.Load())
            Profiles.Add(p);
    }

    public void SaveProfiles()
    {
        _profileService.Save(Profiles.ToList());
    }

    private void AddProfile()
    {
        var profile = new ConnectionProfile { Name = "새 연결" };
        Profiles.Add(profile);
        SelectedProfile = profile;
        SaveProfiles();
    }

    private void DeleteProfile()
    {
        if (SelectedProfile == null) return;
        Profiles.Remove(SelectedProfile);
        SelectedProfile = Profiles.FirstOrDefault();
        SaveProfiles();
    }

    private void BrowseKey()
    {
        if (SelectedProfile == null) return;

        var dialog = new Microsoft.Win32.OpenFileDialog
        {
            Title = "개인키 파일 선택",
            Filter = "키 파일 (*.pem;*.ppk;*.key;*.pub)|*.pem;*.ppk;*.key;*.pub|모든 파일 (*.*)|*.*"
        };

        if (dialog.ShowDialog() == true)
        {
            SelectedProfile.PrivateKeyPath = dialog.FileName;
            OnPropertyChanged(nameof(SelectedProfile));
        }
    }

    private void UpdateShowPrivateKey()
    {
        ShowPrivateKey = SelectedProfile?.AuthMethod is AuthMethod.PrivateKey or AuthMethod.PasswordAndKey;
    }

    public void OnProtocolChanged()
    {
        if (SelectedProfile != null)
        {
            SelectedProfile.Port = SelectedProfile.DefaultPort;
            OnPropertyChanged(nameof(SelectedProfile));
        }
    }

    public void OnAuthMethodChanged()
    {
        UpdateShowPrivateKey();
    }

    public void SetConnectResult(ConnectionProfile profile)
    {
        ConnectResult = profile;
    }
}
