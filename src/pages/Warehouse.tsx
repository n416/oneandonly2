import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, XCircle, Download, Upload, Layers } from 'lucide-react';
import { loadCharacterData, saveCharacterData } from '../lib/indexedDB';
import { getActiveDeckSlot, setActiveDeckSlot, getDeck, toggleCardInDeck, exportDecks, importDecks } from '../lib/deckManager';
import Card, { CardData } from '../components/Card';
import { StabilityApiClient } from '../lib/stabilityApiClient';
import { useUI } from '../contexts/UIContext';

export default function Warehouse() {
  const [activeTab, setActiveTab] = useState('すべて');
  const [cards, setCards] = useState<CardData[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // デッキ管理用ステート
  const [activeSlot, setLocalActiveSlot] = useState(getActiveDeckSlot());
  const [currentDeck, setCurrentDeck] = useState<string[]>([]);

  const { toast, alert, confirm } = useUI();

  const fetchCards = async (tab: string, currentDeckIds: string[]) => {
    const allData = await loadCharacterData();
    let filtered = allData;
    if (tab === 'ゴミ箱') {
      filtered = allData.filter((c: any) => c.group === 'Trash');
    } else if (tab === 'デッキ') {
      filtered = allData.filter((c: any) => currentDeckIds.includes(c.id));
    } else if (tab !== 'すべて') {
      filtered = allData.filter((c: any) => c.group === 'Warehouse' && (c.type || '').trim() === tab);
    } else {
      // 'すべて'のときは Warehouse のものを表示
      filtered = allData.filter((c: any) => c.group === 'Warehouse');
    }
    setCards(filtered);
  };

  useEffect(() => {
    const deckIds = getDeck(activeSlot);
    setCurrentDeck(deckIds);
    fetchCards(activeTab, deckIds);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, [activeTab, activeSlot]);

  const handleSlotChange = (slot: number) => {
    setActiveDeckSlot(slot);
    setLocalActiveSlot(slot);
  };

  const handleToggleDeck = (card: CardData) => {
    const newDeck = toggleCardInDeck(activeSlot, card.id);
    setCurrentDeck([...newDeck]);
    if (activeTab === 'デッキ') {
      // デッキタブを見ている時は一覧から消えるため再フェッチ
      fetchCards(activeTab, newDeck);
    }
  };

  const handleExport = () => {
    const jsonStr = exportDecks();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decks_export_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('デッキをエクスポートしました', 'success');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const allData = await loadCharacterData();
        const validIds = allData.map((c: any) => c.id);
        
        const success = importDecks(text, validIds);
        if (success) {
          toast('デッキをインポートしました', 'success');
          // リロード
          const deckIds = getDeck(activeSlot);
          setCurrentDeck(deckIds);
          fetchCards(activeTab, deckIds);
        } else {
          toast('インポートに失敗しました', 'error');
        }
      } catch (err) {
        toast('ファイル読み込みに失敗しました', 'error');
      }
    };
    reader.readAsText(file);
    // 同じファイルを再選択できるようにリセット
    e.target.value = '';
  };

  const handleCardClick = (card: CardData) => {
    if (isSelectionMode) {
      const newSel = new Set(selectedIds);
      if (newSel.has(card.id)) newSel.delete(card.id);
      else newSel.add(card.id);
      setSelectedIds(newSel);
    }
  };

  const updateCardGroup = async (cardIds: string[], newGroup: string, partyId: number | null = null) => {
    const allData = await loadCharacterData();
    const updated = allData.map((c: any) => {
      if (cardIds.includes(c.id)) {
        c.group = newGroup;
        if (newGroup === 'Party') {
          c.partyId = partyId;
        } else {
          c.partyId = null;
          c.role = 'none';
        }
      }
      return c;
    });
    await saveCharacterData(updated);
    await fetchCards(activeTab, currentDeck);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleTrashSingle = (card: CardData) => updateCardGroup([card.id], 'Trash');
  const handleRestoreSingle = (card: CardData) => updateCardGroup([card.id], 'Warehouse');
  const handleDeletePermanentSingle = async (card: CardData) => {
    const ok = await confirm(`「${card.name}」を完全に削除しますか？`);
    if (!ok) return;
    const allData = await loadCharacterData();
    const updated = allData.filter((c: any) => c.id !== card.id);
    await saveCharacterData(updated);
    await fetchCards(activeTab, currentDeck);
  };

  const handleGenerateImage = async (card: CardData) => {
    if (!card.imageprompt && !card.caption) {
      toast("画像プロンプトや説明がありません。", "error");
      return;
    }

    const apiKey = localStorage.getItem('stabilityApiKey');
    if (!apiKey) {
      await alert("SettingsからStability AIのAPIキーを設定してください。");
      return;
    }

    const client = new StabilityApiClient();
    if (!client.isAvailable) {
      await alert("APIキーが未設定です。");
      return;
    }

    const promptPrefix = card.type === 'アイテム' ? 'photographic, ' : 'anime style, fantasy art, ';
    const fullPrompt = promptPrefix + (card.imageprompt || card.caption);

    try {
      toast("画像生成を開始しました...", "info");
      const results = await client.generateImage(fullPrompt, apiKey, {
        samples: 1,
        width: 1024,
        height: 1024,
        style_preset: card.type === 'アイテム' ? 'photographic' : 'fantasy-art'
      });

      if (results && results.length > 0) {
        const dataUrl = 'data:image/png;base64,' + results[0].imageDataB64;
        const allData = await loadCharacterData();
        const updated = allData.map((c: any) => c.id === card.id ? { ...c, imageData: dataUrl } : c);
        await saveCharacterData(updated);
        await fetchCards(activeTab, currentDeck);
        toast("画像を生成しました！", "success");
      }
    } catch (err: any) {
      console.error(err);
      toast("画像生成に失敗しました: " + err.message, "error");
    }
  };

  const handleActionSelected = async (action: 'trash' | 'restore' | 'delete') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (action === 'trash') await updateCardGroup(ids, 'Trash');
    if (action === 'restore') await updateCardGroup(ids, 'Warehouse');
    if (action === 'delete') {
      const ok = await confirm(`選択した${ids.length}件を完全に削除しますか？`);
      if (!ok) return;
      const allData = await loadCharacterData();
      const updated = allData.filter((c: any) => !selectedIds.has(c.id));
      await saveCharacterData(updated);
      await fetchCards(activeTab, currentDeck);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div>
          <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '4px', background: 'linear-gradient(to right, #e879f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {activeTab === 'ゴミ箱' ? 'Trash' : 'Collection'}
          </h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>
            所持しているカードの管理とデッキの編成
          </p>
        </div>
      </header>

      <div className="glass-panel" style={{ padding: '8px', marginBottom: '12px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {['すべて', 'キャラクター', 'アイテム', 'モンスター', 'デッキ', 'ゴミ箱'].map(tab => (
          <button 
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>



      {/* Toolbar */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${isSelectionMode ? 'btn-primary' : 'btn-glass'}`} 
            style={isSelectionMode ? { backgroundColor: '#f0ad4e', borderColor: '#f0ad4e' } : {}}
            onClick={() => setIsSelectionMode(!isSelectionMode)}
          >
            {isSelectionMode ? '選択解除' : '選択モード'}
          </button>
          
          {isSelectionMode && selectedIds.size > 0 && activeTab !== 'ゴミ箱' && (
            <button className="btn" style={{ background: '#e6a800', color: 'white' }} onClick={() => handleActionSelected('trash')}>
              <Trash2 size={18} style={{ marginRight: '8px' }}/> ゴミ箱へ ({selectedIds.size})
            </button>
          )}

          {isSelectionMode && selectedIds.size > 0 && activeTab === 'ゴミ箱' && (
            <>
              <button className="btn" style={{ background: '#4caf50', color: 'white' }} onClick={() => handleActionSelected('restore')}>
                <RotateCcw size={18} style={{ marginRight: '8px' }}/> 倉庫へ戻す ({selectedIds.size})
              </button>
              <button className="btn" style={{ background: '#f44336', color: 'white' }} onClick={() => handleActionSelected('delete')}>
                <XCircle size={18} style={{ marginRight: '8px' }}/> 完全削除 ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', paddingBottom: '120px' }}>
        {cards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)' }}>
            カードがありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
            {cards.map(c => (
              <Card 
                key={c.id} 
                card={{...c, inDeck: currentDeck.includes(c.id)}} 
                isSelectionMode={isSelectionMode} 
                isSelected={selectedIds.has(c.id)}
                onCardClick={handleCardClick}
                onTrash={activeTab !== 'ゴミ箱' ? handleTrashSingle : undefined}
                onRestore={activeTab === 'ゴミ箱' ? handleRestoreSingle : undefined}
                onDeletePermanent={activeTab === 'ゴミ箱' ? handleDeletePermanentSingle : undefined}
                onGenerateImage={activeTab !== 'ゴミ箱' ? handleGenerateImage : undefined}
                onToggleDeck={activeTab !== 'ゴミ箱' ? handleToggleDeck : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Deck Tray */}
      <div style={{
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 15, 20, 0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
        borderRadius: '24px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        zIndex: 50,
        transition: 'all 0.3s ease'
      }}>
        {/* Left: Slot Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '20px' }}>
          {[1, 2, 3, 4].map(slot => {
            const roman = ['I', 'II', 'III', 'IV'][slot - 1];
            const isActive = activeSlot === slot;
            return (
              <button
                key={slot}
                onClick={() => handleSlotChange(slot)}
                style={{
                  background: isActive ? 'linear-gradient(135deg, #d946ef, #8b5cf6)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: 'none',
                  borderRadius: '16px',
                  width: '36px',
                  height: '32px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(217, 70, 239, 0.4)' : 'none'
                }}
                title={`Deck ${slot}`}
              >
                {roman}
              </button>
            );
          })}
        </div>

        {/* Center: Active Deck Cards Thumbnails */}
        <div style={{ display: 'flex', gap: '8px', minWidth: '120px', alignItems: 'center', justifyContent: 'center' }}>
          {currentDeck.length === 0 ? (
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', fontStyle: 'italic' }}>No cards in deck</span>
          ) : (
            currentDeck.map(id => {
              const c = cards.find(x => x.id === id);
              if (!c) return null;
              return (
                <div key={id} style={{
                  width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', 
                  border: '1px solid rgba(236, 72, 153, 0.5)',
                  background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(236, 72, 153, 0.2)'
                }} title={c.name}>
                  {c.imageData ? (
                    <img src={c.imageData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#aaa' }}>{c.name.charAt(0)}</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '16px' }}>
          <button 
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '4px', transition: 'color 0.2s' }}
            title="現在のデッキをエクスポート"
            onClick={handleExport}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          >
            <Download size={18} />
          </button>
          <label 
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '4px', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
            title="デッキをインポート"
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          >
            <Upload size={18} />
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
      </div>
    </div>
  );
}
