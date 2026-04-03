import { useState, useEffect } from 'react';
import type { ConnectionProfile, ProtocolType, AuthMethod } from '../types/index';

function newProfile(): ConnectionProfile {
  return {
    id: crypto.randomUUID(),
    name: '새 연결',
    host: '',
    port: 22,
    protocol: 'sftp',
    username: '',
    password: '',
    authMethod: 'password',
    privateKeyPath: '',
    privateKeyPassphrase: '',
    initialRemotePath: '/',
    initialLocalPath: '',
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (profile: ConnectionProfile) => void;
}

export default function ConnectionManager({ isOpen, onClose, onConnect }: Props) {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = profiles.find(p => p.id === selectedId) || null;

  useEffect(() => {
    if (isOpen) {
      window.electronAPI.loadProfiles().then(data => {
        setProfiles(data);
        if (data.length > 0) setSelectedId(data[0].id);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function updateSelected(updates: Partial<ConnectionProfile>) {
    if (!selectedId) return;
    setProfiles(prev => prev.map(p => p.id === selectedId ? { ...p, ...updates } : p));
  }

  function handleProtocolChange(protocol: ProtocolType) {
    updateSelected({ protocol, port: protocol === 'sftp' ? 22 : 21 });
  }

  function handleAuthMethodChange(authMethod: AuthMethod) {
    updateSelected({ authMethod });
  }

  function addProfile() {
    const p = newProfile();
    setProfiles(prev => [...prev, p]);
    setSelectedId(p.id);
  }

  function deleteProfile() {
    if (!selectedId) return;
    const filtered = profiles.filter(p => p.id !== selectedId);
    setProfiles(filtered);
    setSelectedId(filtered.length > 0 ? filtered[0].id : null);
  }

  async function saveAll() {
    await window.electronAPI.saveProfiles(profiles);
  }

  async function handleConnect() {
    if (!selected) return;
    await saveAll();
    onConnect(selected);
    onClose();
  }

  async function handleClose() {
    await saveAll();
    onClose();
  }

  async function browseKey() {
    const result = await window.electronAPI.openKeyFileDialog();
    if (result) updateSelected({ privateKeyPath: result });
  }

  async function browseLocalDir() {
    const result = await window.electronAPI.openDirectoryDialog();
    if (result) updateSelected({ initialLocalPath: result });
  }

  const showPrivateKey = selected?.authMethod === 'privateKey' || selected?.authMethod === 'passwordAndKey';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-lg border border-border w-[640px] h-[440px] flex flex-col">
        {/* Title */}
        <div className="h-9 bg-surface border-b border-border flex items-center px-4 rounded-t-md">
          <span className="text-sm font-bold text-text">연결 관리자</span>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Profile list */}
          <div className="w-48 border-r border-border flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto">
              {profiles.map(p => (
                <div
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`h-8 flex items-center px-3 text-xs cursor-pointer border-b border-border-light
                    ${p.id === selectedId ? 'bg-selection font-semibold' : 'hover:bg-hover'}`}
                >
                  {p.name || '(이름 없음)'}
                </div>
              ))}
            </div>
            <div className="h-8 border-t border-border flex items-center px-2 gap-1 shrink-0">
              <button onClick={addProfile} className="text-xs px-2 py-0.5 hover:bg-hover rounded-sm">+ 추가</button>
              <button onClick={deleteProfile} className="text-xs px-2 py-0.5 hover:bg-hover rounded-sm text-error" disabled={!selectedId}>삭제</button>
            </div>
          </div>

          {/* Profile editor */}
          <div className="flex-1 p-4 overflow-y-auto">
            {selected ? (
              <div className="grid grid-cols-[80px_1fr] gap-y-2 gap-x-3 text-xs">
                <label className="text-text-sub pt-1">이름</label>
                <input value={selected.name} onChange={e => updateSelected({ name: e.target.value })}
                  className="h-6 px-2 border border-border rounded-sm" />

                <label className="text-text-sub pt-1">프로토콜</label>
                <select value={selected.protocol} onChange={e => handleProtocolChange(e.target.value as ProtocolType)}
                  className="h-6 px-1 border border-border rounded-sm bg-white">
                  <option value="sftp">SFTP</option>
                  <option value="ftp">FTP</option>
                </select>

                <label className="text-text-sub pt-1">호스트</label>
                <input value={selected.host} onChange={e => updateSelected({ host: e.target.value })}
                  className="h-6 px-2 border border-border rounded-sm" />

                <label className="text-text-sub pt-1">포트</label>
                <input type="number" value={selected.port} onChange={e => updateSelected({ port: parseInt(e.target.value) || 0 })}
                  className="h-6 px-2 border border-border rounded-sm w-20" />

                <label className="text-text-sub pt-1">사용자명</label>
                <input value={selected.username} onChange={e => updateSelected({ username: e.target.value })}
                  className="h-6 px-2 border border-border rounded-sm" />

                <label className="text-text-sub pt-1">인증 방식</label>
                <select value={selected.authMethod} onChange={e => handleAuthMethodChange(e.target.value as AuthMethod)}
                  className="h-6 px-1 border border-border rounded-sm bg-white">
                  <option value="password">비밀번호</option>
                  <option value="privateKey">개인키</option>
                  <option value="passwordAndKey">비밀번호 + 개인키</option>
                </select>

                <label className="text-text-sub pt-1">비밀번호</label>
                <input type="password" value={selected.password} onChange={e => updateSelected({ password: e.target.value })}
                  className="h-6 px-2 border border-border rounded-sm" />

                {showPrivateKey && (
                  <>
                    <label className="text-text-sub pt-1">개인키 파일</label>
                    <div className="flex gap-1">
                      <input value={selected.privateKeyPath} onChange={e => updateSelected({ privateKeyPath: e.target.value })}
                        className="flex-1 h-6 px-2 border border-border rounded-sm" readOnly />
                      <button onClick={browseKey} className="h-6 px-2 bg-surface border border-border rounded-sm hover:bg-hover">찾기</button>
                    </div>

                    <label className="text-text-sub pt-1">키 패스프레이즈</label>
                    <input type="password" value={selected.privateKeyPassphrase}
                      onChange={e => updateSelected({ privateKeyPassphrase: e.target.value })}
                      className="h-6 px-2 border border-border rounded-sm" />
                  </>
                )}

                <label className="text-text-sub pt-1">초기 리모트 경로</label>
                <input value={selected.initialRemotePath} onChange={e => updateSelected({ initialRemotePath: e.target.value })}
                  className="h-6 px-2 border border-border rounded-sm" />

                <label className="text-text-sub pt-1">초기 로컬 경로</label>
                <div className="flex gap-1">
                  <input value={selected.initialLocalPath} onChange={e => updateSelected({ initialLocalPath: e.target.value })}
                    className="flex-1 h-6 px-2 border border-border rounded-sm" />
                  <button onClick={browseLocalDir} className="h-6 px-2 bg-surface border border-border rounded-sm hover:bg-hover">찾기</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">
                연결 프로필을 선택하거나 추가하세요
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 border-t border-border flex items-center justify-end px-4 gap-2 shrink-0">
          <button onClick={handleClose}
            className="px-4 py-1.5 bg-surface border border-border rounded-sm text-xs hover:bg-hover">
            닫기
          </button>
          <button onClick={handleConnect} disabled={!selected?.host}
            className="px-4 py-1.5 bg-primary text-white rounded-sm text-xs hover:bg-primary-hover disabled:opacity-50">
            연결
          </button>
        </div>
      </div>
    </div>
  );
}
