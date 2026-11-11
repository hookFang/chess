import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { setRoomToken } from '../utils/player';

export default function HomePage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [color, setColor] = useState('random');

  async function createGame() {
    setBusy(true);
    setError('');
    try {
      const data = await apiRequest('/rooms', { method: 'POST', body: JSON.stringify({ color }) });
      setRoomToken(data.roomId, data.token);
      navigate(`/game/${data.roomId}`);
    } catch (err) {
      setError(err.message || 'Could not create a game');
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(30,22,10,1) 0%, rgba(8,7,4,1) 60%, rgba(4,6,10,1) 100%)',
      fontFamily: 'EB Garamond, serif', padding: '1rem',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: '3rem', color: '#C9A84C' }}>♚</div>
        <h1 style={{
          fontFamily: 'Playfair Display, serif', color: '#EDE0C8',
          fontSize: '2.4rem', margin: '0.25rem 0 0.5rem', letterSpacing: '0.04em',
        }}>
          King Fall
        </h1>
        <p style={{ color: 'rgba(237,224,200,0.6)', marginBottom: '2rem', fontSize: '1.05rem' }}>
          Start a game and send the link to a friend. No account needed.
        </p>
        <div role="radiogroup" aria-label="Play as" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
          {[['white', '♔ White'], ['random', '⚄ Random'], ['black', '♚ Black']].map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={color === value}
              onClick={() => setColor(value)}
              style={{
                background: color === value ? 'rgba(201,168,76,0.18)' : 'transparent',
                border: `1px solid ${color === value ? '#C9A84C' : 'rgba(138,122,96,0.4)'}`,
                borderRadius: 8, color: color === value ? '#E8C97A' : 'rgba(237,224,200,0.7)',
                fontFamily: 'EB Garamond, serif', fontSize: '1rem', padding: '0.5rem 1rem', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={createGame}
          disabled={busy}
          style={{
            background: 'linear-gradient(135deg, #C9A84C, #A88830)', border: 'none', borderRadius: 8,
            color: '#0E0C09', fontFamily: 'EB Garamond, serif', fontSize: '1.1rem', fontWeight: 700,
            padding: '0.8rem 2rem', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Creating…' : 'Create Game'}
        </button>
        {error && <p style={{ color: '#E86060', marginTop: '1rem' }}>{error}</p>}
      </div>
    </div>
  );
}
