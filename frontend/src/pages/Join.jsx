import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Join.css';

const API = '/api';

export default function Join() {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    if (!joinCode.trim()) {
      setError('Εισάγετε τον κωδικό σας');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Σφάλμα σύνδεσης');
      }

      navigate('/meeting', {
        state: {
          token: data.token,
          wsUrl: data.wsUrl,
          roomId: data.roomId,
          roomCode: data.roomCode,
          user: data.user,
          isHost: data.isHost,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-page">
      <div className="join-card">
        <h1>Βιντεοκλήση</h1>
        <p className="subtitle">Εισάγετε τον προσωπικό σας κωδικό για να συνδεθείτε</p>

        <form onSubmit={handleJoin}>
          <div className="field">
            <label>Ο κωδικός σας</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="π.χ. ABC123"
              maxLength={8}
              autoFocus
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Σύνδεση...' : 'Είσοδος στην κλήση'}
          </button>
        </form>

        <a href="/admin" className="admin-link">Admin Panel</a>
      </div>
    </div>
  );
}
