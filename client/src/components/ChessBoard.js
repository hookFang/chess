import React, { useState, useCallback } from 'react';
import { boardFromState, getLegalMoves, squareToRC, rcToSquare, PIECES, pieceColor } from '../utils/chess';

const BOARD_PX = 'min(520px, 88vw)';
const CELL = `calc(${BOARD_PX} / 8)`;

const CSS_KEYFRAMES = `
@keyframes dotPulse {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50%       { transform: scale(1.25); opacity: 1; }
}
@keyframes ringPulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50%       { opacity: 1; transform: scale(1.04); }
}
@keyframes checkFlash {
  0%,100% { box-shadow: inset 0 0 0 3px rgba(220,40,40,0.0); }
  50%     { box-shadow: inset 0 0 0 3px rgba(220,40,40,0.9), 0 0 18px rgba(220,40,40,0.5); }
}
`;

let _keyframesInjected = false;
function injectKeyframes() {
  if (_keyframesInjected) return;
  const el = document.createElement('style');
  el.textContent = CSS_KEYFRAMES;
  document.head.appendChild(el);
  _keyframesInjected = true;
}

function getSquareColors(r, c, selected, legalSet, lastMoveSet, isLight) {
  const key = `${r},${c}`;
  if (selected && selected[0] === r && selected[1] === c) {
    return isLight ? '#F0D060' : '#A07020';
  }
  if (lastMoveSet && lastMoveSet.has(key)) {
    return isLight ? '#D4B850' : '#7A5518';
  }
  if (legalSet && legalSet.has(key)) {
    return isLight ? '#B8E090' : '#527040';
  }
  return isLight ? '#DEB887' : '#6B3F20';
}

export default function ChessBoard({ boardState, currentTurn, myColor, onMove, gameOver, lastMove, inCheck }) {
  injectKeyframes();

  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [promotionPending, setPromotionPending] = useState(null);

  const board = boardFromState(boardState);
  const flipped = myColor === 'black';

  const legalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`));

  const lastMoveSet = new Set();
  if (lastMove) {
    try {
      const [fr, fc] = squareToRC(lastMove.from);
      const [tr, tc] = squareToRC(lastMove.to);
      lastMoveSet.add(`${fr},${fc}`);
      lastMoveSet.add(`${tr},${tc}`);
    } catch {}
  }

  const canInteract = myColor && myColor === currentTurn && !gameOver;

  const handleSquareClick = useCallback((r, c) => {
    if (!canInteract) return;

    const piece = board[r][c];
    const clickedColor = piece ? pieceColor(piece) : null;
    const myColorChar = myColor === 'white' ? 'w' : 'b';

    if (selected && legalSet.has(`${r},${c}`)) {
      const fromSq = rcToSquare(selected[0], selected[1]);
      const toSq = rcToSquare(r, c);
      const movingPiece = board[selected[0]][selected[1]];
      const pieceType = movingPiece ? movingPiece[1] : null;
      const promRow = myColor === 'white' ? 0 : 7;

      if (pieceType === 'P' && r === promRow) {
        setPromotionPending({ from: fromSq, to: toSq, piece: movingPiece });
        setSelected(null);
        setLegalMoves([]);
        return;
      }

      onMove({ from: fromSq, to: toSq, piece: movingPiece });
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    if (piece && clickedColor === myColorChar) {
      setSelected([r, c]);
      setLegalMoves(getLegalMoves(board, r, c));
      return;
    }

    setSelected(null);
    setLegalMoves([]);
  }, [board, selected, legalSet, canInteract, myColor, onMove]);

  const rows = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
      {promotionPending && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: '#221E17', border: '1px solid #C9A84C', borderRadius: 12,
            padding: '2rem', textAlign: 'center',
          }}>
            <div style={{ color: '#EDE0C8', fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', marginBottom: '1rem' }}>
              Promote pawn to:
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {['Q','R','B','N'].map(p => {
                const color = myColor === 'white' ? 'w' : 'b';
                return (
                  <button key={p} onClick={() => { onMove({ ...promotionPending, promotion: p }); setPromotionPending(null); }} style={{
                    width: 64, height: 64, fontSize: 40, background: '#2E2820',
                    border: '1px solid #7A6030', borderRadius: 8, cursor: 'pointer',
                    color: '#EDE0C8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {PIECES[color + p]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Rank labels */}
        <div style={{ display: 'flex', flexDirection: 'column', marginRight: 4 }}>
          {rows.map(r => (
            <div key={r} style={{
              height: CELL,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              color: '#8A7A60', fontSize: '0.7rem', paddingRight: 4, fontFamily: 'EB Garamond, serif',
            }}>
              {8 - r}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Board */}
          <div style={{
            width: BOARD_PX, height: BOARD_PX,
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)',
            border: '3px solid #7A6030',
            outline: '2px solid #C9A84C',
            outlineOffset: 3,
            boxShadow: '0 0 30px rgba(0,0,0,0.8), 0 0 60px rgba(0,0,0,0.4)',
            cursor: canInteract ? 'pointer' : 'default',
          }}>
            {rows.map(r =>
              cols.map(c => {
                const isLight = (r + c) % 2 === 0;
                const piece = board[r][c];
                const squareColor = getSquareColors(r, c, selected, legalSet, lastMoveSet, isLight);
                const isLegalTarget = legalSet.has(`${r},${c}`);
                const isEmpty = !piece;
                const isCheck = inCheck && piece === (currentTurn === 'white' ? 'wK' : 'bK');

                return (
                  <div
                    key={`${r}-${c}`}
                    data-testid={`square-${rcToSquare(r, c)}`}
                    onClick={() => handleSquareClick(r, c)}
                    style={{
                      background: squareColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                      transition: 'background 0.15s',
                      animation: isCheck ? 'checkFlash 0.8s ease-in-out infinite' : 'none',
                    }}
                  >
                    {isLegalTarget && isEmpty && (
                      <div style={{
                        width: '28%', height: '28%',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.22)',
                        pointerEvents: 'none',
                        animation: 'dotPulse 1.4s ease-in-out infinite',
                      }} />
                    )}
                    {isLegalTarget && !isEmpty && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        borderRadius: '50%',
                        border: '3px solid rgba(0,0,0,0.22)',
                        pointerEvents: 'none',
                        animation: 'ringPulse 1.4s ease-in-out infinite',
                      }} />
                    )}
                    {piece && (
                      <span style={{
                        fontSize: `calc(${BOARD_PX} / 9.5)`,
                        lineHeight: 1,
                        filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.7))',
                        zIndex: 1,
                        color: piece[0] === 'w' ? '#F7EDD8' : '#130C04',
                        textShadow: piece[0] === 'w'
                          ? '0 2px 6px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9)'
                          : '-1px -1px 0 rgba(180,130,40,0.55), 1px -1px 0 rgba(180,130,40,0.55), -1px 1px 0 rgba(180,130,40,0.55), 1px 1px 0 rgba(180,130,40,0.55), 0 2px 6px rgba(0,0,0,0.8)',
                      }}>
                        {PIECES[piece] || piece}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* File labels */}
          <div style={{ display: 'flex', width: BOARD_PX, paddingLeft: 0 }}>
            {cols.map(c => (
              <div key={c} style={{
                flex: 1, textAlign: 'center',
                color: '#8A7A60', fontSize: '0.7rem',
                paddingTop: 4, fontFamily: 'EB Garamond, serif',
              }}>
                {'abcdefgh'[c]}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
