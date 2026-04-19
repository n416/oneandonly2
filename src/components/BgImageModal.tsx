import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Image as ImageIcon, Plus, Upload } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
import { getAllBgImages, deleteBgImage } from '../lib/indexedDB';
import { StabilityApiClient } from '../lib/stabilityApiClient';

interface BgImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBg: (dataUrl: string | null, id: number | null) => void;
}

export default function BgImageModal({ isOpen, onClose, onSelectBg }: BgImageModalProps) {
  const { toast, confirm } = useUI();
  const [images, setImages] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = async () => {
    try {
      const all = await getAllBgImages();
      setImages(all);
    } catch (e) {
      console.error(e);
      toast('背景リストの取得に失敗しました', 'error');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (await confirm('この背景画像を削除しますか？')) {
      try {
        await deleteBgImage(id);
        toast('背景画像を削除しました', 'success');
        fetchImages();
      } catch (err: any) {
        toast(`削除エラー: ${err.message}`, 'error');
      }
    }
  };

  const handleGenerate = async () => {
    const apiKey = localStorage.getItem('stabilityApiKey');
    if (!apiKey) {
      toast('SettingsからStability AIのAPIキーを設定してください。', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const promptEn = "beautiful cinematic scenery, fantasy landscape, highly detailed background, atmospheric lighting, concept art";
      
      const client = new StabilityApiClient();
      const results = await client.generateImage(promptEn, apiKey, {
        samples: 1,
        width: 1344,
        height: 768,
        style_preset: 'fantasy-art'
      });

      if (results && results.length > 0) {
        const dataUrl = 'data:image/png;base64,' + results[0].imageDataB64;
        const { addBgImage } = await import('../lib/indexedDB');
        const newId = await addBgImage(dataUrl);
        toast('新しい背景を生成しました！', 'success');
        fetchImages();
        onSelectBg(dataUrl, newId as number);
      }
    } catch (err: any) {
      console.error(err);
      toast('背景生成に失敗: ' + err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        try {
          const { addBgImage } = await import('../lib/indexedDB');
          const newId = await addBgImage(dataUrl);
          toast('ローカル画像を追加しました', 'success');
          fetchImages();
          onSelectBg(dataUrl, newId as number);
        } catch (err: any) {
          console.error(err);
          toast('画像の保存に失敗しました: ' + err.message, 'error');
        }
      }
    };
    reader.onerror = () => {
      toast('画像の読み込みに失敗しました', 'error');
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="modal active">
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
        <button className="modal-close" onClick={onClose}><X size={20} /></button>
        
        <h2 className="text-display" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ImageIcon size={24} /> 背景の選択
        </h2>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleGenerate} 
            disabled={isGenerating}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {isGenerating ? '生成中...' : <><Plus size={18} style={{ marginRight: '8px' }} /> 新規AI生成</>}
          </button>
          <button 
            className="btn btn-glass"
            onClick={() => fileInputRef.current?.click()}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <Upload size={18} style={{ marginRight: '8px' }} /> ローカル画像追加
          </button>
          <button 
            className="btn btn-glass" 
            onClick={() => onSelectBg(null, null)}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            背景なし
          </button>
        </div>
        <input 
          type="file" 
          accept="image/*" 
          style={{ display: 'none' }} 
          ref={fileInputRef}
          onChange={handleLocalImageUpload}
        />

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: '16px', 
          maxHeight: '60vh', 
          overflowY: 'auto',
          padding: '4px'
        }}>
          {images.map(img => (
            <div 
              key={img.id} 
              className="glass-panel hover-glow"
              style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden', aspectRatio: '16/9' }}
              onClick={() => onSelectBg(img.dataUrl, img.id)}
            >
              <img 
                src={img.dataUrl} 
                alt="背景" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
              />
              <button 
                className="btn btn-glass" 
                style={{ 
                  position: 'absolute', top: '8px', right: '8px', padding: '6px', 
                  background: 'rgba(0,0,0,0.6)', border: 'none', color: '#f44336' 
                }}
                onClick={(e) => handleDelete(img.id, e)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {images.length === 0 && !isGenerating && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.5)' }}>
              保存された背景がありません。「新規AI生成」から作成してください。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
