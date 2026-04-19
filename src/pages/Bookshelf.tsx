import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, Play, Trash2, Edit2, Check, X, Copy, Download, Upload } from 'lucide-react';
import { listAllScenarios, deleteScenarioById, updateScenario, duplicateScenario, exportScenarioAsZip, importScenarioFromZip } from '../lib/indexedDB';
import { useUI } from '../contexts/UIContext';

interface Scenario {
  scenarioId: number;
  title: string;
  wizardData: any;
  createdAt: string;
  updatedAt: string;
  bookShelfFlag?: boolean;
}

export default function Bookshelf() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isDeleting, setIsDeleting] = useState<Scenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [editTempTitle, setEditTempTitle] = useState('');
  const [editTempSummary, setEditTempSummary] = useState('');
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const { toast } = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
        const data = await listAllScenarios();
        const savedOrder = localStorage.getItem('bookshelf_scenario_order');
        if (savedOrder) {
          try {
            const orderArr = JSON.parse(savedOrder);
            data.sort((a, b) => {
              const idxA = orderArr.indexOf(a.scenarioId);
              const idxB = orderArr.indexOf(b.scenarioId);
              if (idxA === -1 && idxB === -1) return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });
          } catch (e) {}
        } else {
          data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
        setScenarios(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!isDeleting) return;
    try {
      await deleteScenarioById(isDeleting.scenarioId);
      setIsDeleting(null);
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast('シナリオの削除に失敗しました: ' + e.message, 'error');
    }
  };

  const startEditing = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setEditTempTitle(scenario.title);
    setEditTempSummary(scenario.wizardData?.scenarioSummary || '');
  };

  const handleSaveEdit = async () => {
    if (!editingScenario) return;
    try {
      const updated = {
        ...editingScenario,
        title: editTempTitle,
        wizardData: {
          ...(editingScenario.wizardData || {}),
          scenarioSummary: editTempSummary
        }
      };
      await updateScenario(updated);
      toast('シナリオ情報を更新しました。', 'success');
      setEditingScenario(null);
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast('更新に失敗しました: ' + e.message, 'error');
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await duplicateScenario(id);
      toast('シナリオを複製しました。', 'success');
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast('複製に失敗しました: ' + e.message, 'error');
    }
  };

  const handleExport = async (id: number, includeImages: boolean) => {
    try {
      const blob = await exportScenarioAsZip(id, includeImages);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scenario_${id}_${includeImages ? 'full' : 'light'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast('エクスポートしました。', 'success');
    } catch (e: any) {
      console.error(e);
      toast('エクスポートに失敗しました: ' + e.message, 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importScenarioFromZip(file);
      toast('シナリオをインポートしました！', 'success');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast('インポートに失敗しました: ' + err.message, 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;
    const newScenarios = [...scenarios];
    const item = newScenarios.splice(draggedItem, 1)[0];
    newScenarios.splice(index, 0, item);
    setDraggedItem(index);
    setScenarios(newScenarios);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
    setDraggedItem(null);
    const orderArr = scenarios.map(s => s.scenarioId);
    localStorage.setItem('bookshelf_scenario_order', JSON.stringify(orderArr));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '8px' }}>本棚・倉庫</h1>
        <p className="text-secondary">シナリオの履歴や、待機中のキャラクター（倉庫）を管理します。</p>
      </header>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button 
          className="btn btn-primary"
        >
          <Book size={18} style={{ marginRight: '8px' }}/>
          本棚 (シナリオ)
        </button>
        <div style={{ flex: 1 }}></div>
        <button 
          className="btn btn-glass"
          onClick={() => fileInputRef.current?.click()}
          title="シナリオZIPをインポート"
        >
          <Upload size={18} />
          <span style={{ marginLeft: '8px', display: 'none', '@media (min-width: 768px)': { display: 'inline' } } as any}>インポート</span>
        </button>
        <input 
          type="file" 
          accept=".zip" 
          style={{ display: 'none' }} 
          ref={fileInputRef}
          onChange={handleImport}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
          {scenarios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)' }}>
              シナリオがありません。「シナリオ作成ウィザード」から新しいシナリオを作成してください。
            </div>
          ) : (
            scenarios.map((s, index) => (
              <div 
                key={s.scenarioId} 
                className="glass-panel" 
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                style={{ 
                  padding: '20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px',
                  cursor: draggedItem !== null ? 'grabbing' : 'grab',
                  transition: 'transform 0.2s ease',
                  transform: draggedItem === index ? 'scale(1.02)' : 'none',
                  boxShadow: draggedItem === index ? '0 10px 25px rgba(0,0,0,0.5)' : 'var(--shadow-md)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    {editingScenario?.scenarioId === s.scenarioId ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input 
                          className="btn-glass" 
                          style={{ fontSize: '1.25rem', padding: '8px', width: '100%' }}
                          value={editTempTitle}
                          onChange={e => setEditTempTitle(e.target.value)}
                          placeholder="シナリオタイトル"
                        />
                        <textarea 
                          className="btn-glass"
                          style={{ fontSize: '0.9rem', padding: '8px', width: '100%', minHeight: '60px', resize: 'vertical' }}
                          value={editTempSummary}
                          onChange={e => setEditTempSummary(e.target.value)}
                          placeholder="シナリオ概要"
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-primary" onClick={handleSaveEdit}><Check size={16} style={{marginRight:'4px'}}/> 保存</button>
                          <button className="btn btn-glass" onClick={() => setEditingScenario(null)}><X size={16} style={{marginRight:'4px'}}/> キャンセル</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <Book size={18} className="text-primary" />
                          <h3 className="text-display" style={{ fontSize: '1.25rem', margin: 0 }}>{s.title}</h3>
                        </div>
                        <p className="text-secondary" style={{ fontSize: '0.85rem', margin: 0 }}>
                          {s.wizardData?.genre ? `ジャンル: ${s.wizardData.genre} | ` : ''}
                          更新日: {new Date(s.updatedAt).toLocaleDateString()}
                        </p>
                        {s.wizardData?.scenarioSummary && (
                          <p style={{ fontSize: '0.9rem', marginTop: '8px', color: 'rgba(255,255,255,0.7)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {s.wizardData.scenarioSummary}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  
                  {editingScenario?.scenarioId !== s.scenarioId && (
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                      <button 
                        className="btn btn-primary"
                        title="読む（プレイ）"
                        onClick={() => navigate(`/play/${s.scenarioId}`)}
                      >
                        <Play size={16} style={{ marginRight: '4px' }}/> 読む
                      </button>
                      <button 
                        className="btn btn-glass"
                        onClick={() => handleDuplicate(s.scenarioId)}
                        title="複製"
                      >
                        <Copy size={16} />
                      </button>
                      <button 
                        className="btn btn-glass"
                        onClick={() => handleExport(s.scenarioId, false)}
                        title="ZIP出力 (画像なし - 軽量)"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        className="btn btn-glass"
                        onClick={() => handleExport(s.scenarioId, true)}
                        title="ZIP出力 (画像あり)"
                      >
                        <Download size={16} style={{ color: '#10b981' }} />
                      </button>
                      <button 
                        className="btn btn-glass"
                        onClick={() => startEditing(s)}
                        title="編集"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        className="btn btn-glass"
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        onClick={() => setIsDeleting(s)}
                        title="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      {/* 削除確認モーダル */}
      {isDeleting && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '400px', padding: '24px' }}>
            <h2 className="text-display" style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#ef4444' }}>シナリオの削除</h2>
            <p style={{ marginBottom: '24px', lineHeight: 1.5 }}>
              シナリオ「{isDeleting.title}」を削除しますか？<br/>
              <span className="text-secondary" style={{ fontSize: '0.9rem' }}>※この操作は取り消せません。プレイ履歴もすべて削除されます。</span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-glass" onClick={() => setIsDeleting(null)}>
                キャンセル
              </button>
              <button className="btn" style={{ background: '#ef4444', color: 'white' }} onClick={handleDelete}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
