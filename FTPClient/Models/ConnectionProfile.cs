namespace FTPClient.Models;

public enum ProtocolType
{
    FTP,
    SFTP
}

public enum AuthMethod
{
    Password,
    PrivateKey,
    PasswordAndKey
}

public class ConnectionProfile
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Host { get; set; } = "";
    public int Port { get; set; } = 21;
    public ProtocolType Protocol { get; set; } = ProtocolType.FTP;
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public AuthMethod AuthMethod { get; set; } = AuthMethod.Password;
    public string PrivateKeyPath { get; set; } = "";
    public string PrivateKeyPassphrase { get; set; } = "";
    public string InitialRemotePath { get; set; } = "/";
    public string InitialLocalPath { get; set; } = "";

    public int DefaultPort => Protocol == ProtocolType.SFTP ? 22 : 21;
}
