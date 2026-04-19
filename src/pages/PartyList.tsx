import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Trash2, Plus, LogIn, Save, X } from 'lucide-react';
import { listAllParties, createParty, updateParty, deletePartyById, loadCharacterData, saveCharacterData } from '../lib/indexedDB';
import { useUI } from '../contexts/UIContext';

interface Party {
  partyId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function PartyList() {
  const navigate = useNavigate();
  const [parties, setParties] = useState<Party[]>([]);
  const [newPartyName, setNewPartyName] = useState('');
  
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [editName, setEditName] = useState('');
  
  const [isDeleting, setIsDeleting] = useState<Party | null>(null);

  const { toast } = useUI();

  const fetchParties = async () => {
    try {
      const data = await listAllParties();
      setParties(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  const handleCreate = async () => {
    if (!newPartyName.trim()) return;
    try {
      await createParty(newPartyName.trim());
      setNewPartyName('');
      await fetchParties();
    } catch (e: any) {
      console.error(e);
      toast('パーティ作成に失敗しました: ' + e.message, 'error');
    }
  };

  const handleUpdate = async () => {
    if (!editingParty || !editName.trim()) return;
    try {
      await updateParty(editingParty.partyId, editName.trim());
      setEditingParty(null);
      await fetchParties();
    } catch (e: any) {
      console.error(e);
      toast('パーティ名更新に失敗しました: ' + e.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!isDeleting) return;
    try {
      // 1. パーティに所属しているキャラクターを倉庫（Warehouse）に戻す
      const characters = await loadCharacterData();
      let changed = false;
      const updatedChars = characters.map((c: any) => {
        if (c.group === 'Party' && c.partyId === isDeleting.partyId) {
          changed = true;
          const newC = { ...c };
          newC.group = 'Warehouse';
          newC.role = 'none';
          delete newC.partyId;
          return newC;
        }
        return c;
      });

      if (changed) {
        await saveCharacterData(updatedChars);
      }

      // 2. パーティ本体を削除
      await deletePartyById(isDeleting.partyId);
      setIsDeleting(null);
      await fetchParties();
    } catch (e: any) {
      console.error(e);
      toast('パーティ削除に失敗しました: ' + e.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '8px' }}>パーティ一覧</h1>
        <p className="text-secondary">シナリオで活躍するパーティの作成と管理を行います。</p>
      </header>

      {/* 作成フォーム */}
      <div className="glass-panel" style={{ marginBottom: '24px', padding: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input 
          type="text" 
          className="btn-glass"
          style={{ flex: 1, padding: '12px 16px', textAlign: 'left', cursor: 'text' }}
          placeholder="新しいパーティ名..." 
          value={newPartyName}
          onChange={e => setNewPartyName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <button 
          className="btn btn-primary" 
          onClick={handleCreate}
          disabled={!newPartyName.trim()}
        >
          <Plus size={18} style={{ marginRight: '8px' }}/> 作成
        </button>
      </div>

      {/* 一覧 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
        {parties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)' }}>
            パーティがありません。「作成」から新しいパーティを作ってください。
          </div>
        ) : (
          parties.map(p => (
            <div key={p.partyId} className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              
              <div style={{ flex: 1 }}>
                <h3 className="text-display" style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{p.name}</h3>
                <p className="text-secondary" style={{ fontSize: '0.85rem' }}>更新日: {new Date(p.updatedAt).toLocaleDateString()}</p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-glass"
                  onClick={() => { setEditingParty(p); setEditName(p.name); }}
                  title="名前変更"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  className="btn btn-primary"
                  title="編成"
                  onClick={() => navigate(`/party-setup/${p.partyId}`)}
                >
                  <LogIn size={16} style={{ marginRight: '4px' }}/> 編成
                </button>
                <button 
                  className="btn btn-glass"
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  onClick={() => setIsDeleting(p)}
                  title="削除"
                >
                  <Trash2 size={16} />
                </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* 編集モーダル */}
      {editingParty && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '400px', padding: '24px' }}>
            <h2 className="text-display" style={{ fontSize: '1.25rem', marginBottom: '16px' }}>パーティ名変更</h2>
            <input 
              type="text" 
              className="btn-glass"
              style={{ width: '100%', padding: '12px 16px', marginBottom: '24px', textAlign: 'left', cursor: 'text' }}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-glass" onClick={() => setEditingParty(null)}>
                <X size={16} style={{ marginRight: '4px' }}/> キャンセル
              </button>
              <button className="btn btn-primary" onClick={handleUpdate} disabled={!editName.trim()}>
                <Save size={16} style={{ marginRight: '4px' }}/> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {isDeleting && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '400px', padding: '24px' }}>
            <h2 className="text-display" style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#ef4444' }}>パーティの削除</h2>
            <p style={{ marginBottom: '24px', lineHeight: 1.5 }}>
              パーティ「{isDeleting.name}」を削除しますか？<br/>
              <span className="text-secondary" style={{ fontSize: '0.9rem' }}>※所属しているキャラクターは倉庫（本棚）に戻されます。</span>
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
