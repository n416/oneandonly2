import React, { useState, useRef } from 'react';
import { ImageIcon, Trash2, RotateCcw, XCircle, Bookmark, BookmarkPlus, BookmarkMinus } from 'lucide-react';
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
  inDeck?: boolean;
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
  onToggleDeck?: (card: CardData) => void;
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
  onToggleRole,
  onToggleDeck
}: CardProps) {
  const [isFlipped, setIsFlipped] = useState(card.flipped || false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [pointerParams, setPointerParams] = useState({ px: 50, py: 50, rx: 0, ry: 0, opacity: 0 });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelectionMode) {
      if (onCardClick) onCardClick(card);
    } else {
      setIsFlipped(!isFlipped);
      if (onCardClick) onCardClick(card);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const px = Math.min(Math.max((x / w) * 100, 0), 100);
    const py = Math.min(Math.max((y / h) * 100, 0), 100);

    const rx = ((px - 50) / 50) * 15; // -15deg to +15deg (Y-axis rotation based on X position)
    const ry = -((py - 50) / 50) * 15; // -15deg to +15deg (X-axis rotation based on Y position)

    setPointerParams({ px, py, rx, ry, opacity: 1 });
  };

  const handlePointerOut = () => {
    setPointerParams(prev => ({ ...prev, rx: 0, ry: 0, opacity: 0 }));
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
      ref={cardRef}
      className={`card rarity${rarityVal} ${isSelected ? 'selected' : ''} ${isFlipped && !isSelectionMode ? 'flipped' : ''}`}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerOut}
      data-id={card.id}
      style={{ 
        width: '220px', 
        minWidth: '220px',
        border: card.inDeck ? '1px solid rgba(236, 72, 153, 0.6)' : undefined,
        boxShadow: card.inDeck ? '0 0 20px rgba(168, 85, 247, 0.5), inset 0 0 15px rgba(236, 72, 153, 0.3)' : undefined,
        '--pointer-x': `${pointerParams.px}%`,
        '--pointer-y': `${pointerParams.py}%`,
        '--rx': `${pointerParams.rx}deg`,
        '--ry': `${pointerParams.ry}deg`,
        '--h-opacity': pointerParams.opacity,
      } as React.CSSProperties}
    >
      <div className="card-inner">
        <div className="card-front" style={{ background: bgStyle || undefined }}>
          {/* Hologram Layers (Behind UI) */}
          <div className="card-hologram"></div>
          <div className="card-glare"></div>

          {/* UI Container (Above Hologram) */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {card.inDeck && (
              <div style={{ position: 'absolute', top: '-6px', right: '-6px', color: '#fbcfe8', background: 'linear-gradient(135deg, #d946ef, #8b5cf6)', padding: '6px', borderRadius: '50%', zIndex: 10, boxShadow: '0 4px 12px rgba(217, 70, 239, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bookmark size={14} strokeWidth={2.5} />
              </div>
            )}
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
        </div>
      </div>
      <div className="card-back">
        <strong style={{ fontSize: '0.9rem', color: '#94a3b8', letterSpacing: '2px' }}>{DOMPurify.sanitize(card.type || 'UNKNOWN')}</strong>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '24px' }}>
            {onToggleDeck && (
              <button 
                className="btn btn-glass" 
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '24px',
                  background: card.inDeck ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  color: card.inDeck ? '#fbcfe8' : '#fff',
                  border: card.inDeck ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid rgba(255,255,255,0.2)',
                  width: '100%',
                  justifyContent: 'center'
                }}
                onClick={(e) => { e.stopPropagation(); onToggleDeck(card); }}
              >
                {card.inDeck ? <><BookmarkMinus size={16} /> デッキから外す</> : <><BookmarkPlus size={16} /> デッキに追加</>}
              </button>
            )}

            {onRestore && (
              <button 
                className="btn btn-glass" 
                style={{ padding: '8px 16px', borderRadius: '24px', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.3)', width: '100%', justifyContent: 'center' }}
                onClick={(e) => { e.stopPropagation(); onRestore(card); }}
              >
                <RotateCcw size={16} /> 倉庫へ戻す
              </button>
            )}
            
            {onTrash && (
              <button 
                className="btn btn-glass" 
                style={{ padding: '8px 16px', borderRadius: '24px', background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)', width: '100%', justifyContent: 'center' }}
                onClick={(e) => { e.stopPropagation(); onTrash(card); }}
              >
                <Trash2 size={16} /> ゴミ箱へ
              </button>
            )}

            {onDeletePermanent && (
              <button 
                className="btn btn-glass" 
                style={{ padding: '8px 16px', borderRadius: '24px', background: 'rgba(220, 38, 38, 0.2)', color: '#ef4444', border: '1px solid rgba(220, 38, 38, 0.5)', width: '100%', justifyContent: 'center' }}
                onClick={(e) => { e.stopPropagation(); onDeletePermanent(card); }}
              >
                <XCircle size={16} /> 完全削除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
