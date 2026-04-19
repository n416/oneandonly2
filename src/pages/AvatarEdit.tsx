import { useState, useEffect } from 'react';
import { ArrowLeft, User, RefreshCw, Trash2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../contexts/UIContext';
import { loadAvatarData, saveAvatarData } from '../lib/indexedDB';
import { StabilityApiClient } from '../lib/stabilityApiClient';
import { useLLM } from '../hooks/useLLM';

const AVATAR_STORE_KEY = 'myAvatar';

interface AvatarData {
  id: string;
  name: string;
  gender: string;
  skill: string;
  job: string;
  serif: string;
  rarity: string;
  imageData: string;
  imagePrompt: string;
  rotationAngle: number;
}

const defaultAvatar: AvatarData = {
  id: AVATAR_STORE_KEY,
  name: '',
  gender: '男',
  skill: '',
  job: '',
  serif: '',
  rarity: '★1',
  imageData: '',
  imagePrompt: '',
  rotationAngle: 0,
};

export default function AvatarEdit() {
  const navigate = useNavigate();
  const { toast, confirm } = useUI();
  const [avatar, setAvatar] = useState<AvatarData>(defaultAvatar);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { generateResponse } = useLLM();

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const data = await loadAvatarData(AVATAR_STORE_KEY);
        if (data) {
          setAvatar(data);
        }
      } catch (err) {
        console.error(err);
        toast('アバターデータの読み込みに失敗しました。', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAvatar();
  }, [toast]);

  const handleInputChange = (field: keyof AvatarData, value: any) => {
    setAvatar((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!avatar.name.trim()) {
      toast('名前は必須です。', 'error');
      return;
    }
    try {
      await saveAvatarData(avatar);
      toast('アバターを保存しました。', 'success');
    } catch (err) {
      console.error(err);
      toast('保存に失敗しました。', 'error');
    }
  };

  const handleDeleteImage = async () => {
    if (await confirm('画像を削除しますか？')) {
      const updated = { ...avatar, imageData: '', rotationAngle: 0 };
      setAvatar(updated);
      try {
        await saveAvatarData(updated);
        toast('画像を削除しました。', 'success');
      } catch (e) {
        toast('画像の削除に失敗しました。', 'error');
      }
    }
  };

  const buildPrompt = () => {
    let prompt = '全身イラスト。';
    if (avatar.job) prompt += `職業は${avatar.job}。`;
    if (avatar.gender) prompt += `性別は${avatar.gender}。`;
    if (avatar.skill) prompt += `特技や特徴は${avatar.skill}。`;
    if (avatar.serif) prompt += `性格や雰囲気は「${avatar.serif}」。`;
    prompt += '背景はシンプルに。';
    return prompt;
  };

  const handleGenerateImage = async () => {
    const stabilityApiKey = localStorage.getItem('stabilityApiKey');
    if (!stabilityApiKey) {
      toast('設定画面からStability AIのAPIキーを設定してください。', 'error');
      return;
    }

    setIsGenerating(true);
    toast('画像を生成しています...', 'info');

    try {
      const promptJa = buildPrompt();
      const translationPrompt = `Translate Japanese description to English keywords/phrases for image prompt:\n---\n${promptJa}\n---\nEnglish Keywords:`;
      
      const promptEn = await generateResponse(translationPrompt, []);
      if (!promptEn?.trim()) throw new Error('翻訳結果が空です。');

      const isHighRarity = ['★3', '★4', '★5'].includes(avatar.rarity);
      const width = isHighRarity ? 832 : 1344;
      const height = isHighRarity ? 1216 : 768;

      const client = new StabilityApiClient();
      const imageResults = await client.generateImage(promptEn, stabilityApiKey, {
        samples: 1,
        width,
        height,
        style_preset: 'anime',
      });

      const base64ImageData = imageResults?.[0]?.imageDataB64;
      if (!base64ImageData) throw new Error('API画像データ取得失敗');

      const dataUrl = 'data:image/png;base64,' + base64ImageData;
      const updated = { ...avatar, imageData: dataUrl, imagePrompt: promptJa, rotationAngle: 0 };
      setAvatar(updated);
      await saveAvatarData(updated);
      toast('画像生成が完了しました！', 'success');
    } catch (err: any) {
      console.error(err);
      toast(`画像生成エラー: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRotate = () => {
    const newAngle = (avatar.rotationAngle + 90) % 360;
    setAvatar(prev => ({ ...prev, rotationAngle: newAngle }));
  };

  if (isLoading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>読み込み中...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn btn-glass" onClick={() => navigate('/')} title="メニューに戻る">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '4px' }}>あなたの分身</h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>ゲーム内でのあなた自身のアバターを作成します。</p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* 左側: プレビューエリア */}
        <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className={`card avatar-card rarity${avatar.rarity.replace('★', '')}`} style={{ width: '300px' }}>
            <div className="card-inner">
              <div className="card-front">
                <div className={`bezel rarity${avatar.rarity.replace('★', '')}`}></div>
                <div className="card-type">アバター</div>
                <div className="card-image" style={{ cursor: avatar.imageData ? 'pointer' : 'default', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {avatar.imageData ? (
                    <img 
                      src={avatar.imageData} 
                      alt="アバター" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        transform: `rotate(${avatar.rotationAngle}deg)`,
                        transition: 'transform 0.3s ease'
                      }} 
                    />
                  ) : (
                    <button className="btn btn-primary" onClick={handleGenerateImage} disabled={isGenerating}>
                      {isGenerating ? <RefreshCw size={18} className="spin" /> : <User size={18} />} 画像生成
                    </button>
                  )}
                </div>
                <div className="card-info">
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1em' }}>{avatar.name || '(名称未設定)'}</h3>
                  <p style={{ fontSize: '0.9em', margin: '2px 0' }}><strong>性別:</strong> {avatar.gender}</p>
                  {avatar.job && <p style={{ fontSize: '0.9em', margin: '2px 0' }}><strong>職業:</strong> {avatar.job}</p>}
                  {avatar.skill && <p style={{ fontSize: '0.9em', margin: '2px 0' }}><strong>特技:</strong> {avatar.skill}</p>}
                  {avatar.serif && <p style={{ fontSize: '0.9em', marginTop: '8px', fontStyle: 'italic' }}>“{avatar.serif}”</p>}
                </div>
              </div>
            </div>
          </div>
          {avatar.imageData && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button className="btn btn-glass" onClick={handleRotate}>
                <RefreshCw size={16} style={{ marginRight: '4px' }} /> 回転
              </button>
              <button className="btn" style={{ backgroundColor: 'rgba(244, 67, 54, 0.2)', color: '#f44336' }} onClick={handleDeleteImage}>
                <Trash2 size={16} style={{ marginRight: '4px' }} /> 削除
              </button>
            </div>
          )}
        </div>

        {/* 右側: フォームエリア */}
        <div className="glass-panel" style={{ flex: 1, minWidth: '300px', padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>名前 <span style={{ color: '#f44336', fontSize: '0.8em' }}>*必須</span></label>
            <input 
              type="text" 
              className="glass-input" 
              value={avatar.name} 
              onChange={(e) => handleInputChange('name', e.target.value)} 
              placeholder="アバターの名前"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>性別</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['男', '女', '不定'].map(g => (
                <button
                  key={g}
                  className={`chip ${avatar.gender === g ? 'selected' : ''}`}
                  onClick={() => handleInputChange('gender', g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>職業</label>
            <input 
              type="text" 
              className="glass-input" 
              value={avatar.job} 
              onChange={(e) => handleInputChange('job', e.target.value)} 
              placeholder="例: 剣士"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>特技・特徴</label>
            <textarea 
              className="glass-input" 
              value={avatar.skill} 
              onChange={(e) => handleInputChange('skill', e.target.value)} 
              placeholder="例: 火魔法"
              rows={2}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>決め台詞 / 口癖</label>
            <textarea 
              className="glass-input" 
              value={avatar.serif} 
              onChange={(e) => handleInputChange('serif', e.target.value)} 
              placeholder="短いセリフ"
              rows={2}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>レア度</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['★1', '★2', '★3', '★4', '★5'].map(r => (
                <button
                  key={r}
                  className={`chip ${avatar.rarity === r ? 'selected' : ''}`}
                  onClick={() => handleInputChange('rarity', r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginTop: '4px' }}>
              ※★3以上は縦長、★2以下は横長の画像が生成されます。
            </p>
          </div>

          <p style={{ fontSize: '0.8em', color: 'rgba(255,255,255,0.5)', marginTop: '24px', marginBottom: '16px' }}>
            ※名前以外は画像生成時の参考情報として使用されます。
          </p>

          <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', justifyContent: 'center' }}>
            <CheckCircle size={18} style={{ marginRight: '8px' }} /> 保存する
          </button>
        </div>
      </div>
    </div>
  );
}
