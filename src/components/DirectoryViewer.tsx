import { useState, useEffect } from 'react';
import { Folder, File as FileIcon, HardDrive, ArrowUp, X, Check } from 'lucide-react';

interface DirectoryViewerProps {
  baseUrl: string;
  mode: 'folder' | 'gguf';
  onSelect: (path: string) => void;
  onCancel: () => void;
}

interface DirEntry {
  name: string;
  path: string;
  type: 'drive' | 'folder' | 'file';
  ext?: string;
}

export default function DirectoryViewer({ baseUrl, mode, onSelect, onCancel }: DirectoryViewerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDir = async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${baseUrl}/api/listdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.detail || data.error || `HTTP Error ${res.status}`);
      } else if (data.error) {
        setError(data.error);
      } else {
        setEntries(data.entries || []);
        setCurrentPath(data.current_path || '');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDir(''); // 初回はドライブ一覧
  }, [baseUrl]);

  const handleUp = () => {
    if (!currentPath) return;
    // C:\ => "" に戻る
    if (currentPath.length <= 3 && currentPath.endsWith(':\\')) {
      fetchDir('');
      return;
    }
    const parts = currentPath.replace(/\\$/, '').split('\\');
    parts.pop();
    const parent = parts.join('\\') + (parts.length === 1 ? '\\' : '');
    fetchDir(parent);
  };

  const handleEntryClick = (entry: DirEntry) => {
    if (entry.type === 'drive' || entry.type === 'folder') {
      fetchDir(entry.path);
    } else if (entry.type === 'file' && mode === 'gguf' && entry.ext === '.gguf') {
      onSelect(entry.path);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="glass-panel" style={{ width: '90%', maxWidth: '600px', height: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{mode === 'folder' ? 'フォルダを選択' : 'GGUFファイルを選択'}</h3>
          <button className="btn btn-icon" onClick={onCancel}><X size={20} /></button>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
          <button className="btn btn-glass" style={{ padding: '6px 12px' }} onClick={handleUp} disabled={!currentPath}>
            <ArrowUp size={16} />
          </button>
          <input 
            type="text" 
            className="btn btn-glass" 
            style={{ flex: 1, cursor: 'text' }} 
            value={currentPath || 'PC'} 
            readOnly 
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
          ) : error ? (
            <div style={{ color: '#ef4444', padding: '20px' }}>Error: {error}</div>
          ) : entries.length === 0 ? (
            <div style={{ color: '#9ca3af', padding: '20px', textAlign: 'center' }}>空です</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {entries.map(entry => {
                const isSelectableGguf = mode === 'gguf' && entry.type === 'file' && entry.ext === '.gguf';
                const isFile = entry.type === 'file';
                const disabled = isFile && !isSelectableGguf;

                return (
                  <div 
                    key={entry.path}
                    onClick={() => { if (!disabled) handleEntryClick(entry) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.3 : 1,
                      borderRadius: '4px'
                    }}
                    onMouseEnter={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    {entry.type === 'drive' ? <HardDrive size={18} color="#9ca3af" /> : 
                     entry.type === 'folder' ? <Folder size={18} color="#60a5fa" /> : 
                     <FileIcon size={18} color="#9ca3af" />}
                    <span style={{ flex: 1, userSelect: 'none' }}>{entry.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {mode === 'folder' && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              選択: {currentPath || '未選択'}
            </span>
            <button 
              className="btn btn-primary" 
              disabled={!currentPath}
              onClick={() => onSelect(currentPath)}
            >
              <Check size={18} style={{ marginRight: '8px' }} /> このフォルダを決定
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
