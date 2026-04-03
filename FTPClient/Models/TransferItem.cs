using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace FTPClient.Models;

public enum TransferDirection
{
    Upload,
    Download
}

public enum TransferStatus
{
    Queued,
    InProgress,
    Completed,
    Failed
}

public class TransferItem : INotifyPropertyChanged
{
    private long _bytesTransferred;
    private long _totalBytes;
    private TransferStatus _status = TransferStatus.Queued;
    private string _errorMessage = "";

    public string FileName { get; set; } = "";
    public string LocalPath { get; set; } = "";
    public string RemotePath { get; set; } = "";
    public TransferDirection Direction { get; set; }

    public long BytesTransferred
    {
        get => _bytesTransferred;
        set { _bytesTransferred = value; OnPropertyChanged(); OnPropertyChanged(nameof(ProgressPercent)); OnPropertyChanged(nameof(ProgressText)); }
    }

    public long TotalBytes
    {
        get => _totalBytes;
        set { _totalBytes = value; OnPropertyChanged(); OnPropertyChanged(nameof(ProgressPercent)); OnPropertyChanged(nameof(ProgressText)); }
    }

    public TransferStatus Status
    {
        get => _status;
        set { _status = value; OnPropertyChanged(); OnPropertyChanged(nameof(StatusText)); }
    }

    public string ErrorMessage
    {
        get => _errorMessage;
        set { _errorMessage = value; OnPropertyChanged(); }
    }

    public double ProgressPercent => TotalBytes > 0 ? (double)BytesTransferred / TotalBytes * 100 : 0;
    public string ProgressText => TotalBytes > 0 ? $"{BytesTransferred / 1024} / {TotalBytes / 1024} KB" : "";
    public string DirectionText => Direction == TransferDirection.Upload ? "\u2191" : "\u2193";
    public string StatusText => Status switch
    {
        TransferStatus.Queued => "대기",
        TransferStatus.InProgress => "전송 중",
        TransferStatus.Completed => "완료",
        TransferStatus.Failed => "실패",
        _ => ""
    };

    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
