namespace FTPClient.Models;

public class Bookmark
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string ProfileId { get; set; } = "";
    public string LocalPath { get; set; } = "";
    public string RemotePath { get; set; } = "";
}
