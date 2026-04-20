import { useState, useEffect, useRef } from 'react';
import { LLMConfig, Provider } from '../hooks/useLLM';
import { exportAllData, importAllData, clearAllData } from '../lib/indexedDB';
import { useUI } from '../contexts/UIContext';
import { Download, Upload, FolderOpen, File, RefreshCw } from 'lucide-react';
import DirectoryViewer from '../components/DirectoryViewer';

export default function Settings() {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'gemini',
    geminiApiKey: '',
    localEndpoint: 'http://127.0.0.1:8000/api/chat-stream',
  });
  const [saveMessage, setSaveMessage] = useState('');
  const [bgmEnabled, setBgmEnabled] = useState(() => localStorage.getItem('bgmStopped') !== 'true');
  
  // Local LLM API Status
  const [localApiStatus, setLocalApiStatus] = useState<'offline' | 'unloaded' | 'loading' | 'ready' | 'error'>('offline');
  const [loadedModelPath, setLoadedModelPath] = useState('');
  const [loadErrorMsg, setLoadErrorMsg] = useState('');
  const [serverModels, setServerModels] = useState<{name: string, path: string, type: string}[]>([]);
  const [ollamaModels, setOllamaModels] = useState<{name: string}[]>([]);
  
  const [showDirViewer, setShowDirViewer] = useState(false);
  const [dirViewerMode, setDirViewerMode] = useState<'gguf'|'folder'>('gguf');
  
  const { toast, confirm } = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('llm_config');
      if (stored) {
        setConfig(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Status polling effect
  useEffect(() => {
    if (config.provider !== 'local') return;
    
    let isSubscribed = true;
    const checkStatus = async () => {
      try {
        const baseUrl = config.localEndpoint?.replace('/api/chat-stream', '') || 'http://127.0.0.1:8000';
        const res = await fetch(`${baseUrl}/api/status`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setLocalApiStatus(data.status || 'unloaded');
            setLoadedModelPath(data.model_path || '');
            setLoadErrorMsg(data.error_msg || '');
          }
          
          if (isSubscribed && serverModels.length === 0) {
            fetch(`${baseUrl}/api/models`).then(r => r.json()).then(d => {
              if (isSubscribed && d.models) setServerModels(d.models);
            }).catch(e => console.warn('Failed to fetch models list', e));
          }
        } else {
          if (isSubscribed) setLocalApiStatus('offline');
        }
      } catch (e) {
        if (isSubscribed) setLocalApiStatus('offline');
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [config.provider, config.localEndpoint, serverModels.length]);

  // Ollama models fetch effect
  useEffect(() => {
    if (config.provider !== 'ollama') return;
    
    let isSubscribed = true;
    const fetchOllamaModels = async () => {
      try {
        const endpoint = config.localEndpoint || 'http://127.0.0.1:11434/api/chat';
        const baseUrl = endpoint.replace(/\/api\/chat\/?$/, '');
        const res = await fetch(`${baseUrl}/api/tags`);
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed && data.models) setOllamaModels(data.models);
        }
      } catch (e) {
        console.warn('Failed to fetch ollama models', e);
      }
    };
    fetchOllamaModels();
    return () => { isSubscribed = false; };
  }, [config.provider, config.localEndpoint]);

  const handleSelectModel = (type: 'gguf' | 'folder') => {
    setDirViewerMode(type);
    setShowDirViewer(true);
  };

  const handleDirViewerSelect = (path: string) => {
    setConfig(prev => ({ ...prev, localModelPath: path }));
    setShowDirViewer(false);
  };

  const handleLoadModel = async () => {
    if (!config.localModelPath) {
      toast('モデルパスを選択してください', 'error');
      return;
    }
    
    try {
      setLocalApiStatus('loading');
      const baseUrl = config.localEndpoint?.replace('/api/chat-stream', '') || 'http://127.0.0.1:8000';
      const res = await fetch(`${baseUrl}/api/load-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_path: config.localModelPath })
      });
      if (!res.ok) throw new Error(await res.text());
      toast('モデルのロードを開始しました。完了までお待ちください。', 'success');
    } catch (e: any) {
      console.error(e);
      toast('ロードリクエストに失敗: ' + e.message, 'error');
    }
  };

  const handleSave = () => {
    localStorage.setItem('llm_config', JSON.stringify(config));
    localStorage.setItem('bgmStopped', (!bgmEnabled).toString());
    window.dispatchEvent(new CustomEvent('bgm-toggle'));
    setSaveMessage('設定を保存しました。');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleExport = async () => {
    try {
      const dataStr = await exportAllData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oneandonly2_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('データをエクスポートしました', 'success');
    } catch (e: any) {
      console.error(e);
      toast('エクスポートに失敗しました: ' + e.message, 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = await confirm('インポートすると現在のデータは全て上書きされます。よろしいですか？');
    if (!ok) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const text = await file.text();
      await importAllData(text);
      toast('データをインポートしました！再読み込みしてください。', 'success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error(err);
      toast('インポートに失敗しました: ' + err.message, 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearData = async () => {
    const ok = await confirm('【警告】すべてのシナリオ、キャラクター、設定データが完全に消去されます。この操作は取り消せません。本当によろしいですか？');
    if (!ok) return;

    try {
      await clearAllData();
      toast('すべてのデータを消去しました。アプリケーションを再読み込みします。', 'success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error(err);
      toast('データの消去に失敗しました: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      <header>
        <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '8px' }}>API設定</h1>
        <p className="text-secondary">バックエンドサーバーとの通信設定を行います。無料で高性能なGemini APIの使用を推奨します。</p>
      </header>

      <div className="glass-panel" style={{ padding: '24px', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>LLM プロバイダー</label>
          <select 
            className="btn btn-glass" 
            style={{ width: '100%', textAlign: 'left', appearance: 'auto', background: 'var(--bg-base)' }}
            value={config.provider}
            onChange={e => setConfig({ ...config, provider: e.target.value as Provider })}
          >
            <option value="gemini">Google Gemini 2.5 Flash (推奨・無料)</option>
            <option value="ollama">Ollama (ローカル)</option>
            <option value="local">llm-api (高度なローカル)</option>
          </select>
        </div>

        {config.provider === 'gemini' && (
          <div className="fade-in">
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Gemini API キー</label>
            <input 
              type="password" 
              className="btn btn-glass" 
              style={{ width: '100%', textAlign: 'left', cursor: 'text' }}
              value={config.geminiApiKey || ''}
              onChange={e => setConfig({ ...config, geminiApiKey: e.target.value })}
              placeholder="AIzaSy..."
            />
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '8px' }}>
              ※ Google AI Studioから無料で取得できるAPIキーを入力してください。<br/>
              キーはブラウザ内部（localStorage）にのみ保存され、外部に送信されることはありません。
            </p>
          </div>
        )}

        <div className="fade-in">
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Stability AI API キー (画像生成用・任意)</label>
          <input 
            type="password" 
            className="btn btn-glass" 
            style={{ width: '100%', textAlign: 'left', cursor: 'text' }}
            value={localStorage.getItem('stabilityApiKey') || ''}
            onChange={e => localStorage.setItem('stabilityApiKey', e.target.value)}
            placeholder="sk-..."
          />
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '8px' }}>
            ※ キャラクターやアイテムの画像を生成する場合に必要です。未設定の場合はダミー画像や背景色が使用されます。
          </p>
        </div>

        {config.provider === 'local' && (
          <div className="fade-in glass-panel" style={{ padding: '16px', background: 'rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>llm-api 設定</h3>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>エンドポイント</label>
            <input 
              type="text" 
              className="btn btn-glass" 
              style={{ width: '100%', textAlign: 'left', cursor: 'text', marginBottom: '16px' }}
              value={config.localEndpoint || 'http://127.0.0.1:8000/api/chat-stream'}
              onChange={e => setConfig({ ...config, localEndpoint: e.target.value })}
              placeholder="http://127.0.0.1:8000/api/chat-stream"
            />

            {localApiStatus === 'offline' ? (
              <div style={{ color: '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={16} /> サーバーが応答しません。起動しているか確認してください。
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ 
                    display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: localApiStatus === 'ready' ? '#10b981' : localApiStatus === 'loading' ? '#f59e0b' : localApiStatus === 'error' ? '#ef4444' : '#6b7280'
                  }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    状態: {localApiStatus.toUpperCase()}
                  </span>
                  {localApiStatus === 'loading' && <RefreshCw size={16} className="spin" />}
                </div>

                {loadedModelPath && (
                  <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '16px', wordBreak: 'break-all' }}>
                    ロード済み: {loadedModelPath}
                  </div>
                )}
                {loadErrorMsg && (
                  <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '16px' }}>
                    エラー: {loadErrorMsg}
                  </div>
                )}

                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>モデルを選択してロード</label>
                
                {serverModels.length > 0 && (
                  <select
                    className="btn btn-glass"
                    style={{ width: '100%', textAlign: 'left', appearance: 'auto', background: 'var(--bg-base)', marginBottom: '8px' }}
                    value={config.localModelPath || ''}
                    onChange={e => setConfig({ ...config, localModelPath: e.target.value })}
                  >
                    <option value="">-- サーバー上のモデルから選択 --</option>
                    {serverModels.map(m => (
                      <option key={m.path} value={m.path}>{m.name} ({m.type})</option>
                    ))}
                  </select>
                )}

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button className="btn btn-glass" style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }} onClick={() => handleSelectModel('gguf')}>
                    <File size={16} style={{ marginRight: '8px' }}/> PCからGGUF
                  </button>
                  <button className="btn btn-glass" style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }} onClick={() => handleSelectModel('folder')}>
                    <FolderOpen size={16} style={{ marginRight: '8px' }}/> PCからフォルダ
                  </button>
                </div>
                
                <input 
                  type="text" 
                  className="btn btn-glass" 
                  style={{ width: '100%', textAlign: 'left', cursor: 'text', marginBottom: '8px' }}
                  value={config.localModelPath || ''}
                  onChange={e => setConfig({ ...config, localModelPath: e.target.value })}
                  placeholder={serverModels.length > 0 ? "またはフルパスを手動入力..." : "モデルのパスを手動入力..."}
                />

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '8px' }}
                  onClick={handleLoadModel}
                  disabled={localApiStatus === 'loading'}
                >
                  <RefreshCw size={16} style={{ marginRight: '8px' }}/> サーバーへロード
                </button>
              </>
            )}
          </div>
        )}

        {config.provider === 'ollama' && (
          <div className="fade-in glass-panel" style={{ padding: '16px', background: 'rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Ollama 設定</h3>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>エンドポイント</label>
            <input 
              type="text" 
              className="btn btn-glass" 
              style={{ width: '100%', textAlign: 'left', cursor: 'text', marginBottom: '16px' }}
              value={config.localEndpoint || 'http://127.0.0.1:11434/api/chat'}
              onChange={e => setConfig({ ...config, localEndpoint: e.target.value })}
              placeholder="http://127.0.0.1:11434/api/chat"
            />
            
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>モデル名</label>
            {ollamaModels.length > 0 && (
              <select
                className="btn btn-glass"
                style={{ width: '100%', textAlign: 'left', appearance: 'auto', background: 'var(--bg-base)', marginBottom: '8px' }}
                value={config.ollamaModel || ''}
                onChange={e => setConfig({ ...config, ollamaModel: e.target.value })}
              >
                <option value="">-- インストール済みモデルから選択 --</option>
                {ollamaModels.map(m => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            )}
            <input 
              type="text" 
              className="btn btn-glass" 
              style={{ width: '100%', textAlign: 'left', cursor: 'text' }}
              value={config.ollamaModel || ''}
              onChange={e => setConfig({ ...config, ollamaModel: e.target.value })}
              placeholder={ollamaModels.length > 0 ? "またはモデル名を手動入力..." : "llama3, gemma, etc..."}
            />
          </div>
        )}

        <div className="fade-in">
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>BGMの再生</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className={`btn ${bgmEnabled ? 'btn-primary' : 'btn-glass'}`} 
              onClick={() => setBgmEnabled(true)}
            >
              ON
            </button>
            <button 
              className={`btn ${!bgmEnabled ? 'btn-primary' : 'btn-glass'}`} 
              style={!bgmEnabled ? { backgroundColor: '#f44336' } : {}}
              onClick={() => setBgmEnabled(false)}
            >
              OFF
            </button>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            設定を保存
          </button>
          {saveMessage && <span style={{ color: '#10b981', fontSize: '0.9rem' }}>{saveMessage}</span>}
        </div>
      </div>

      <header style={{ marginTop: '24px' }}>
        <h2 className="text-display" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>データ管理</h2>
        <p className="text-secondary">アプリケーションの全てのデータをJSON形式でバックアップ・復元します。</p>
      </header>
      
      <div className="glass-panel" style={{ padding: '24px', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={18} style={{ marginRight: '8px' }}/> バックアップを保存
          </button>
          <button className="btn btn-glass" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} style={{ marginRight: '8px' }}/> 復元 (インポート)
          </button>
          <input 
            type="file" 
            accept=".json" 
            style={{ display: 'none' }} 
            ref={fileInputRef}
            onChange={handleImport}
          />
        </div>
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>
          ※ 画像データが含まれるため、プレイ履歴や生成カードが多い場合はファイルサイズが大きくなる可能性があります。
        </p>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />

        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: '#ef4444' }}>初期化 (危険)</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
            アプリケーション内の全てのセーブデータ、キャラクター、設定を消去して初期状態に戻します。
          </p>
          <button 
            className="btn btn-glass" 
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            onClick={handleClearData}
          >
            全データを初期化（消去）
          </button>
        </div>
      </div>

      {showDirViewer && (
        <DirectoryViewer 
          baseUrl={config.localEndpoint?.replace('/api/chat-stream', '') || 'http://127.0.0.1:8000'}
          mode={dirViewerMode}
          onSelect={handleDirViewerSelect}
          onCancel={() => setShowDirViewer(false)}
        />
      )}
    </div>
  );
}
