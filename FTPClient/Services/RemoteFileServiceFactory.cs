using FTPClient.Models;

namespace FTPClient.Services;

public static class RemoteFileServiceFactory
{
    public static IRemoteFileService Create(ConnectionProfile profile)
    {
        return profile.Protocol switch
        {
            ProtocolType.SFTP => new SftpFileService(),
            ProtocolType.FTP => new FtpFileService(),
            _ => throw new ArgumentException($"Unsupported protocol: {profile.Protocol}")
        };
    }
}
