export type ProtocolType = 'ftp' | 'sftp';
export type AuthMethod = 'password' | 'privateKey' | 'passwordAndKey';
export type TransferDirection = 'upload' | 'download';
export type TransferStatus = 'queued' | 'inProgress' | 'completed' | 'failed';
export type SortColumn = 'name' | 'size' | 'date';

export interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: ProtocolType;
  username: string;
  password: string;
  authMethod: AuthMethod;
  privateKeyPath: string;
  privateKeyPassphrase: string;
  initialRemotePath: string;
  initialLocalPath: string;
}

export interface FileItem {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
  permissions?: string;
  isParentDirectory?: boolean;
}

export interface TransferItem {
  id: string;
  fileName: string;
  localPath: string;
  remotePath: string;
  direction: TransferDirection;
  bytesTransferred: number;
  totalBytes: number;
  status: TransferStatus;
  errorMessage: string;
}

export interface Bookmark {
  id: string;
  name: string;
  profileId: string;
  localPath: string;
  remotePath: string;
  syncBrowsing?: boolean;
}

export interface TransferProgressData {
  transferId: string;
  bytesTransferred: number;
  totalBytes: number;
  status: TransferStatus;
  errorMessage: string;
}

export interface BannerItem {
  imageUrl: string;
  linkUrl: string;
}

declare global {
  interface Window {
    electronAPI: {
      // Connection
      connect: (profile: ConnectionProfile) => Promise<{ success: boolean; protocol: string }>;
      disconnect: () => Promise<{ success: boolean }>;
      isConnected: () => Promise<boolean>;

      // Remote file operations
      listDirectory: (remotePath: string) => Promise<FileItem[]>;
      createRemoteDirectory: (remotePath: string) => Promise<void>;
      deleteRemoteDirectory: (remotePath: string) => Promise<void>;
      deleteRemoteFile: (remotePath: string) => Promise<void>;
      renameRemote: (oldPath: string, newPath: string) => Promise<void>;
      uploadFile: (localPath: string, remotePath: string, transferId: string) => Promise<{ success?: boolean; warning?: string }>;
      downloadFile: (remotePath: string, localPath: string, transferId: string) => Promise<{ success?: boolean; warning?: string }>;
      ensureRemoteDirectory: (remotePath: string) => Promise<void>;
      getRemoteFileSize: (remotePath: string) => Promise<number>;
      listRecursive: (remotePath: string) => Promise<{ files: { path: string; size: number }[]; dirs: string[] }>;

      // Local file operations
      listLocalDirectory: (dirPath: string) => Promise<FileItem[]>;
      getDrives: () => Promise<string[]>;
      createLocalDirectory: (dirPath: string) => Promise<void>;
      deleteLocal: (targetPath: string, isDirectory: boolean) => Promise<void>;
      renameLocal: (oldPath: string, newPath: string) => Promise<void>;
      localExists: (targetPath: string) => Promise<boolean>;
      getLocalFileSize: (filePath: string) => Promise<number>;
      getHomePath: () => Promise<string>;
      collectLocalFiles: (dirPath: string) => Promise<{ files: { path: string; size: number }[]; dirs: string[] }>;

      // Profiles
      loadProfiles: () => Promise<ConnectionProfile[]>;
      saveProfiles: (profiles: ConnectionProfile[]) => Promise<void>;

      // Bookmarks
      loadBookmarks: () => Promise<Bookmark[]>;
      saveBookmarks: (bookmarks: Bookmark[]) => Promise<void>;

      // Dialogs
      openKeyFileDialog: () => Promise<string | null>;
      openDirectoryDialog: () => Promise<string | null>;

      // Window controls
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;

      // Banner
      fetchBanners: () => Promise<unknown>;
      openExternal: (url: string) => Promise<void>;

      // Transfer progress
      onTransferProgress: (callback: (data: TransferProgressData) => void) => void;
      removeTransferProgressListener: () => void;
    };
  }
}
