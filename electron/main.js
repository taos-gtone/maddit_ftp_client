const { app, BrowserWindow, ipcMain, dialog, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const ftp = require('basic-ftp');
const SftpClient = require('ssh2-sftp-client');

let mainWindow;
let ftpClient = null;
let sftpClient = null;
let currentProtocol = null; // 'ftp' or 'sftp'
let DATA_DIR;

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 560,
    frame: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'app-dist', 'index.html'));
  }
}

app.whenReady().then(function () {
  DATA_DIR = path.join(app.getPath('userData'), 'maddit-ftp-client');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  createWindow();
});
app.on('window-all-closed', function () { app.quit(); });

// ─── Window controls ───
ipcMain.handle('window:minimize', function () { if (mainWindow) mainWindow.minimize(); });
ipcMain.handle('window:maximize', function () {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', function () { if (mainWindow) mainWindow.close(); });

// ─── Connection ───
ipcMain.handle('ftp:connect', async function (_event, profile) {
  try {
    await disconnectCurrent();

    if (profile.protocol === 'sftp') {
      sftpClient = new SftpClient();
      var connectOpts = {
        host: profile.host,
        port: profile.port || 22,
        username: profile.username,
      };

      if (profile.authMethod === 'privateKey' || profile.authMethod === 'passwordAndKey') {
        connectOpts.privateKey = fs.readFileSync(profile.privateKeyPath, 'utf8');
        if (profile.privateKeyPassphrase) {
          connectOpts.passphrase = profile.privateKeyPassphrase;
        }
      }
      if (profile.authMethod === 'password' || profile.authMethod === 'passwordAndKey') {
        connectOpts.password = profile.password;
      }

      await sftpClient.connect(connectOpts);
      currentProtocol = 'sftp';
      return { success: true, protocol: 'sftp' };
    } else {
      ftpClient = new ftp.Client();
      ftpClient.ftp.verbose = false;
      await ftpClient.access({
        host: profile.host,
        port: profile.port || 21,
        user: profile.username,
        password: profile.password,
        secure: false,
      });
      currentProtocol = 'ftp';
      return { success: true, protocol: 'ftp' };
    }
  } catch (err) {
    await disconnectCurrent();
    throw new Error('연결 실패: ' + err.message);
  }
});

async function disconnectCurrent() {
  try {
    if (ftpClient) { ftpClient.close(); ftpClient = null; }
    if (sftpClient) { await sftpClient.end(); sftpClient = null; }
  } catch (e) { }
  currentProtocol = null;
}

ipcMain.handle('ftp:disconnect', async function () {
  await disconnectCurrent();
  return { success: true };
});

ipcMain.handle('ftp:isConnected', function () {
  if (currentProtocol === 'ftp') return ftpClient != null && !ftpClient.closed;
  if (currentProtocol === 'sftp') return sftpClient != null;
  return false;
});

// ─── List directory ───
ipcMain.handle('ftp:listDirectory', async function (_event, remotePath) {
  var items = [];

  if (currentProtocol === 'ftp') {
    if (!ftpClient) throw new Error('Not connected');
    var list = await ftpClient.list(remotePath);
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item.name === '.' || item.name === '..') continue;
      items.push({
        name: item.name,
        fullPath: remotePath.replace(/\/+$/, '') + '/' + item.name,
        isDirectory: item.type === ftp.FileType.Directory,
        size: item.size || 0,
        lastModified: item.modifiedAt ? item.modifiedAt.toISOString() : new Date().toISOString(),
        permissions: item.rawModifiedAt || '',
      });
    }
  } else if (currentProtocol === 'sftp') {
    if (!sftpClient) throw new Error('Not connected');
    var list = await sftpClient.list(remotePath);
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item.name === '.' || item.name === '..') continue;
      items.push({
        name: item.name,
        fullPath: remotePath.replace(/\/+$/, '') + '/' + item.name,
        isDirectory: item.type === 'd',
        size: item.size || 0,
        lastModified: new Date(item.modifyTime).toISOString(),
        permissions: item.rights ? formatSftpPermissions(item.rights, item.type === 'd') : '',
      });
    }
  }

  // Sort: directories first, then by name
  items.sort(function (a, b) {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return items;
});

function formatSftpPermissions(rights, isDir) {
  var prefix = isDir ? 'd' : '-';
  var u = (rights.user || '').replace(/[^rwx]/g, '');
  var g = (rights.group || '').replace(/[^rwx]/g, '');
  var o = (rights.other || '').replace(/[^rwx]/g, '');
  return prefix + padPerm(u) + padPerm(g) + padPerm(o);
}
function padPerm(s) {
  var r = (s.indexOf('r') >= 0) ? 'r' : '-';
  var w = (s.indexOf('w') >= 0) ? 'w' : '-';
  var x = (s.indexOf('x') >= 0) ? 'x' : '-';
  return r + w + x;
}

// ─── Create directory ───
ipcMain.handle('ftp:createDirectory', async function (_event, remotePath) {
  if (currentProtocol === 'ftp') {
    if (!ftpClient) throw new Error('Not connected');
    await ftpClient.ensureDir(remotePath);
    // ensureDir changes cwd, go back
    await ftpClient.cd('/');
  } else if (currentProtocol === 'sftp') {
    if (!sftpClient) throw new Error('Not connected');
    await sftpClient.mkdir(remotePath, true);
  }
});

// ─── Delete directory ───
ipcMain.handle('ftp:deleteDirectory', async function (_event, remotePath) {
  if (currentProtocol === 'ftp') {
    if (!ftpClient) throw new Error('Not connected');
    await ftpClient.removeDir(remotePath);
  } else if (currentProtocol === 'sftp') {
    if (!sftpClient) throw new Error('Not connected');
    await sftpClient.rmdir(remotePath, true);
  }
});

// ─── Delete file ───
ipcMain.handle('ftp:deleteFile', async function (_event, remotePath) {
  if (currentProtocol === 'ftp') {
    if (!ftpClient) throw new Error('Not connected');
    await ftpClient.remove(remotePath);
  } else if (currentProtocol === 'sftp') {
    if (!sftpClient) throw new Error('Not connected');
    await sftpClient.delete(remotePath);
  }
});

// ─── Rename ───
ipcMain.handle('ftp:rename', async function (_event, oldPath, newPath) {
  if (currentProtocol === 'ftp') {
    if (!ftpClient) throw new Error('Not connected');
    await ftpClient.rename(oldPath, newPath);
  } else if (currentProtocol === 'sftp') {
    if (!sftpClient) throw new Error('Not connected');
    await sftpClient.rename(oldPath, newPath);
  }
});

// ─── Upload file ───
ipcMain.handle('ftp:uploadFile', async function (_event, localPath, remotePath, transferId) {
  var totalSize = fs.statSync(localPath).size;
  sendTransferProgress(transferId, 0, totalSize, 'inProgress');

  try {
    if (currentProtocol === 'ftp') {
      if (!ftpClient) throw new Error('Not connected');
      ftpClient.trackProgress(function (info) {
        sendTransferProgress(transferId, info.bytesOverall, totalSize, 'inProgress');
      });
      await ftpClient.uploadFrom(localPath, remotePath);
      ftpClient.trackProgress(undefined);
    } else if (currentProtocol === 'sftp') {
      if (!sftpClient) throw new Error('Not connected');
      await sftpClient.fastPut(localPath, remotePath, {
        step: function (totalTransferred, chunk, total) {
          sendTransferProgress(transferId, totalTransferred, total, 'inProgress');
        }
      });
    }

    // Verify file size
    var remoteSize = await getRemoteFileSize(remotePath);
    if (remoteSize >= 0 && remoteSize !== totalSize) {
      sendTransferProgress(transferId, totalSize, totalSize, 'completed');
      return { warning: '파일 크기 불일치 - 로컬: ' + totalSize + ', 리모트: ' + remoteSize };
    }

    sendTransferProgress(transferId, totalSize, totalSize, 'completed');
    return { success: true };
  } catch (err) {
    sendTransferProgress(transferId, 0, totalSize, 'failed', err.message);
    throw err;
  }
});

// ─── Download file ───
ipcMain.handle('ftp:downloadFile', async function (_event, remotePath, localPath, transferId) {
  var totalSize = await getRemoteFileSize(remotePath);
  sendTransferProgress(transferId, 0, totalSize, 'inProgress');

  try {
    if (currentProtocol === 'ftp') {
      if (!ftpClient) throw new Error('Not connected');
      ftpClient.trackProgress(function (info) {
        sendTransferProgress(transferId, info.bytesOverall, totalSize, 'inProgress');
      });
      await ftpClient.downloadTo(localPath, remotePath);
      ftpClient.trackProgress(undefined);
    } else if (currentProtocol === 'sftp') {
      if (!sftpClient) throw new Error('Not connected');
      await sftpClient.fastGet(remotePath, localPath, {
        step: function (totalTransferred, chunk, total) {
          sendTransferProgress(transferId, totalTransferred, total, 'inProgress');
        }
      });
    }

    // Verify file size
    var localSize = fs.statSync(localPath).size;
    if (totalSize >= 0 && localSize !== totalSize) {
      sendTransferProgress(transferId, localSize, totalSize, 'completed');
      return { warning: '파일 크기 불일치 - 로컬: ' + localSize + ', 리모트: ' + totalSize };
    }

    sendTransferProgress(transferId, localSize, localSize, 'completed');
    return { success: true };
  } catch (err) {
    sendTransferProgress(transferId, 0, totalSize, 'failed', err.message);
    throw err;
  }
});

async function getRemoteFileSize(remotePath) {
  try {
    if (currentProtocol === 'ftp') {
      return await ftpClient.size(remotePath);
    } else if (currentProtocol === 'sftp') {
      var stat = await sftpClient.stat(remotePath);
      return stat.size;
    }
  } catch (e) { }
  return -1;
}

function sendTransferProgress(transferId, bytesTransferred, totalBytes, status, errorMessage) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('transfer:progress', {
      transferId: transferId,
      bytesTransferred: bytesTransferred,
      totalBytes: totalBytes,
      status: status,
      errorMessage: errorMessage || '',
    });
  }
}

// ─── Ensure directory exists ───
ipcMain.handle('ftp:ensureDirectory', async function (_event, remotePath) {
  if (currentProtocol === 'ftp') {
    if (!ftpClient) throw new Error('Not connected');
    await ftpClient.ensureDir(remotePath);
    await ftpClient.cd('/');
  } else if (currentProtocol === 'sftp') {
    if (!sftpClient) throw new Error('Not connected');
    await sftpClient.mkdir(remotePath, true);
  }
});

// ─── Get remote file size ───
ipcMain.handle('ftp:getFileSize', async function (_event, remotePath) {
  return await getRemoteFileSize(remotePath);
});

// ─── Local file operations ───
ipcMain.handle('local:listDirectory', function (_event, dirPath) {
  var result = [];
  var entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    try {
      var fullPath = path.join(dirPath, entry.name);
      var stats = fs.statSync(fullPath);
      result.push({
        name: entry.name,
        fullPath: fullPath,
        isDirectory: entry.isDirectory(),
        size: entry.isDirectory() ? 0 : stats.size,
        lastModified: stats.mtime.toISOString(),
      });
    } catch (e) {
      // Skip inaccessible files
    }
  }

  result.sort(function (a, b) {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
});

ipcMain.handle('local:getDrives', function () {
  // Windows drives
  var drives = [];
  for (var i = 65; i <= 90; i++) {
    var letter = String.fromCharCode(i) + ':\\';
    try {
      fs.accessSync(letter);
      drives.push(letter);
    } catch (e) { }
  }
  return drives;
});

ipcMain.handle('local:createDirectory', function (_event, dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
});

ipcMain.handle('local:delete', function (_event, targetPath, isDirectory) {
  if (isDirectory) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }
});

ipcMain.handle('local:rename', function (_event, oldPath, newPath) {
  fs.renameSync(oldPath, newPath);
});

ipcMain.handle('local:exists', function (_event, targetPath) {
  return fs.existsSync(targetPath);
});

ipcMain.handle('local:getFileSize', function (_event, filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (e) { return -1; }
});

ipcMain.handle('local:getHomePath', function () {
  return require('os').homedir();
});

ipcMain.handle('local:collectFiles', function (_event, dirPath) {
  var files = [];
  var dirs = [];
  collectLocalFilesRecursive(dirPath, files, dirs);
  return { files: files, dirs: dirs };
});

function collectLocalFilesRecursive(dirPath, files, dirs) {
  try {
    var entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      var fullPath = path.join(dirPath, entries[i].name);
      if (entries[i].isDirectory()) {
        dirs.push(fullPath);
        collectLocalFilesRecursive(fullPath, files, dirs);
      } else {
        try {
          files.push({ path: fullPath, size: fs.statSync(fullPath).size });
        } catch (e) { }
      }
    }
  } catch (e) { }
}

// ─── Remote recursive list (for download) ───
ipcMain.handle('ftp:listRecursive', async function (_event, remotePath) {
  var files = [];
  var dirs = [];
  await collectRemoteFilesRecursive(remotePath, files, dirs);
  return { files: files, dirs: dirs };
});

async function collectRemoteFilesRecursive(remotePath, files, dirs) {
  var items;
  if (currentProtocol === 'ftp') {
    items = await ftpClient.list(remotePath);
  } else {
    items = await sftpClient.list(remotePath);
  }

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.name === '.' || item.name === '..') continue;
    var fullPath = remotePath.replace(/\/+$/, '') + '/' + item.name;
    var isDir = currentProtocol === 'ftp' ? item.type === ftp.FileType.Directory : item.type === 'd';
    if (isDir) {
      dirs.push(fullPath);
      await collectRemoteFilesRecursive(fullPath, files, dirs);
    } else {
      files.push({ path: fullPath, size: item.size || 0 });
    }
  }
}

// ─── Profile persistence ───
function getProfilesPath() { return path.join(DATA_DIR, 'profiles.json'); }
function getBookmarksPath() { return path.join(DATA_DIR, 'bookmarks.json'); }

ipcMain.handle('profiles:load', function () {
  try {
    if (fs.existsSync(getProfilesPath())) {
      return JSON.parse(fs.readFileSync(getProfilesPath(), 'utf8'));
    }
  } catch (e) { }
  return [];
});

ipcMain.handle('profiles:save', function (_event, profiles) {
  fs.writeFileSync(getProfilesPath(), JSON.stringify(profiles, null, 2), 'utf8');
});

// ─── Bookmark persistence ───
ipcMain.handle('bookmarks:load', function () {
  try {
    if (fs.existsSync(getBookmarksPath())) {
      return JSON.parse(fs.readFileSync(getBookmarksPath(), 'utf8'));
    }
  } catch (e) { }
  return [];
});

ipcMain.handle('bookmarks:save', function (_event, bookmarks) {
  fs.writeFileSync(getBookmarksPath(), JSON.stringify(bookmarks, null, 2), 'utf8');
});

// ─── Dialog: Browse for private key ───
ipcMain.handle('dialog:openKeyFile', async function () {
  var result = await dialog.showOpenDialog(mainWindow, {
    title: '개인키 파일 선택',
    filters: [
      { name: '키 파일', extensions: ['pem', 'ppk', 'key', 'pub'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ─── Dialog: Browse for local directory ───
ipcMain.handle('dialog:openDirectory', async function () {
  var result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ─── Banner ads ───
ipcMain.handle('banner:fetch', async function () {
  return new Promise(function (resolve, reject) {
    var url = 'http://wontherads.cafe24.com/api/banner/list?platformCode=WIN_APP&placementCode=WIN_APP_BOTTOM';
    var request = net.request(url);
    var body = '';
    request.on('response', function (response) {
      response.on('data', function (chunk) { body += chunk.toString(); });
      response.on('end', function () {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Banner JSON parse error')); }
      });
    });
    request.on('error', function (err) { reject(err); });
    request.end();
  });
});

ipcMain.handle('shell:openExternal', async function (_event, url) {
  await shell.openExternal(url);
});
