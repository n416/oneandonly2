import { useState, useEffect, useRef } from 'react';
import { LLMConfig } from '../hooks/useLLM';
import { exportAllData, importAllData, clearAllData } from '../lib/indexedDB';
import { useUI } from '../contexts/UIContext';
import { Download, Upload } from 'lucide-react';

export default function Settings() {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'gemini',
    geminiApiKey: '',
    localEndpoint: 'http://127.0.0.1:8000/api/chat-stream',
  });
  const [saveMessage, setSaveMessage] = useState('');
  const [bgmEnabled, setBgmEnabled] = useState(() => localStorage.getItem('bgmStopped') !== 'true');
  
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
            onChange={e => setConfig({ ...config, provider: e.target.value as 'gemini' | 'local' })}
          >
            <option value="gemini">Google Gemini 2.5 Flash (推奨・無料)</option>
            <option value="local">Local LLM (llm-api / Ollama)</option>
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
          <div className="fade-in">
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Local LLM エンドポイント</label>
            <input 
              type="text" 
              className="btn btn-glass" 
              style={{ width: '100%', textAlign: 'left', cursor: 'text' }}
              value={config.localEndpoint || ''}
              onChange={e => setConfig({ ...config, localEndpoint: e.target.value })}
              placeholder="http://127.0.0.1:8000/api/chat-stream"
            />
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '8px' }}>
              ※ Ollamaを使用する場合は `http://127.0.0.1:11434/api/chat` 等に変更してください。
            </p>
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
    </div>
  );
}
