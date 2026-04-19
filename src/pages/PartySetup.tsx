import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Inbox, PlusCircle } from 'lucide-react';
import { getPartyById, loadCharacterData, saveCharacterData, loadAvatarData } from '../lib/indexedDB';
import Card, { CardData } from '../components/Card';
import { useUI } from '../contexts/UIContext';

export default function PartySetup() {
  const { partyId } = useParams();
  const navigate = useNavigate();
  const [party, setParty] = useState<any>(null);
  const [members, setMembers] = useState<CardData[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const { toast, confirm } = useUI();

  const fetchMembers = async (pid: number) => {
    const allChars = await loadCharacterData();
    const pMembers = allChars.filter((c: any) => c.group === 'Party' && c.partyId === pid);
    
    const savedOrder = localStorage.getItem(`party_order_${pid}`);
    if (savedOrder) {
      try {
        const orderArr = JSON.parse(savedOrder);
        pMembers.sort((a: any, b: any) => {
          const idxA = orderArr.indexOf(a.id);
          const idxB = orderArr.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      } catch(e) {}
    }
    setMembers(pMembers);
  };

  useEffect(() => {
    const init = async () => {
      if (!partyId) return;
      const pid = parseInt(partyId, 10);
      const p = await getPartyById(pid);
      if (!p) {
        navigate('/party');
        return;
      }
      setParty(p);
      await fetchMembers(pid);
    };
    init();
  }, [partyId, navigate]);

  const handleCardClick = (card: CardData) => {
    if (isSelectionMode) {
      const newSel = new Set(selectedIds);
      if (newSel.has(card.id)) newSel.delete(card.id);
      else newSel.add(card.id);
      setSelectedIds(newSel);
    }
  };

  const handleToggleRole = async (card: CardData, newRole: string) => {
    if (!partyId) return;
    const pid = parseInt(partyId, 10);
    const allChars = await loadCharacterData();
    
    // Toggle logic: if already the role, set to 'none'
    const updatedChars = allChars.map((c: any) => {
      if (c.group === 'Party' && c.partyId === pid) {
        if (c.id === card.id) {
          c.role = c.role === newRole ? 'none' : newRole;
        } else if (newRole === 'avatar' && c.role === 'avatar') {
          // Only one avatar allowed (usually)
          c.role = 'none';
        }
      }
      return c;
    });

    await saveCharacterData(updatedChars);
    await fetchMembers(pid);
  };

  const handleMoveToWarehouse = async () => {
    if (selectedIds.size === 0 || !partyId) return;
    const pid = parseInt(partyId, 10);
    const allChars = await loadCharacterData();
    
    let changed = false;
    const updatedChars = allChars.map((c: any) => {
      if (selectedIds.has(c.id)) {
        changed = true;
        c.group = 'Warehouse';
        c.role = 'none';
        c.partyId = null;
      }
      return c;
    });

    if (changed) {
      await saveCharacterData(updatedChars);
      await fetchMembers(pid);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleAddAvatar = async () => {
    if (!partyId) return;
    const pid = parseInt(partyId, 10);
    const avatarData = await loadAvatarData('myAvatar');
    
    if (!avatarData || !avatarData.name) {
      toast('アバターデータがありません。「アバター」メニューから作成してください。', 'error');
      return;
    }

    if (await confirm(`「${avatarData.name}」をパーティのアバターとして登録しますか？`)) {
      const allChars = await loadCharacterData();
      
      // 既存のアバターがいればロールを解除
      let updatedChars = allChars.map((c: any) => {
        if (c.group === 'Party' && c.partyId === pid && c.role === 'avatar') {
          c.role = 'none';
        }
        return c;
      });

      // 新しいアバターカードを作成して追加
      const avatarCard: CardData = {
        id: `avatar_${Date.now()}`,
        name: avatarData.name,
        type: 'キャラクター',
        rarity: avatarData.rarity || '★1',
        state: '',
        special: avatarData.skill || '',
        caption: avatarData.serif || '',
        backgroundcss: '',
        imageprompt: '',
        role: 'avatar',
        imageData: avatarData.imageData || '',
        group: 'Party',
        partyId: pid,
      };

      updatedChars.push(avatarCard);
      await saveCharacterData(updatedChars);
      await fetchMembers(pid);
      toast('アバターを追加しました。', 'success');
    }
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
    const newMembers = [...members];
    const item = newMembers.splice(draggedItem, 1)[0];
    newMembers.splice(index, 0, item);
    setDraggedItem(index);
    setMembers(newMembers);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
    setDraggedItem(null);
    if (partyId) {
      const orderArr = members.map(m => m.id);
      localStorage.setItem(`party_order_${partyId}`, JSON.stringify(orderArr));
    }
  };

  if (!party) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>読み込み中...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
      <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn btn-glass" onClick={() => navigate('/party')} title="パーティ一覧に戻る">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '4px' }}>パーティ編成</h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>{party.name}</p>
        </div>
      </header>

      {/* ツールバー */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/warehouse?mode=party&partyId=' + partyId)}>
            <PlusCircle size={18} style={{ marginRight: '8px' }}/> 倉庫から追加
          </button>
          <button className="btn btn-glass" style={{ borderColor: 'rgba(255,255,255,0.2)' }} onClick={handleAddAvatar}>
            <PlusCircle size={18} style={{ marginRight: '8px' }}/> 分身を追加
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${isSelectionMode ? 'btn-primary' : 'btn-glass'}`} 
            style={isSelectionMode ? { backgroundColor: '#f0ad4e', borderColor: '#f0ad4e' } : {}}
            onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
          >
            {isSelectionMode ? '選択解除' : '選択モード'}
          </button>
          {isSelectionMode && selectedIds.size > 0 && (
            <button className="btn" style={{ background: '#e6a800', color: 'white' }} onClick={handleMoveToWarehouse}>
              <Inbox size={18} style={{ marginRight: '8px' }}/> 選択したカードを倉庫に戻す
            </button>
          )}
        </div>
      </div>

      {/* キャラクター一覧 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)' }}>
            パーティメンバーがいません。「倉庫から追加」ボタンでキャラクターを追加してください。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* アバター */}
            <div>
              <h2 className="text-display" style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>アバター</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {members.filter(c => c.role === 'avatar').length === 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>設定されていません</span>
                )}
                {members.filter(c => c.role === 'avatar').map(c => {
                  const idx = members.indexOf(c);
                  return (
                    <div 
                      key={c.id}
                      draggable={!isSelectionMode}
                      onDragStart={!isSelectionMode ? (e) => handleDragStart(e, idx) : undefined}
                      onDragEnter={!isSelectionMode ? (e) => handleDragEnter(e, idx) : undefined}
                      onDragOver={!isSelectionMode ? handleDragOver : undefined}
                      onDragEnd={!isSelectionMode ? handleDragEnd : undefined}
                      style={{ 
                        cursor: isSelectionMode ? 'pointer' : (draggedItem !== null ? 'grabbing' : 'grab'),
                        transition: 'transform 0.2s ease',
                        transform: draggedItem === idx ? 'scale(1.02)' : 'none',
                        opacity: draggedItem === idx ? 0.8 : 1,
                      }}
                    >
                      <Card card={c} isSelectionMode={isSelectionMode} isSelected={selectedIds.has(c.id)} onCardClick={handleCardClick} showRoleButtons onToggleRole={handleToggleRole} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* パートナー */}
            <div>
              <h2 className="text-display" style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>パートナー</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {members.filter(c => c.role === 'partner').length === 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>設定されていません</span>
                )}
                {members.filter(c => c.role === 'partner').map(c => {
                  const idx = members.indexOf(c);
                  return (
                    <div 
                      key={c.id}
                      draggable={!isSelectionMode}
                      onDragStart={!isSelectionMode ? (e) => handleDragStart(e, idx) : undefined}
                      onDragEnter={!isSelectionMode ? (e) => handleDragEnter(e, idx) : undefined}
                      onDragOver={!isSelectionMode ? handleDragOver : undefined}
                      onDragEnd={!isSelectionMode ? handleDragEnd : undefined}
                      style={{ 
                        cursor: isSelectionMode ? 'pointer' : (draggedItem !== null ? 'grabbing' : 'grab'),
                        transition: 'transform 0.2s ease',
                        transform: draggedItem === idx ? 'scale(1.02)' : 'none',
                        opacity: draggedItem === idx ? 0.8 : 1,
                      }}
                    >
                      <Card card={c} isSelectionMode={isSelectionMode} isSelected={selectedIds.has(c.id)} onCardClick={handleCardClick} showRoleButtons onToggleRole={handleToggleRole} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* その他メンバー */}
            <div>
              <h2 className="text-display" style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>その他メンバー</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {members.filter(c => c.role !== 'avatar' && c.role !== 'partner').length === 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>該当なし</span>
                )}
                {members.filter(c => c.role !== 'avatar' && c.role !== 'partner').map(c => {
                  const idx = members.indexOf(c);
                  return (
                    <div 
                      key={c.id}
                      draggable={!isSelectionMode}
                      onDragStart={!isSelectionMode ? (e) => handleDragStart(e, idx) : undefined}
                      onDragEnter={!isSelectionMode ? (e) => handleDragEnter(e, idx) : undefined}
                      onDragOver={!isSelectionMode ? handleDragOver : undefined}
                      onDragEnd={!isSelectionMode ? handleDragEnd : undefined}
                      style={{ 
                        cursor: isSelectionMode ? 'pointer' : (draggedItem !== null ? 'grabbing' : 'grab'),
                        transition: 'transform 0.2s ease',
                        transform: draggedItem === idx ? 'scale(1.02)' : 'none',
                        opacity: draggedItem === idx ? 0.8 : 1,
                      }}
                    >
                      <Card card={c} isSelectionMode={isSelectionMode} isSelected={selectedIds.has(c.id)} onCardClick={handleCardClick} showRoleButtons onToggleRole={handleToggleRole} />
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
