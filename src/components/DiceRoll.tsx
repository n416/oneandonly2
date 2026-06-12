import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RollResult } from '../lib/diceSystem';
import { Dices, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';

interface DiceRollProps {
  result: RollResult;
  onComplete: () => void;
}

const renderDiceIcon = (val: number) => {
  switch(val) {
    case 1: return <Dice1 size={48} strokeWidth={1.5} />;
    case 2: return <Dice2 size={48} strokeWidth={1.5} />;
    case 3: return <Dice3 size={48} strokeWidth={1.5} />;
    case 4: return <Dice4 size={48} strokeWidth={1.5} />;
    case 5: return <Dice5 size={48} strokeWidth={1.5} />;
    case 6: return <Dice6 size={48} strokeWidth={1.5} />;
    default: return <Dice1 size={48} strokeWidth={1.5} />;
  }
};

export default function DiceRoll({ result, onComplete }: DiceRollProps) {
  const [d1, setD1] = useState(1);
  const [d2, setD2] = useState(1);
  const [isRolling, setIsRolling] = useState(true);
  const [rotation1, setRotation1] = useState(0);
  const [rotation2, setRotation2] = useState(0);

  useEffect(() => {
    let rollInterval: number;
    let timeout: number;

    if (isRolling) {
      rollInterval = window.setInterval(() => {
        setD1(Math.floor(Math.random() * 6) + 1);
        setD2(Math.floor(Math.random() * 6) + 1);
        setRotation1(Math.floor(Math.random() * 40) - 20);
        setRotation2(Math.floor(Math.random() * 40) - 20);
      }, 50);

      timeout = window.setTimeout(() => {
        setIsRolling(false);
        setD1(result.dice[0]);
        setD2(result.dice[1]);
        setRotation1(0);
        setRotation2(0);
      }, 800);
    }

    return () => {
      clearInterval(rollInterval);
      clearTimeout(timeout);
    };
  }, [isRolling, result]);

  useEffect(() => {
    if (!isRolling) {
      const t = window.setTimeout(onComplete, 1500);
      return () => window.clearTimeout(t);
    }
  }, [isRolling, onComplete]);

  let outcomeText = '';
  let outcomeColor = '';
  
  if (!isRolling) {
    switch (result.outcome) {
      case 'success':
        outcomeText = '成功!';
        outcomeColor = '#4ade80'; // 緑系
        break;
      case 'partial':
        outcomeText = '成功… だが代償が';
        outcomeColor = '#facc15'; // 黄系
        break;
      case 'failure':
        outcomeText = '失敗…';
        outcomeColor = '#ef4444'; // 赤系
        break;
    }
  }

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onComplete} // タップでスキップ可
    >
      <div 
        className="glass-panel" 
        style={{
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          animation: 'fadeIn 0.3s ease-out',
          minWidth: '320px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          border: '1px solid rgba(167, 139, 250, 0.4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary, #a78bfa)' }}>
          <Dices size={28} />
          <span style={{ fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '2px' }}>2d6 判定</span>
        </div>
        
        <div style={{ display: 'flex', gap: '24px', color: '#fff' }}>
          <div style={{
            width: '80px', height: '80px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isRolling ? 'rgba(255,255,255,0.05)' : 'rgba(167, 139, 250, 0.2)',
            borderRadius: '16px',
            border: `2px solid ${isRolling ? 'rgba(255,255,255,0.2)' : 'rgba(167, 139, 250, 0.6)'}`,
            boxShadow: isRolling ? 'none' : '0 0 20px rgba(167, 139, 250, 0.4)',
            transform: `rotate(${rotation1}deg) scale(${isRolling ? 1.05 : 1})`,
            transition: isRolling ? 'none' : 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {renderDiceIcon(d1)}
          </div>
          <div style={{
            width: '80px', height: '80px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isRolling ? 'rgba(255,255,255,0.05)' : 'rgba(167, 139, 250, 0.2)',
            borderRadius: '16px',
            border: `2px solid ${isRolling ? 'rgba(255,255,255,0.2)' : 'rgba(167, 139, 250, 0.6)'}`,
            boxShadow: isRolling ? 'none' : '0 0 20px rgba(167, 139, 250, 0.4)',
            transform: `rotate(${rotation2}deg) scale(${isRolling ? 1.05 : 1})`,
            transition: isRolling ? 'none' : 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {renderDiceIcon(d2)}
          </div>
        </div>

        {!isRolling && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ fontSize: '1.2rem' }}>
              合計: <span style={{ fontWeight: 'bold' }}>{result.total}</span>
              {result.modifier > 0 && <span style={{ fontSize: '0.9rem', color: '#9ca3af', marginLeft: '8px' }}>(+{result.modifier})</span>}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: outcomeColor }}>
              {outcomeText}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>
              タップして続行
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
