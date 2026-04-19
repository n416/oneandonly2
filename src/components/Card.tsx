import React, { useState } from 'react';
import { ImageIcon, Trash2, RotateCcw, XCircle } from 'lucide-react';
import DOMPurify from 'dompurify';

export interface CardData {
  id: string;
  name: string;
  type: string;
  rarity?: string;
  state?: string;
  special?: string;
  caption?: string;
  imageprompt?: string;
  imageData?: string;
  backgroundcss?: string;
  group?: string;
  role?: string;
  partyId?: number | null;
  flipped?: boolean;
}

interface CardProps {
  card: CardData;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onCardClick?: (card: CardData) => void;
  // 以下はオプション（用途に応じて）
  onGenerateImage?: (card: CardData) => void;
  onTrash?: (card: CardData) => void;
  onRestore?: (card: CardData) => void;
  onDeletePermanent?: (card: CardData) => void;
  showRoleButtons?: boolean;
  onToggleRole?: (card: CardData, role: string) => void;
}

export default function Card({
  card,
  isSelected,
  isSelectionMode,
  onCardClick,
  onGenerateImage,
  onTrash,
  onRestore,
  onDeletePermanent,
  showRoleButtons,
  onToggleRole
}: CardProps) {
  const [isFlipped, setIsFlipped] = useState(card.flipped || false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelectionMode) {
      if (onCardClick) onCardClick(card);
    } else {
      setIsFlipped(!isFlipped);
      if (onCardClick) onCardClick(card);
    }
  };

  const getRarityVal = (r: string = '★1') => {
    const starMatch = r.match(/★/g);
    if (starMatch && starMatch.length > 1) return starMatch.length;
    const num = parseInt(r.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 1 : num;
  };
  const rarityVal = getRarityVal(card.rarity);
  
  const bgStyle = (card.backgroundcss || '').replace(/background[^:]*:/i, '').trim();

  return (
    <div 
      className={`card rarity${rarityVal} ${isSelected ? 'selected' : ''} ${isFlipped && !isSelectionMode ? 'flipped' : ''}`}
      onClick={handleClick}
      data-id={card.id}
      style={{ width: '220px', minWidth: '220px' }} // Slightly smaller than default for grid
    >
      <div className="card-inner">
        <div className="card-front" style={{ background: bgStyle || undefined }}>
          <div className={`bezel rarity${rarityVal}`}></div>
          <div className="card-type">{card.type || '不明'}</div>
          
          <div className="card-image" style={{ position: 'relative' }}>
            {card.imageData ? (
              <img src={card.imageData} alt={card.name} loading="lazy" />
            ) : (
              <div style={{ color: '#aaa', fontSize: '0.8rem', textAlign: 'center' }}>
                (画像なし)
              </div>
            )}
            {!card.imageData && onGenerateImage && (
              <button 
                className="gen-image-btn"
                onClick={(e) => { e.stopPropagation(); onGenerateImage(card); }}
              >
                <ImageIcon size={14} style={{ marginRight: '4px' }}/> 生成
              </button>
            )}
          </div>
          
          <div className="card-info">
            <h3 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(card.name || '無名') }} />
            {card.state && <p><strong>状態:</strong> {DOMPurify.sanitize(card.state)}</p>}
            {card.special && <p><strong>特技:</strong> {DOMPurify.sanitize(card.special)}</p>}
            {card.caption && <p><span>{DOMPurify.sanitize(card.caption)}</span></p>}
            
            {showRoleButtons && card.type === 'キャラクター' && (
              <div style={{ display: 'flex', gap: '4px', marginTop: 'auto', paddingTop: '8px' }}>
                <button 
                  className="btn btn-glass" 
                  style={{ fontSize: '0.7rem', padding: '4px 8px', flex: 1, backgroundColor: card.role === 'avatar' ? '#4caf50' : '' }}
                  onClick={(e) => { e.stopPropagation(); if (onToggleRole) onToggleRole(card, 'avatar'); }}
                >
                  アバター
                </button>
                <button 
                  className="btn btn-glass" 
                  style={{ fontSize: '0.7rem', padding: '4px 8px', flex: 1, backgroundColor: card.role === 'partner' ? '#2196f3' : '' }}
                  onClick={(e) => { e.stopPropagation(); if (onToggleRole) onToggleRole(card, 'partner'); }}
                >
                  パートナー
                </button>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div style={{ position: 'absolute', bottom: '5px', right: '5px', display: 'flex', gap: '5px', zIndex: 5 }}>
            {onRestore && (
              <button 
                className="btn" style={{ padding: '4px', minWidth: 'auto', minHeight: 'auto', backgroundColor: '#4caf50' }}
                onClick={(e) => { e.stopPropagation(); onRestore(card); }}
                title="倉庫へ戻す"
              >
                <RotateCcw size={14} />
              </button>
            )}
            {onDeletePermanent && (
              <button 
                className="btn" style={{ padding: '4px', minWidth: 'auto', minHeight: 'auto', backgroundColor: '#f44336' }}
                onClick={(e) => { e.stopPropagation(); onDeletePermanent(card); }}
                title="完全削除"
              >
                <XCircle size={14} />
              </button>
            )}
            {onTrash && (
              <button 
                className="btn" style={{ padding: '4px', minWidth: 'auto', minHeight: 'auto', backgroundColor: '#f44336' }}
                onClick={(e) => { e.stopPropagation(); onTrash(card); }}
                title="ゴミ箱へ"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

        </div>
        <div className="card-back">
          <strong>{DOMPurify.sanitize(card.type || '?')}</strong>
        </div>
      </div>
    </div>
  );
}
