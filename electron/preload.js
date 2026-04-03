const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Connection
  connect: (profile) => ipcRenderer.invoke('ftp:connect', profile),
  disconnect: () => ipcRenderer.invoke('ftp:disconnect'),
  isConnected: () => ipcRenderer.invoke('ftp:isConnected'),

  // Remote file operations
  listDirectory: (remotePath) => ipcRenderer.invoke('ftp:listDirectory', remotePath),
  createRemoteDirectory: (remotePath) => ipcRenderer.invoke('ftp:createDirectory', remotePath),
  deleteRemoteDirectory: (remotePath) => ipcRenderer.invoke('ftp:deleteDirectory', remotePath),
  deleteRemoteFile: (remotePath) => ipcRenderer.invoke('ftp:deleteFile', remotePath),
  renameRemote: (oldPath, newPath) => ipcRenderer.invoke('ftp:rename', oldPath, newPath),
  uploadFile: (localPath, remotePath, transferId) => ipcRenderer.invoke('ftp:uploadFile', localPath, remotePath, transferId),
  downloadFile: (remotePath, localPath, transferId) => ipcRenderer.invoke('ftp:downloadFile', remotePath, localPath, transferId),
  ensureRemoteDirectory: (remotePath) => ipcRenderer.invoke('ftp:ensureDirectory', remotePath),
  getRemoteFileSize: (remotePath) => ipcRenderer.invoke('ftp:getFileSize', remotePath),
  listRecursive: (remotePath) => ipcRenderer.invoke('ftp:listRecursive', remotePath),

  // Local file operations
  listLocalDirectory: (dirPath) => ipcRenderer.invoke('local:listDirectory', dirPath),
  getDrives: () => ipcRenderer.invoke('local:getDrives'),
  createLocalDirectory: (dirPath) => ipcRenderer.invoke('local:createDirectory', dirPath),
  deleteLocal: (targetPath, isDirectory) => ipcRenderer.invoke('local:delete', targetPath, isDirectory),
  renameLocal: (oldPath, newPath) => ipcRenderer.invoke('local:rename', oldPath, newPath),
  localExists: (targetPath) => ipcRenderer.invoke('local:exists', targetPath),
  getLocalFileSize: (filePath) => ipcRenderer.invoke('local:getFileSize', filePath),
  getHomePath: () => ipcRenderer.invoke('local:getHomePath'),
  collectLocalFiles: (dirPath) => ipcRenderer.invoke('local:collectFiles', dirPath),

  // Profiles
  loadProfiles: () => ipcRenderer.invoke('profiles:load'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profiles:save', profiles),

  // Bookmarks
  loadBookmarks: () => ipcRenderer.invoke('bookmarks:load'),
  saveBookmarks: (bookmarks) => ipcRenderer.invoke('bookmarks:save', bookmarks),

  // Dialogs
  openKeyFileDialog: () => ipcRenderer.invoke('dialog:openKeyFile'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // Banner
  fetchBanners: () => ipcRenderer.invoke('banner:fetch'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Transfer progress listener
  onTransferProgress: (callback) => {
    ipcRenderer.on('transfer:progress', (_event, data) => callback(data));
  },
  removeTransferProgressListener: () => {
    ipcRenderer.removeAllListeners('transfer:progress');
  },
});
