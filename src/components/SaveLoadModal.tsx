import { useState, useEffect } from 'react';
import { Save, Download, X, Clock } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
import { getAllSaveSlots, saveToSlot, loadFromSlot, SaveSlotData } from '../lib/indexedDB';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScenarioId?: number; // オプショナルに変更
  onLoadSuccess: (scenarioId: number) => void;
}

export default function SaveLoadModal({ isOpen, onClose, currentScenarioId, onLoadSuccess }: SaveLoadModalProps) {
  const { toast, confirm } = useUI();
  const [slots, setSlots] = useState<(SaveSlotData | undefined)[]>([]);
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('save');

  const fetchSlots = async () => {
    try {
      const data = await getAllSaveSlots();
      setSlots(data);
    } catch (err) {
      console.error(err);
      toast('セーブデータの取得に失敗しました。', 'error');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSlots();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (slotIndex: number) => {
    if (!currentScenarioId) {
      toast('保存対象のシナリオがありません。', 'error');
      return;
    }
    const existing = slots[slotIndex - 1];
    if (existing) {
      if (!(await confirm(`スロット ${slotIndex} に上書き保存しますか？\n(既存のデータは失われます)`))) {
        return;
      }
    }
    try {
      await saveToSlot(slotIndex, currentScenarioId);
      toast(`スロット ${slotIndex} にセーブしました。`, 'success');
      fetchSlots();
    } catch (err: any) {
      console.error(err);
      toast(`セーブ失敗: ${err.message}`, 'error');
    }
  };

  const handleLoad = async (slotIndex: number) => {
    const existing = slots[slotIndex - 1];
    if (!existing) return;

    if (await confirm(`スロット ${slotIndex} をロードしますか？\n(現在の進行状況は破棄されます)`)) {
      try {
        const sid = await loadFromSlot(slotIndex);
        if (sid !== null) {
          toast(`スロット ${slotIndex} をロードしました。`, 'success');
          onLoadSuccess(sid);
          onClose();
        } else {
          toast('ロードに失敗しました。', 'error');
        }
      } catch (err: any) {
        console.error(err);
        toast(`ロード失敗: ${err.message}`, 'error');
      }
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="modal active">
      <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
        <button className="modal-close" onClick={onClose}><X size={20} /></button>
        
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
          <button 
            className={`btn ${activeTab === 'save' ? 'btn-primary' : 'btn-glass'}`} 
            onClick={() => setActiveTab('save')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <Save size={18} style={{ marginRight: '8px' }} /> セーブ
          </button>
          <button 
            className={`btn ${activeTab === 'load' ? 'btn-primary' : 'btn-glass'}`} 
            onClick={() => setActiveTab('load')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <Download size={18} style={{ marginRight: '8px' }} /> ロード
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
          {[1, 2, 3, 4, 5].map(slotIndex => {
            const data = slots[slotIndex - 1];
            
            return (
              <div key={slotIndex} className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, marginRight: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '1.1rem' }}>Slot {slotIndex}</span>
                    <span style={{ fontSize: '1rem' }}>{data ? data.title : '空のスロット'}</span>
                  </div>
                  {data && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                      <Clock size={14} /> {formatDate(data.timestamp)}
                    </div>
                  )}
                </div>
                
                <div>
                  {activeTab === 'save' ? (
                    <button 
                      className="btn btn-primary" 
                      onClick={() => handleSave(slotIndex)}
                      disabled={!currentScenarioId}
                      title={!currentScenarioId ? 'プレイ中のみ保存可能です' : ''}
                    >
                      保存
                    </button>
                  ) : (
                    <button className="btn btn-glass" onClick={() => handleLoad(slotIndex)} disabled={!data}>
                      読み込み
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
