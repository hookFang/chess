import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiRequest, getWsUrl } from '../utils/api';
import ChessBoard from '../components/ChessBoard';
import { PIECES } from '../utils/chess';

/* ─── Piece value for sorting captured pieces ─── */
const PIECE_VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

function sortCaptured(arr) {
  return [...arr].sort((a, b) => PIECE_VALUE[b[1]] - PIECE_VALUE[a[1]]);
}

/* ─── CapturedPieces bar ─── */
function CapturedPieces({ pieces, label }) {
  const sorted = sortCaptured(pieces);
  if (!sorted.length) return (
    <div style={{ color: 'rgba(138,122,96,0.4)', fontSize: '0.78rem', fontStyle: 'italic', minHeight: 28 }}>
      No captures
    </div>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, minHeight: 28, alignItems: 'center' }}>
      {sorted.map((p, i) => {
        const isWhite = p[0] === 'w';
        return (
          <span key={i} style={{
            fontSize: '1.1rem', lineHeight: 1,
            color: isWhite ? '#F0E6D0' : '#1A0E05',
            textShadow: isWhite
              ? '0 1px 3px rgba(0,0,0,0.9)'
              : '-0.5px -0.5px 0 rgba(180,130,40,0.6), 0.5px 0.5px 0 rgba(0,0,0,0.8)',
            filter: isWhite ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' : 'none',
          }}>
            {PIECES[p]}
          </span>
        );
      })}
    </div>
  );
}

/* ─── Player card ─── */
function PlayerCard({ player, color, isActive, isMe, capturedPieces }) {
  const sym = color === 'white' ? '♔' : '♚';
  const symColor = color === 'white' ? '#F0E6D0' : '#1A0E05';
  const symShadow = color === 'white'
    ? '0 2px 4px rgba(0,0,0,0.9)'
    : '-1px -1px 0 rgba(180,130,40,0.5), 1px 1px 0 rgba(0,0,0,0.8)';

  return (
    <div style={{
      background: isActive
        ? 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(46,40,32,0.9))'
        : 'linear-gradient(135deg, rgba(30,25,16,0.8), rgba(24,21,16,0.9))',
      border: `1px solid ${isActive ? 'rgba(201,168,76,0.5)' : 'rgba(60,50,36,0.6)'}`,
      borderRadius: 10,
      padding: '0.8rem 1rem',
      transition: 'all 0.35s ease',
      boxShadow: isActive ? '0 0 20px rgba(201,168,76,0.12), inset 0 1px 0 rgba(201,168,76,0.1)' : 'none',
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.4rem', color: symColor, textShadow: symShadow, lineHeight: 1 }}>
          {sym}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{
            color: isActive ? '#EDE0C8' : '#8A7A60',
            fontFamily: 'Playfair Display, serif', fontWeight: 600,
            fontSize: '0.95rem', transition: 'color 0.3s',
          }}>
            {player?.username || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Waiting…</span>}
            {isMe && <span style={{ color: 'rgba(201,168,76,0.6)', fontWeight: 400, fontSize: '0.78rem', marginLeft: 4 }}>(you)</span>}
          </div>
          <div style={{ color: '#5A4A38', fontSize: '0.72rem', textTransform: 'capitalize', marginTop: 1 }}>{color}</div>
        </div>
        {isActive && (
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#C9A84C',
            boxShadow: '0 0 8px rgba(201,168,76,0.8)',
            animation: 'activePulse 1.6s ease-in-out infinite',
          }} />
        )}
      </div>
      <CapturedPieces pieces={capturedPieces} />
    </div>
  );
}

/* ─── Connection badge ─── */
function ConnectionBadge({ status }) {
  const cfg = {
    connected:    { dot: '#4A9B6A', label: 'Live',          glow: 'rgba(74,155,106,0.5)' },
    connecting:   { dot: '#C9A84C', label: 'Connecting…',   glow: 'rgba(201,168,76,0.5)' },
    disconnected: { dot: '#B84040', label: 'Reconnecting…', glow: 'rgba(184,64,64,0.5)' },
  }[status] || { dot: '#5A4A38', label: status, glow: 'transparent' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: cfg.dot,
        boxShadow: `0 0 6px ${cfg.glow}`,
        animation: status === 'connected' ? 'none' : 'activePulse 1.2s infinite',
      }} />
      <span style={{ color: 'rgba(138,122,96,0.7)', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
        {cfg.label}
      </span>
    </div>
  );
}

/* ─── Move history panel ─── */
function MoveHistory({ moves }) {
  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push({ w: moves[i], b: moves[i + 1], n: Math.floor(i / 2) + 1 });
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [moves]);

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '0.5rem 0.25rem',
      fontFamily: "'Courier New', monospace",
    }}>
      {pairs.length === 0 ? (
        <div style={{ color: 'rgba(90,74,56,0.6)', fontSize: '0.82rem', fontStyle: 'italic', padding: '0.5rem' }}>
          No moves yet
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            {pairs.map(({ w, b, n }, i) => {
              const isLast = i === pairs.length - 1;
              return (
                <tr key={n} style={{
                  background: n % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                }}>
                  <td style={{ color: '#3A3020', paddingRight: '0.4rem', width: 20, fontSize: '0.72rem', paddingLeft: 4 }}>{n}.</td>
                  <td style={{
                    color: isLast && !b ? '#E8C97A' : 'rgba(237,224,200,0.85)',
                    fontWeight: isLast && !b ? 700 : 400,
                    padding: '2px 4px',
                    borderRadius: 3,
                    background: isLast && !b ? 'rgba(201,168,76,0.1)' : 'transparent',
                  }}>
                    {w?.notation || '—'}
                  </td>
                  <td style={{
                    color: isLast && b ? '#E8C97A' : 'rgba(237,224,200,0.75)',
                    fontWeight: isLast && b ? 700 : 400,
                    padding: '2px 4px',
                    borderRadius: 3,
                    background: isLast && b ? 'rgba(201,168,76,0.1)' : 'transparent',
                  }}>
                    {b?.notation || ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div ref={endRef} />
    </div>
  );
}

/* ─── Game over overlay ─── */
function GameOverOverlay({ data, myColor, username, onNewGame, onLobby }) {
  if (!data) return null;
  const { status, winnerColor, resignedBy, winnerId } = data;

  let headline, sub, isWin, isDraw;
  if (status === 'checkmate') {
    if (winnerColor === myColor) { headline = 'Victory'; sub = 'Checkmate'; isWin = true; }
    else { headline = 'Defeated'; sub = 'Checkmate'; isWin = false; }
  } else if (status === 'stalemate') {
    headline = 'Stalemate'; sub = 'No legal moves'; isDraw = true;
  } else if (status === 'resignation') {
    if (resignedBy === username) { headline = 'Resigned'; sub = 'Better luck next time'; isWin = false; }
    else { headline = 'Victory'; sub = `${resignedBy} resigned`; isWin = true; }
  } else if (status === 'draw') {
    headline = 'Draw'; sub = 'Agreed draw'; isDraw = true;
  } else {
    headline = 'Game Over'; sub = ''; isDraw = true;
  }

  const accent = isWin ? '#4A9B6A' : isDraw ? '#C9A84C' : '#B84040';
  const glow = isWin ? 'rgba(74,155,106,0.3)' : isDraw ? 'rgba(201,168,76,0.2)' : 'rgba(184,64,64,0.25)';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300,
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1A1610, #221E15)',
        border: `1px solid ${accent}`,
        borderRadius: 20,
        padding: '2.5rem 3rem',
        textAlign: 'center',
        boxShadow: `0 32px 80px rgba(0,0,0,0.9), 0 0 60px ${glow}`,
        minWidth: 320,
        animation: 'gameOverAppear 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
          {isWin ? '♔' : isDraw ? '½' : '♚'}
        </div>
        <h2 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '2.2rem', fontWeight: 700,
          color: accent, margin: '0 0 0.4rem',
          textShadow: `0 0 30px ${glow}`,
        }}>
          {headline}
        </h2>
        <p style={{ color: 'rgba(237,224,200,0.6)', marginBottom: '2rem', fontSize: '1rem' }}>{sub}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={onNewGame} style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
            border: 'none', borderRadius: 8,
            color: '#0E0C09', fontFamily: 'EB Garamond, serif',
            fontSize: '1rem', fontWeight: 700,
            padding: '0.65rem 1.5rem', cursor: 'pointer',
            boxShadow: `0 4px 20px ${glow}`,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            New Game
          </button>
          <button onClick={onLobby} style={{
            background: 'transparent',
            border: `1px solid rgba(138,122,96,0.4)`,
            borderRadius: 8, color: 'rgba(237,224,200,0.7)',
            fontFamily: 'EB Garamond, serif', fontSize: '1rem',
            padding: '0.65rem 1.5rem', cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.6)'; e.currentTarget.style.color = '#C9A84C'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(138,122,96,0.4)'; e.currentTarget.style.color = 'rgba(237,224,200,0.7)'; }}
          >
            Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Icon button ─── */
function IconBtn({ label, icon, onClick, danger, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: danger ? 'rgba(184,64,64,0.1)' : 'rgba(201,168,76,0.06)',
      border: `1px solid ${danger ? 'rgba(184,64,64,0.4)' : 'rgba(201,168,76,0.2)'}`,
      borderRadius: 8, color: danger ? '#B84040' : 'rgba(201,168,76,0.7)',
      fontFamily: 'EB Garamond, serif', fontSize: '0.85rem',
      padding: '0.45rem 0.85rem', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = danger ? 'rgba(184,64,64,0.18)' : 'rgba(201,168,76,0.12)'; e.currentTarget.style.borderColor = danger ? 'rgba(184,64,64,0.7)' : 'rgba(201,168,76,0.5)'; }}}
      onMouseLeave={e => { e.currentTarget.style.background = danger ? 'rgba(184,64,64,0.1)' : 'rgba(201,168,76,0.06)'; e.currentTarget.style.borderColor = danger ? 'rgba(184,64,64,0.4)' : 'rgba(201,168,76,0.2)'; }}
    >
      <span>{icon}</span> {label}
    </button>
  );
}

/* ════════════════════════════════════════════════
   MAIN GAME PAGE
═══════════════════════════════════════════════════ */
export default function GamePage() {
  const { roomId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom]               = useState(null);
  const [boardState, setBoardState]   = useState('start');
  const [currentTurn, setCurrentTurn] = useState('white');
  const [myColor, setMyColor]         = useState(null);
  const [moves, setMoves]             = useState([]);
  const [lastMove, setLastMove]       = useState(null);
  const [inCheck, setInCheck]         = useState(false);
  const [gameOver, setGameOver]       = useState(false);
  const [gameOverData, setGameOverData] = useState(null);
  const [wsStatus, setWsStatus]       = useState('connecting');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Captured pieces: pieces each side has taken
  const [capturedByWhite, setCapturedByWhite] = useState([]); // pieces white captured (black pieces)
  const [capturedByBlack, setCapturedByBlack] = useState([]); // pieces black captured (white pieces)

  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const isMounted      = useRef(true);

  function buildCaptured(movesArr) {
    const byWhite = [], byBlack = [];
    for (const m of movesArr) {
      if (!m.captured) continue;
      if (m.piece?.[0] === 'w') byWhite.push(m.captured);
      else byBlack.push(m.captured);
    }
    return { byWhite, byBlack };
  }

  const fetchRoom = useCallback(async () => {
    try {
      const data = await apiRequest(`/rooms/${roomId}`, {}, token);
      if (!isMounted.current) return;
      setRoom(data);
      setBoardState(data.boardState);
      setCurrentTurn(data.currentTurn);
      setMyColor(data.myColor);
      setMoves(data.moves || []);
      const { byWhite, byBlack } = buildCaptured(data.moves || []);
      setCapturedByWhite(byWhite);
      setCapturedByBlack(byBlack);
      if (data.moves?.length) {
        const last = data.moves[data.moves.length - 1];
        setLastMove({ from: last.from, to: last.to });
      }
      if (data.status === 'finished') {
        setGameOver(true);
        if (!gameOverData) setGameOverData({ status: data.status, winnerId: data.winner?.id });
      }
    } catch (err) {
      console.error('Failed to fetch room:', err);
    }
  }, [roomId, token, gameOverData]);

  const joinRoom = useCallback(async () => {
    try { await apiRequest(`/rooms/${roomId}/join`, { method: 'POST' }, token); }
    catch {}
  }, [roomId, token]);

  const connectWs = useCallback(() => {
    if (!token || !roomId) return;
    const ws = new WebSocket(getWsUrl(roomId, token));
    wsRef.current = ws;
    setWsStatus('connecting');

    ws.onopen  = () => { if (isMounted.current) setWsStatus('connected'); };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (!isMounted.current) return;
      setWsStatus('disconnected');
      reconnectTimer.current = setTimeout(() => { if (isMounted.current) connectWs(); }, 3000);
    };

    ws.onmessage = (event) => {
      if (!isMounted.current) return;
      let msg; try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'connected') {
        setMyColor(msg.color);
      } else if (msg.type === 'move') {
        setBoardState(msg.boardState);
        setCurrentTurn(msg.nextTurn);
        setInCheck(msg.inCheck || false);
        setLastMove({ from: msg.from, to: msg.to });
        setMoves(prev => [...prev, {
          from: msg.from, to: msg.to, piece: msg.piece,
          captured: msg.captured, notation: msg.notation, moveNumber: msg.moveNumber,
        }]);
        if (msg.captured) {
          const moverIsWhite = msg.piece?.[0] === 'w';
          if (moverIsWhite) setCapturedByWhite(p => [...p, msg.captured]);
          else setCapturedByBlack(p => [...p, msg.captured]);
        }
      } else if (msg.type === 'player_joined') {
        fetchRoom();
      } else if (msg.type === 'game_over') {
        setGameOver(true);
        setGameOverData(msg);
        setInCheck(false);
      }
    };
  }, [token, roomId, fetchRoom]);

  useEffect(() => {
    isMounted.current = true;
    joinRoom().then(() => { fetchRoom(); connectWs(); });
    return () => {
      isMounted.current = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [roomId, token]); // eslint-disable-line

  function handleMove(moveData) {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: 'move', ...moveData }));
  }
  function handleResign() {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    if (!window.confirm('Resign this game?')) return;
    wsRef.current.send(JSON.stringify({ type: 'resign' }));
  }
  function handleCopyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/game/${roomId}`).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }

  const isMyTurn     = myColor && currentTurn === myColor;
  const gameActive   = room?.status === 'active' && !gameOver;
  const whitePlayer  = room?.whitePlayer;
  const blackPlayer  = room?.blackPlayer;
  const opponent     = myColor === 'white' ? blackPlayer : whitePlayer;
  const opponentColor = myColor === 'white' ? 'black' : 'white';

  /* Status line text */
  function statusText() {
    if (gameOver) return 'Game ended';
    if (room?.status === 'waiting') return 'Waiting for opponent…';
    if (inCheck) return isMyTurn ? '⚠ You are in check!' : `⚠ ${currentTurn} is in check`;
    if (isMyTurn) return '▶ Your move';
    return `${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)}'s move`;
  }
  const statusColor = inCheck ? '#E86060' : isMyTurn ? '#C9A84C' : 'rgba(138,122,96,0.7)';

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(30,22,10,1) 0%, rgba(8,7,4,1) 60%, rgba(4,6,10,1) 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'EB Garamond, serif',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Ambient background orbs */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)',
          top: '-100px', left: '50%', transform: 'translateX(-50%)',
        }} />
        <div style={{
          position: 'absolute', width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(60,40,100,0.06) 0%, transparent 70%)',
          bottom: '10%', right: '5%',
        }} />
      </div>

      <style>{`
        @keyframes activePulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.5; transform:scale(0.8); }
        }
        @keyframes gameOverAppear {
          0%   { opacity:0; transform:scale(0.8) translateY(20px); }
          100% { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes statusPulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.65; }
        }
      `}</style>

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.65rem 1.5rem',
        borderBottom: '1px solid rgba(201,168,76,0.08)',
        backdropFilter: 'blur(8px)',
        background: 'rgba(8,6,3,0.6)',
      }}>
        <button onClick={() => navigate('/lobby')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(138,122,96,0.7)', fontFamily: 'EB Garamond, serif', fontSize: '0.9rem',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          transition: 'color 0.2s',
          padding: 0,
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#C9A84C'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(138,122,96,0.7)'}
        >
          ← Lobby
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'Playfair Display, serif', color: 'rgba(201,168,76,0.6)', fontSize: '0.9rem', letterSpacing: '0.06em' }}>
            KING FALL
          </span>
        </div>

        <ConnectionBadge status={wsStatus} />
      </div>

      {/* Main 3-column layout */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '1.5rem', padding: '1.5rem',
        flexWrap: 'wrap',
      }}>

        {/* ── Left panel ── */}
        <div style={{
          width: 240, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          alignSelf: 'center',
        }}>
          {/* Opponent top */}
          <PlayerCard
            player={opponent}
            color={opponentColor}
            isActive={!gameOver && currentTurn === opponentColor}
            isMe={false}
            capturedPieces={myColor === 'white' ? capturedByBlack : capturedByWhite}
          />

          {/* Status pill */}
          <div style={{
            background: 'rgba(12,10,6,0.8)',
            border: '1px solid rgba(60,50,36,0.5)',
            borderRadius: 8, padding: '0.6rem 0.9rem',
            textAlign: 'center',
            backdropFilter: 'blur(4px)',
          }}>
            <span style={{
              color: statusColor, fontSize: '0.9rem', fontWeight: 600,
              animation: inCheck ? 'statusPulse 0.8s ease-in-out infinite' : 'none',
            }}>
              {statusText()}
            </span>
          </div>

          {/* Me bottom */}
          <PlayerCard
            player={{ username: user?.username }}
            color={myColor || 'white'}
            isActive={!gameOver && currentTurn === myColor}
            isMe={true}
            capturedPieces={myColor === 'white' ? capturedByWhite : capturedByBlack}
          />

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.25rem' }}>
            <IconBtn
              icon="⎘" label={copyFeedback ? 'Copied!' : 'Copy invite'}
              onClick={handleCopyLink}
            />
            {gameActive && myColor && (
              <IconBtn icon="⚑" label="Resign" onClick={handleResign} danger />
            )}
          </div>
        </div>

        {/* ── Center: board ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.75rem', flexShrink: 0,
        }}>
          <ChessBoard
            boardState={boardState}
            currentTurn={currentTurn}
            myColor={myColor}
            onMove={handleMove}
            gameOver={gameOver}
            lastMove={lastMove}
            inCheck={inCheck}
          />

          {/* Turn indicator bar below board */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            background: 'rgba(12,10,6,0.7)',
            border: '1px solid rgba(60,50,36,0.4)',
            borderRadius: 8, padding: '0.4rem 1rem',
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: currentTurn === 'white' ? '#F0E6D0' : '#1A0E05',
              border: `1.5px solid ${currentTurn === 'white' ? 'rgba(240,230,208,0.6)' : 'rgba(180,130,40,0.5)'}`,
              boxShadow: currentTurn === 'white'
                ? '0 0 8px rgba(240,230,208,0.5)'
                : '0 0 8px rgba(180,130,40,0.3)',
              transition: 'all 0.3s',
            }} />
            <span style={{ color: 'rgba(138,122,96,0.7)', fontSize: '0.8rem' }}>
              {gameOver ? 'Game ended' : `${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)} to move`}
            </span>
            <span style={{ color: 'rgba(90,74,56,0.5)', fontSize: '0.75rem', marginLeft: 'auto' }}>
              Move {moves.length > 0 ? Math.ceil(moves.length / 2) : 1}
            </span>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{
          width: 200, flexShrink: 0,
          background: 'rgba(10,8,5,0.75)',
          border: '1px solid rgba(60,50,36,0.5)',
          borderRadius: 10,
          display: 'flex', flexDirection: 'column',
          backdropFilter: 'blur(8px)',
          alignSelf: 'stretch', maxHeight: 580,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '0.65rem 0.85rem',
            borderBottom: '1px solid rgba(60,50,36,0.4)',
            color: 'rgba(138,122,96,0.6)',
            fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase',
            fontFamily: 'EB Garamond, serif',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Moves</span>
            <span style={{ color: 'rgba(90,74,56,0.5)' }}>{moves.length}</span>
          </div>

          <MoveHistory moves={moves} />
        </div>
      </div>

      {/* Game over overlay */}
      {gameOver && gameOverData && (
        <GameOverOverlay
          data={gameOverData}
          myColor={myColor}
          username={user?.username}
          onNewGame={async () => {
            try {
              const data = await apiRequest('/rooms', { method: 'POST' }, token);
              navigate(`/game/${data.roomId}`);
            } catch {}
          }}
          onLobby={() => navigate('/lobby')}
        />
      )}
    </div>
  );
}
