import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiRequest } from '../utils/api';

function CrownLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 36L10 18L18 28L24 14L30 28L38 18L42 36H6Z" fill="#C9A84C" opacity="0.9"/>
      <rect x="6" y="36" width="36" height="4" rx="2" fill="#C9A84C"/>
      <circle cx="6" cy="18" r="3" fill="#E8C97A"/>
      <circle cx="24" cy="14" r="3" fill="#E8C97A"/>
      <circle cx="42" cy="18" r="3" fill="#E8C97A"/>
    </svg>
  );
}

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = tab === 'login' ? '/auth/login' : '/auth/register';
      const data = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(data.token, data.user);
      navigate('/lobby');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <CrownLogo />
          <h1 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.8rem',
            fontWeight: 700,
            color: '#C9A84C',
            marginTop: '0.5rem',
            letterSpacing: '0.02em',
          }}>
            King Fall
          </h1>
          <p style={{ color: '#8A7A60', fontSize: '0.85rem', fontStyle: 'italic' }}>
            May the best mind win
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #7A6030', marginBottom: '1.5rem' }}>
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, background: 'none', border: 'none',
                padding: '0.6rem', cursor: 'pointer',
                fontFamily: 'EB Garamond, serif', fontSize: '1rem',
                color: tab === t ? '#C9A84C' : '#8A7A60',
                borderBottom: tab === t ? '2px solid #C9A84C' : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.2s',
              }}
            >
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {error && (
            <p style={{ color: '#B84040', fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
