import { useState, useEffect } from 'react';
import { useLLM } from '../hooks/useLLM';
import { Sparkles, X, Plus } from 'lucide-react';
import { loadCharacterData, saveCharacterData } from '../lib/indexedDB';
import { StabilityApiClient } from '../lib/stabilityApiClient';
import { useUI } from '../contexts/UIContext';

interface CharacterCard {
  id: string;
  type: string;
  name: string;
  rarity: string;
  state: string;
  special: string;
  caption: string;
  imageprompt: string;
  backgroundcss: string;
  flipped: boolean;
  imageData?: string;
}

export default function CharacterCreate() {
  const { generateResponse, isGenerating } = useLLM();
  const { toast, alert } = useUI();
  const [stages, setStages] = useState(['ファンタジー', 'SF', '歴史・時代劇', '現代', 'ホラー / ダーク']);
  const [moods, setMoods] = useState(['ライト / ポップ', '中間 / バランス型', 'ダーク / シリアス']);
  
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState<string>('');
  
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<CharacterCard[]>([]);
  
  // Custom chip generation
  const [isOtherModalOpen, setIsOtherModalOpen] = useState(false);
  const [otherCategory, setOtherCategory] = useState<'stage' | 'mood'>('stage');
  const [otherInput, setOtherInput] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedStages = localStorage.getItem('elementStageArr');
      if (savedStages) setSelectedStages(JSON.parse(savedStages));
      const savedMood = localStorage.getItem('elementMood');
      if (savedMood) setSelectedMood(savedMood);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleStage = (stage: string) => {
    const newStages = selectedStages.includes(stage) 
      ? selectedStages.filter(s => s !== stage)
      : [...selectedStages, stage];
    setSelectedStages(newStages);
    localStorage.setItem('elementStageArr', JSON.stringify(newStages));
  };

  const selectMood = (mood: string) => {
    const newMood = selectedMood === mood ? '' : mood;
    setSelectedMood(newMood);
    localStorage.setItem('elementMood', newMood);
  };

  const handleGenerateCustomChip = async () => {
    const categoryJa = otherCategory === 'stage' ? '舞台' : '雰囲気';
    const existingList = otherCategory === 'stage' ? stages : moods;
    
    const prompt = `あなたは創造的なアイデアを出すアシスタントです。TRPGの${categoryJa}設定の新しいアイデアを提案してください。
既存の候補は以下の通りです:
${existingList.join(' / ')}

これらとは異なる、ユニークで魅力的な${categoryJa}のアイデアを**1つだけ**、簡潔な単語または短いフレーズで提案してください。提案する単語・フレーズのみを出力し、他の文章は含めないでください。`;

    try {
      const response = await generateResponse(prompt, []);
      const cleaned = response.replace(/["'「」]/g, '').trim();
      setOtherInput(cleaned);
    } catch (error) {
      console.error("Failed to generate custom chip:", error);
    }
  };

  const handleAddCustomChip = () => {
    if (!otherInput) return;
    if (otherCategory === 'stage' && !stages.includes(otherInput)) {
      setStages([...stages, otherInput]);
      toggleStage(otherInput);
    } else if (otherCategory === 'mood' && !moods.includes(otherInput)) {
      setMoods([...moods, otherInput]);
      selectMood(otherInput);
    }
    setIsOtherModalOpen(false);
    setOtherInput('');
  };

  const runGacha = async () => {
    setIsGenreModalOpen(false);
    setGeneratedCards([]);
    
    let axisPrompt = '';
    if (selectedStages.length > 0) axisPrompt += `【舞台】${selectedStages.join(' / ')}\n`;
    if (selectedMood) axisPrompt += `【雰囲気】${selectedMood}\n`;

    const prompt = `あなたはTRPG用のキャラクター、装備品、モンスター作成のエキスパートです。
以下の条件に基づいて、キャラクター、アイテム、モンスターを合計10個、ランダムな組み合わせで生成してください。

条件:
${axisPrompt || '(指定なし)'}

生成する各要素について、以下のJSON形式のオブジェクトを作成し、それらを要素とする**JSON配列**として出力してください。
[
  {
    "type": "キャラクター or アイテム or モンスター",
    "name": "名前 (日本語)",
    "rarity": "★(0〜5のいずれか)",
    "state": "キャラクターやモンスターの状態 (例: 傷ついている、怒っている。アイテムなら空文字)",
    "special": "特技や特殊能力、効果など (日本語、簡潔に)",
    "caption": "フレーバーテキストや短い説明文 (日本語)",
    "imageprompt": "画像生成用の英語キーワード (例: anime style, male swordsman, red hair)",
    "backgroundcss": "CSSのbackground-image値 (例: linear-gradient(to right, red, blue))"
  }
]

制約:
- 合計で正確に10個生成してください。
- typeの割合はランダムにしてください。
- 出力はJSON配列の形式のみとし、他のテキストは含めないでください。
- 各フィールドの値は必ず文字列としてください。

JSON配列出力:`;

    try {
      const responseText = await generateResponse(prompt, []);
      
      const cleanedString = responseText.replace(/^```json\s*|```$/g, '').trim();
      const jsonMatch = cleanedString.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      
      if (jsonMatch && jsonMatch[0]) {
        const parsed = JSON.parse(jsonMatch[0]);
        const cards = Array.isArray(parsed) ? parsed : [parsed];
        
        const newCards: CharacterCard[] = cards.map((item: any, idx: number) => {
          const rawRarity = item.rarity || '★1';
          let rarityNum = 1;
          const starMatch = rawRarity.match(/★/g);
          if (starMatch && starMatch.length > 1) {
            rarityNum = starMatch.length;
          } else {
            rarityNum = parseInt(rawRarity.replace(/[^0-9]/g, ''), 10);
            if (isNaN(rarityNum)) rarityNum = 1;
          }
          rarityNum = Math.max(0, Math.min(5, rarityNum));
          const normalizedRarity = `★${rarityNum}`;

          return {
            id: `card_${Date.now()}_${idx}`,
            type: item.type || '不明',
            name: item.name || '名称未設定',
            rarity: normalizedRarity,
            state: item.state || '',
            special: item.special || '',
            caption: item.caption || '',
            imageprompt: item.imageprompt || '',
            backgroundcss: item.backgroundcss || '',
            flipped: rarityNum >= 1, // ★1以上は初期裏向き
            group: 'Warehouse',
            level: 1,
            exp: 0,
            createdAt: new Date().toISOString()
          };
        });

        setGeneratedCards(newCards);

        // IndexedDBに保存 (allCharactersに追記)
        const existingData = await loadCharacterData();
        const updatedData = [...existingData, ...newCards];
        await saveCharacterData(updatedData);
      }
    } catch (err: any) {
      console.error("Gacha failed:", err);
      toast("生成に失敗しました: " + err.message, "error");
    }
  };

  const revealAll = () => {
    setGeneratedCards(prev => prev.map(c => ({ ...c, flipped: false })));
  };

  const flipCard = (id: string) => {
    setGeneratedCards(prev => prev.map(c => 
      c.id === id && c.flipped ? { ...c, flipped: false } : c
    ));
  };

  const handleGenerateImage = async (e: React.MouseEvent, card: CharacterCard) => {
    e.stopPropagation();
    if (!card.imageprompt) {
      toast("画像プロンプトがありません。", "error");
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
    const fullPrompt = promptPrefix + card.imageprompt;

    try {
      setGeneratedCards(prev => prev.map(c => c.id === card.id ? { ...c, caption: '画像生成中...' } : c));
      
      const results = await client.generateImage(fullPrompt, apiKey, {
        samples: 1,
        width: 1024,
        height: 1024,
        style_preset: card.type === 'アイテム' ? 'photographic' : 'fantasy-art'
      });

      if (results && results.length > 0) {
        const dataUrl = 'data:image/png;base64,' + results[0].imageDataB64;
        
        setGeneratedCards(prev => prev.map(c => c.id === card.id ? { ...c, imageData: dataUrl, caption: card.caption } : c));

        // Save to DB
        const all = await loadCharacterData();
        const idx = all.findIndex((c: any) => c.id === card.id);
        if (idx !== -1) {
          all[idx].imageData = dataUrl;
          await saveCharacterData(all);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast("画像生成に失敗しました: " + err.message, "error");
      setGeneratedCards(prev => prev.map(c => c.id === card.id ? { ...c, caption: card.caption } : c));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '8px' }}>キャラクター生成</h1>
        <p className="text-secondary">AIと対話して新しいキャラクターを作り出します。</p>
      </header>
      
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button 
          className="btn btn-primary" 
          onClick={() => setIsGenreModalOpen(true)}
          disabled={isGenerating}
        >
          <Sparkles size={18} />
          <span>エレメントガチャ (10連)</span>
        </button>
        {generatedCards.some(c => c.flipped) && (
          <button className="btn btn-glass" onClick={revealAll}>
            すべて見る
          </button>
        )}
      </div>

      {isGenerating && (
        <div className="glass-panel animate-pulse" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
          <p className="text-display">AIが要素を抽出しています...</p>
        </div>
      )}

      {/* Generated Cards Display */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: '16px',
        alignItems: 'start'
      }}>
        {generatedCards.map((card) => (
          <div 
            key={card.id} 
            className="glass-panel"
            style={{ 
              aspectRatio: '2/3', 
              cursor: card.flipped ? 'pointer' : 'default',
              position: 'relative',
              overflow: 'hidden',
              padding: '0',
              display: 'flex',
              flexDirection: 'column',
              background: card.flipped ? 'linear-gradient(135deg, #2a2a35, #1a1a25)' : card.backgroundcss || 'rgba(0,0,0,0.3)',
              transition: 'transform 0.3s ease, background 0.3s ease',
              transform: card.flipped ? 'scale(1)' : 'scale(1.02)'
            }}
            onClick={() => flipCard(card.id)}
          >
            {card.flipped ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column' }}>
                <span className="text-display text-gradient" style={{ fontSize: '3rem' }}>?</span>
                <span className="text-secondary" style={{ marginTop: '8px' }}>{card.rarity}</span>
              </div>
            ) : (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', zIndex: 1, background: 'rgba(0,0,0,0.5)' }}>
                {card.imageData && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}>
                    <img src={card.imageData} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                  </div>
                )}
                <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px', alignSelf: 'flex-start', marginBottom: '8px' }}>
                  {card.type} - {card.rarity}
                </div>
                <h3 className="text-display" style={{ fontSize: '1.2rem', marginBottom: '8px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{card.name}</h3>
                {card.state && <p style={{ fontSize: '0.85rem', marginBottom: '4px', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}><strong>状態:</strong> {card.state}</p>}
                {card.special && <p style={{ fontSize: '0.85rem', marginBottom: '4px', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}><strong>特技:</strong> {card.special}</p>}
                <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: 'auto', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{card.caption}</p>
                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: '8px', padding: '4px 8px', fontSize: '0.8rem', alignSelf: 'center' }}
                  onClick={(e) => handleGenerateImage(e, card)}
                  disabled={card.caption === '画像生成中...'}
                >
                  <Sparkles size={12} style={{ marginRight: '4px' }}/> 画像生成
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Genre Modal */}
      {isGenreModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '500px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="text-display" style={{ fontSize: '1.5rem' }}>エレメントのジャンル設定</h2>
              <button className="btn" style={{ padding: '4px' }} onClick={() => setIsGenreModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>舞台（複数選択可）</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {stages.map(s => (
                  <button 
                    key={s} 
                    className={`btn ${selectedStages.includes(s) ? 'btn-primary' : 'btn-glass'}`}
                    onClick={() => toggleStage(s)}
                  >
                    {s}
                  </button>
                ))}
                <button className="btn btn-glass" onClick={() => { setOtherCategory('stage'); setIsOtherModalOpen(true); }}>
                  <Plus size={16} style={{ marginRight: '4px' }}/> その他
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>雰囲気（単一選択）</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {moods.map(m => (
                  <button 
                    key={m} 
                    className={`btn ${selectedMood === m ? 'btn-primary' : 'btn-glass'}`}
                    onClick={() => selectMood(m)}
                  >
                    {m}
                  </button>
                ))}
                <button className="btn btn-glass" onClick={() => { setOtherCategory('mood'); setIsOtherModalOpen(true); }}>
                  <Plus size={16} style={{ marginRight: '4px' }}/> その他
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-glass" onClick={() => setIsGenreModalOpen(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={runGacha}>ガチャ実行</button>
            </div>
          </div>
        </div>
      )}

      {/* Other Input Modal */}
      {isOtherModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '400px', padding: '24px' }}>
            <h2 className="text-display" style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
              【{otherCategory === 'stage' ? '舞台' : '雰囲気'}】を追加
            </h2>
            <textarea 
              className="btn-glass"
              style={{ width: '100%', minHeight: '80px', padding: '12px', marginBottom: '16px', textAlign: 'left', cursor: 'text' }}
              placeholder="新しく追加する候補"
              value={otherInput}
              onChange={(e) => setOtherInput(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <button className="btn btn-primary" onClick={handleGenerateCustomChip} disabled={isGenerating}>
                <Sparkles size={16} style={{ marginRight: '4px' }}/> 
                AIで生成
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-glass" onClick={() => setIsOtherModalOpen(false)}>キャンセル</button>
                <button className="btn btn-primary" onClick={handleAddCustomChip}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
