import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiRequest } from '../utils/api';

function CrownLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 36L10 18L18 28L24 14L30 28L38 18L42 36H6Z" fill="#C9A84C" opacity="0.9"/>
      <rect x="6" y="36" width="36" height="4" rx="2" fill="#C9A84C"/>
      <circle cx="6" cy="18" r="3" fill="#E8C97A"/>
      <circle cx="24" cy="14" r="3" fill="#E8C97A"/>
      <circle cx="42" cy="18" r="3" fill="#E8C97A"/>
    </svg>
  );
}

function extractUUID(input) {
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = input.match(uuidRegex);
  return match ? match[0] : null;
}

function StatusBadge({ status }) {
  const styles = {
    waiting:  { color: '#8A7A60', border: '1px solid #4A3A20', background: 'rgba(74,58,32,0.3)' },
    active:   { color: '#4A9B6A', border: '1px solid #2A6A40', background: 'rgba(42,106,64,0.2)' },
    finished: { color: '#5A4A40', border: '1px solid #3A2A20', background: 'rgba(40,30,20,0.4)' },
  };
  const labels = { waiting: 'Waiting', active: 'Active', finished: 'Finished' };
  const s = styles[status] || styles.finished;
  return (
    <span style={{
      ...s, fontSize: '0.72rem', padding: '0.15rem 0.5rem',
      borderRadius: 4, fontFamily: 'EB Garamond, serif', letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {labels[status] || status}
    </span>
  );
}

function GameRow({ game, onClick }) {
  const isFinished = game.status === 'finished';
  const opponentName = game.opponent?.username || 'No opponent yet';
  const colorSymbol = game.myColor === 'white' ? '♔' : '♚';

  let result = null;
  if (isFinished) {
    if (!game.winner) result = 'Draw';
    else if (game.winner === (game.opponent?.username)) result = 'Loss';
    else result = 'Win';
  }

  return (
    <div
      onClick={!isFinished ? onClick : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.65rem 0.9rem',
        background: isFinished ? 'transparent' : '#2E2820',
        border: `1px solid ${isFinished ? '#2A2218' : '#3A3228'}`,
        borderRadius: 7,
        cursor: isFinished ? 'default' : 'pointer',
        opacity: isFinished ? 0.55 : 1,
        transition: 'border-color 0.2s, background 0.2s',
      }}
      onMouseEnter={e => { if (!isFinished) e.currentTarget.style.borderColor = '#7A6030'; }}
      onMouseLeave={e => { if (!isFinished) e.currentTarget.style.borderColor = '#3A3228'; }}
    >
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{colorSymbol}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#EDE0C8', fontSize: '0.95rem', fontFamily: 'Playfair Display, serif' }}>
          vs {opponentName}
        </div>
        <div style={{ color: '#5A4A38', fontSize: '0.78rem', marginTop: 1 }}>
          {game.myColor}
          {isFinished && result && (
            <span style={{
              marginLeft: '0.5rem',
              color: result === 'Win' ? '#4A9B6A' : result === 'Loss' ? '#B84040' : '#8A7A60',
            }}>
              · {result}
            </span>
          )}
        </div>
      </div>
      <StatusBadge status={game.status} />
      {!isFinished && (
        <span style={{ color: '#7A6030', fontSize: '0.85rem', flexShrink: 0 }}>→</span>
      )}
    </div>
  );
}

export default function LobbyPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [joinInput, setJoinInput] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);

  useEffect(() => {
    async function loadGames() {
      try {
        const data = await apiRequest('/rooms', {}, token);
        setGames(data.rooms);
      } catch {
        // silently fail
      } finally {
        setGamesLoading(false);
      }
    }
    loadGames();
  }, [token]);

  async function handleCreateGame() {
    setError('');
    setCreating(true);
    try {
      const data = await apiRequest('/rooms', { method: 'POST' }, token);
      navigate(`/game/${data.roomId}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  function handleJoin() {
    setError('');
    const uuid = extractUUID(joinInput.trim());
    if (!uuid) {
      setError('Invalid room link or ID. Please paste a valid game URL or UUID.');
      return;
    }
    navigate(`/game/${uuid}`);
  }

  const activeGames = games.filter(g => g.status !== 'finished');
  const finishedGames = games.filter(g => g.status === 'finished');

  return (
    <div className="page" style={{ justifyContent: 'flex-start', paddingTop: '2rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', padding: '0 0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <CrownLogo />
          <span style={{
            fontFamily: 'Playfair Display, serif', fontWeight: 700,
            fontSize: '1.3rem', color: '#C9A84C',
          }}>
            King Fall
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#8A7A60', fontSize: '0.9rem' }}>{user?.username}</span>
          <button className="btn" onClick={logout} style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Create / join card */}
      <div className="card" style={{ width: '100%', maxWidth: 500, marginBottom: '1.5rem' }}>
        <h2 style={{
          fontFamily: 'Playfair Display, serif', fontWeight: 600,
          color: '#EDE0C8', marginBottom: '1.5rem', textAlign: 'center',
        }}>
          Game Lobby
        </h2>

        <button
          className="btn btn-primary btn-full"
          onClick={handleCreateGame}
          disabled={creating}
          style={{ fontSize: '1.1rem', padding: '0.85rem' }}
        >
          {creating ? 'Creating…' : '♟ Create New Game'}
        </button>

        <div className="divider" style={{ margin: '1.5rem 0' }}>
          or join with a link
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={joinInput}
            onChange={e => setJoinInput(e.target.value)}
            placeholder="Paste room link or UUID…"
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          <button
            className="btn btn-primary"
            onClick={handleJoin}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Join →
          </button>
        </div>

        {error && (
          <p style={{ color: '#B84040', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '0.75rem' }}>
            {error}
          </p>
        )}
      </div>

      {/* Previous games */}
      {!gamesLoading && games.length > 0 && (
        <div style={{ width: '100%', maxWidth: 500 }}>
          {/* Active / waiting games */}
          {activeGames.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{
                color: '#8A7A60', fontSize: '0.75rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: '0.6rem', paddingLeft: '0.25rem',
              }}>
                Active Games
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {activeGames.map(g => (
                  <GameRow key={g.id} game={g} onClick={() => navigate(`/game/${g.id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* Finished games */}
          {finishedGames.length > 0 && (
            <div>
              <div style={{
                color: '#5A4A38', fontSize: '0.75rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: '0.6rem', paddingLeft: '0.25rem',
              }}>
                Past Games
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {finishedGames.map(g => (
                  <GameRow key={g.id} game={g} onClick={null} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
