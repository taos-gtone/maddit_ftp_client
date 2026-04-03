import { useState, useEffect, useRef } from 'react';

interface Props {
  title: string;
  message: string;
  defaultValue?: string;
  isOpen: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function InputDialog({ title, message, defaultValue = '', isOpen, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && value.trim()) onConfirm(value.trim());
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-lg border border-border w-80 p-4">
        <h3 className="text-sm font-bold text-text mb-2">{title}</h3>
        <p className="text-xs text-text-sub mb-3">{message}</p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-7 px-2 border border-border rounded-sm text-xs mb-3"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-surface border border-border rounded-sm text-xs hover:bg-hover"
          >
            취소
          </button>
          <button
            onClick={() => value.trim() && onConfirm(value.trim())}
            disabled={!value.trim()}
            className="px-3 py-1 bg-primary text-white rounded-sm text-xs hover:bg-primary-hover disabled:opacity-50"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
