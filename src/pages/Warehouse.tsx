import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Trash2, RotateCcw, XCircle, Plus } from 'lucide-react';
import { loadCharacterData, saveCharacterData } from '../lib/indexedDB';
import Card, { CardData } from '../components/Card';
import { StabilityApiClient } from '../lib/stabilityApiClient';
import { useUI } from '../contexts/UIContext';

export default function Warehouse() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'menu';
  const partyIdStr = searchParams.get('partyId');
  
  const [activeTab, setActiveTab] = useState('すべて');
  const [cards, setCards] = useState<CardData[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { toast, alert, confirm } = useUI();

  const fetchCards = async (tab: string) => {
    const allData = await loadCharacterData();
    let filtered = allData;
    if (tab === 'ゴミ箱') {
      filtered = allData.filter((c: any) => c.group === 'Trash');
    } else if (tab !== 'すべて') {
      filtered = allData.filter((c: any) => c.group === 'Warehouse' && (c.type || '').trim() === tab);
    }
    setCards(filtered);
  };

  useEffect(() => {
    fetchCards(activeTab);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, [activeTab]);

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
    await fetchCards(activeTab);
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
    await fetchCards(activeTab);
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
        await fetchCards(activeTab);
        toast("画像を生成しました！", "success");
      }
    } catch (err: any) {
      console.error(err);
      toast("画像生成に失敗しました: " + err.message, "error");
    }
  };

  const handleActionSelected = async (action: 'trash' | 'restore' | 'party' | 'delete') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (action === 'trash') await updateCardGroup(ids, 'Trash');
    if (action === 'restore') await updateCardGroup(ids, 'Warehouse');
    if (action === 'party') {
      if (!partyIdStr) return;
      await updateCardGroup(ids, 'Party', parseInt(partyIdStr, 10));
      navigate(`/party-setup/${partyIdStr}`);
    }
    if (action === 'delete') {
      const ok = await confirm(`選択した${ids.length}件を完全に削除しますか？`);
      if (!ok) return;
      const allData = await loadCharacterData();
      const updated = allData.filter((c: any) => !selectedIds.has(c.id));
      await saveCharacterData(updated);
      await fetchCards(activeTab);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {mode === 'party' && (
          <button className="btn btn-glass" onClick={() => navigate(`/party-setup/${partyIdStr}`)} title="編成に戻る">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '4px' }}>
            {activeTab === 'ゴミ箱' ? 'ゴミ箱' : '倉庫'}
          </h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>
            {mode === 'party' ? 'パーティに追加するカードを選択してください' : '保管されているカードの管理'}
          </p>
        </div>
      </header>

      <div className="glass-panel" style={{ padding: '8px', marginBottom: '12px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {['すべて', 'キャラクター', 'アイテム', 'モンスター', 'ゴミ箱'].map(tab => (
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
            <>
              {mode === 'party' ? (
                <button className="btn btn-primary" onClick={() => handleActionSelected('party')}>
                  <Plus size={18} style={{ marginRight: '8px' }}/> パーティに追加 ({selectedIds.size})
                </button>
              ) : (
                <button className="btn" style={{ background: '#e6a800', color: 'white' }} onClick={() => handleActionSelected('trash')}>
                  <Trash2 size={18} style={{ marginRight: '8px' }}/> ゴミ箱へ ({selectedIds.size})
                </button>
              )}
            </>
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {cards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)' }}>
            カードがありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
            {cards.map(c => (
              <Card 
                key={c.id} 
                card={c} 
                isSelectionMode={isSelectionMode} 
                isSelected={selectedIds.has(c.id)}
                onCardClick={handleCardClick}
                onTrash={activeTab !== 'ゴミ箱' ? handleTrashSingle : undefined}
                onRestore={activeTab === 'ゴミ箱' ? handleRestoreSingle : undefined}
                onDeletePermanent={activeTab === 'ゴミ箱' ? handleDeletePermanentSingle : undefined}
                onGenerateImage={activeTab !== 'ゴミ箱' ? handleGenerateImage : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
