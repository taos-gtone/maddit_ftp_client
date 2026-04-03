import { useState } from 'react';
import type { ProtocolType } from '../types/index';

interface Props {
  isConnected: boolean;
  onConnect: (host: string, port: number, username: string, password: string, protocol: ProtocolType) => void;
  onDisconnect: () => void;
  onOpenConnectionManager: () => void;
}

export default function QuickConnect({ isConnected, onConnect, onDisconnect, onOpenConnectionManager }: Props) {
  const [protocol, setProtocol] = useState<ProtocolType>('sftp');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState(22);

  function handleProtocolChange(p: ProtocolType) {
    setProtocol(p);
    setPort(p === 'sftp' ? 22 : 21);
  }

  function handleConnect() {
    if (!host.trim()) return;
    onConnect(host, port, username, password, protocol);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConnect();
  }

  return (
    <div className="h-8 bg-border-light border-b border-border flex items-center px-2 gap-0 text-xs">
      <label className="text-text-sub whitespace-nowrap mr-1">프로토콜:</label>
      <select
        value={protocol}
        onChange={e => handleProtocolChange(e.target.value as ProtocolType)}
        className="h-[22px] px-1 border border-border rounded-sm bg-white text-xs mr-3"
        disabled={isConnected}
      >
        <option value="sftp">SFTP</option>
        <option value="ftp">FTP</option>
      </select>

      <label className="text-text-sub whitespace-nowrap mr-1">호스트:</label>
      <input
        type="text"
        value={host}
        onChange={e => setHost(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isConnected}
        className="h-[22px] px-1.5 border border-border rounded-sm bg-white text-xs w-40 mr-3"
      />

      <label className="text-text-sub whitespace-nowrap mr-1">사용자:</label>
      <input
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isConnected}
        className="h-[22px] px-1.5 border border-border rounded-sm bg-white text-xs w-24 mr-3"
      />

      <label className="text-text-sub whitespace-nowrap mr-1">비밀번호:</label>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isConnected}
        className="h-[22px] px-1.5 border border-border rounded-sm bg-white text-xs w-28 mr-3"
      />

      <label className="text-text-sub whitespace-nowrap mr-1">포트:</label>
      <input
        type="number"
        value={port}
        onChange={e => setPort(parseInt(e.target.value) || 0)}
        onKeyDown={handleKeyDown}
        disabled={isConnected}
        className="h-[22px] px-1.5 border border-border rounded-sm bg-white text-xs w-12 text-center mr-3"
      />

      <button
        onClick={onOpenConnectionManager}
        className="h-[22px] px-2.5 bg-surface border border-border rounded-sm hover:bg-hover text-text text-xs mr-1.5 whitespace-nowrap"
      >
        연결 관리자
      </button>

      {!isConnected ? (
        <button
          onClick={handleConnect}
          disabled={!host.trim()}
          className="h-[22px] px-3 bg-primary text-white rounded-sm text-xs hover:bg-primary-hover disabled:opacity-50 whitespace-nowrap"
        >
          빠른 연결
        </button>
      ) : (
        <button
          onClick={onDisconnect}
          className="h-[22px] px-3 bg-error text-white rounded-sm text-xs hover:opacity-90 whitespace-nowrap"
        >
          연결 해제
        </button>
      )}
    </div>
  );
}
