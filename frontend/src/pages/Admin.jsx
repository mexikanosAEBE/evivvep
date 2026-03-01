import { useState, useEffect } from 'react';
import './Admin.css';

const API = '/api';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '' });
  const [editingUser, setEditingUser] = useState(null);
  const [newRoomHost, setNewRoomHost] = useState('');
  const [participants, setParticipants] = useState([]);
  const [pollResults, setPollResults] = useState([]);

  const auth = { adminPassword: password };

  const loadUsers = () => {
    fetch(`${API}/users?adminPassword=${encodeURIComponent(password)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]));
  };

  const loadParticipants = () => {
    if (!activeRoom || !password) return;
    fetch(`${API}/rooms?adminPassword=${encodeURIComponent(password)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((roomsList) => {
        const room = roomsList.find((x) => x.code === activeRoom);
        if (!room?.id) return setParticipants([]);
        return fetch(`${API}/rooms/${room.id}/participants?adminPassword=${encodeURIComponent(password)}`)
          .then((res) => (res.ok ? res.json() : []))
          .then(setParticipants);
      })
      .catch(() => setParticipants([]));
  };

  const loadRooms = () => {
    fetch(`${API}/rooms?adminPassword=${encodeURIComponent(password)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((r) => {
        const list = r.map((x) => ({ id: x.id, code: x.code, joinUrl: `/join?code=${x.code}` }));
        setRooms(list);
        setActiveRoom((prev) => prev || list[0]?.code || '');
      })
      .catch(() => setRooms([]));
  };

  useEffect(() => {
    if (authenticated) {
      loadUsers();
      loadRooms();
    }
  }, [authenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    fetch(`${API}/users?adminPassword=${encodeURIComponent(password)}`)
      .then((r) => {
        if (r.ok) setAuthenticated(true);
        else alert('Λάθος κωδικός');
      });
  };

  const createRoom = (e) => {
    e.preventDefault();
    fetch(`${API}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...auth,
        hostId: newRoomHost || null,
        hostFirstName: users.find((u) => u.id === newRoomHost)?.first_name,
        hostLastName: users.find((u) => u.id === newRoomHost)?.last_name,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        loadRooms();
        setActiveRoom(data.code);
        setNewRoomHost('');
      })
      .catch((e) => alert('Σφάλμα: ' + e.message));
  };

  const sendAlert = (e) => {
    e.preventDefault();
    if (!activeRoom || !alertMsg.trim()) return;
    fetch(`${API}/socket-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auth, roomCode: activeRoom, message: alertMsg }),
    }).then(() => setAlertMsg(''));
  };

  const createPoll = (e) => {
    e.preventDefault();
    const opts = pollOptions.filter((o) => o.trim());
    if (!activeRoom || !pollQuestion.trim() || opts.length < 2) {
      alert('Συμπληρώστε ερώτηση και τουλάχιστον 2 επιλογές');
      return;
    }
    fetch(`${API}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auth, roomCode: activeRoom, question: pollQuestion, options: opts }),
    })
      .then((r) => r.json())
      .then(() => {
        setPollQuestion('');
        setPollOptions(['', '']);
      })
      .catch((e) => alert('Σφάλμα: ' + e.message));
  };

  const muteAll = () => {
    if (!activeRoom) return;
    fetch(`${API}/socket-mute-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auth, roomCode: activeRoom }),
    });
  };

  const addUser = (e) => {
    e.preventDefault();
    if (!newUser.firstName.trim() || !newUser.lastName.trim()) return;
    fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auth, ...newUser }),
    })
      .then((r) => r.json())
      .then(() => {
        setNewUser({ firstName: '', lastName: '' });
        loadUsers();
      })
      .catch((e) => alert('Σφάλμα: ' + e.message));
  };

  const updateUser = (e) => {
    e.preventDefault();
    if (!editingUser) return;
    fetch(`${API}/users/${editingUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auth, firstName: editingUser.first_name, lastName: editingUser.last_name }),
    })
      .then((r) => r.json())
      .then(() => {
        setEditingUser(null);
        loadUsers();
      })
      .catch((e) => alert('Σφάλμα: ' + e.message));
  };

  const deleteUser = (id) => {
    if (!confirm('Διαγραφή χρήστη;')) return;
    fetch(`${API}/users/${id}?adminPassword=${encodeURIComponent(password)}`, { method: 'DELETE' })
      .then(() => loadUsers());
  };

  if (!authenticated) {
    return (
      <div className="admin-page">
        <div className="admin-login">
          <h1>Admin Panel</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Κωδικός admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Είσοδος</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Admin Panel</h1>
        <a href="/">← Επιστροφή</a>
      </header>

      <div className="admin-grid">
        <section className="admin-section">
          <h2>Δημιουργία κλήσης</h2>
          <form onSubmit={createRoom}>
            <select value={newRoomHost} onChange={(e) => setNewRoomHost(e.target.value)} required>
              <option value="">-- Επιλέξτε Πρόεδρο --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
            <button type="submit">Δημιουργία κλήσης</button>
          </form>
          {rooms.length > 0 && (
            <div className="room-list">
              <p><strong>Ενεργή κλήση:</strong></p>
              <select value={activeRoom} onChange={(e) => setActiveRoom(e.target.value)}>
                {rooms.map((r) => (
                  <option key={r.code} value={r.code}>{r.code}</option>
                ))}
              </select>
              <p className="room-info">Οι χρήστες μπαίνουν με τον προσωπικό τους κωδικό στην <a href="/" target="_blank" rel="noreferrer">αρχική σελίδα</a></p>
              <button className="btn-danger" style={{ marginTop: '0.5rem' }} onClick={() => {
                if (!activeRoom || !confirm('Τερματισμός κλήσης ' + activeRoom + ';')) return;
                fetch(`${API}/rooms/${activeRoom}?adminPassword=${encodeURIComponent(password)}`, { method: 'DELETE' })
                  .then(() => {
                    setActiveRoom('');
                    loadRooms();
                  });
              }}>Τερματισμός κλήσης</button>
            </div>
          )}
        </section>

        <section className="admin-section">
          <h2>Έλεγχος κλήσης</h2>
          <form onSubmit={sendAlert}>
            <input
              placeholder="Μήνυμα alert"
              value={alertMsg}
              onChange={(e) => setAlertMsg(e.target.value)}
            />
            <button type="submit">Αποστολή Alert</button>
          </form>
          <button className="btn-danger" onClick={muteAll}>Κλείσιμο όλων των μικροφώνων</button>

          <div className="participants-section">
            <button onClick={loadParticipants}>Φόρτωση συμμετεχόντων</button>
            <ul className="participant-list">
              {participants.map((p) => (
                <li key={p.identity}>
                  <span>{p.name || p.identity}</span>
                  <button onClick={() => fetch(`${API}/socket-mute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...auth, roomCode: activeRoom, participantId: p.identity, mute: true }),
                  })}>Κλείσιμο μικροφώνου</button>
                  <button onClick={() => fetch(`${API}/socket-mute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...auth, roomCode: activeRoom, participantId: p.identity, mute: false }),
                  })}>Άνοιγμα μικροφώνου</button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="admin-section">
          <h2>Δημιουργία Poll</h2>
          <form onSubmit={createPoll}>
            <input
              placeholder="Ερώτηση"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
            />
            {pollOptions.map((opt, i) => (
              <input
                key={i}
                placeholder={`Επιλογή ${i + 1}`}
                value={opt}
                onChange={(e) => {
                  const arr = [...pollOptions];
                  arr[i] = e.target.value;
                  setPollOptions(arr);
                }}
              />
            ))}
            <button type="button" onClick={() => setPollOptions((p) => [...p, ''])}>+ Επιλογή</button>
            <button type="submit">Δημιουργία Poll</button>
          </form>

          <div className="poll-results-section">
            <button onClick={() => {
              if (!activeRoom) return;
              fetch(`${API}/polls?adminPassword=${encodeURIComponent(password)}&roomCode=${activeRoom}`)
                .then((r) => (r.ok ? r.json() : []))
                .then(setPollResults);
            }}>Φόρτωση αποτελεσμάτων</button>

            {pollResults.map((p) => (
              <div key={p.id} className="poll-result-card">
                <h4>{p.question}</h4>
                <p className="poll-total">Σύνολο ψήφων: {p.totalVotes}</p>
                {p.options.map((opt, i) => {
                  const count = p.voteCounts[i] || 0;
                  const pct = p.totalVotes > 0 ? Math.round((count / p.totalVotes) * 100) : 0;
                  const names = p.voterNames[i] || [];
                  return (
                    <div key={i} className="poll-result-row">
                      <div className="poll-result-header">
                        <span>{opt}</span>
                        <span className="poll-result-count">{count} ({pct}%)</span>
                      </div>
                      <div className="poll-result-bar">
                        <div className="poll-result-fill" style={{ width: `${pct}%` }} />
                      </div>
                      {names.length > 0 && (
                        <p className="poll-voters">{names.join(', ')}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section users-section">
          <h2>Χρήστες</h2>
          <form onSubmit={addUser}>
            <input
              placeholder="Όνομα"
              value={newUser.firstName}
              onChange={(e) => setNewUser((u) => ({ ...u, firstName: e.target.value }))}
            />
            <input
              placeholder="Επώνυμο"
              value={newUser.lastName}
              onChange={(e) => setNewUser((u) => ({ ...u, lastName: e.target.value }))}
            />
            <button type="submit">Προσθήκη</button>
          </form>

          {editingUser && (
            <form onSubmit={updateUser} className="edit-form">
              <input
                value={editingUser.first_name}
                onChange={(e) => setEditingUser((u) => ({ ...u, first_name: e.target.value }))}
              />
              <input
                value={editingUser.last_name}
                onChange={(e) => setEditingUser((u) => ({ ...u, last_name: e.target.value }))}
              />
              <button type="submit">Αποθήκευση</button>
              <button type="button" onClick={() => setEditingUser(null)}>Ακύρωση</button>
            </form>
          )}

          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id}>
                <div className="user-info">
                  <span className="user-name">{u.first_name} {u.last_name}</span>
                  <span className="user-code">Κωδικός: <strong>{u.join_code}</strong></span>
                </div>
                <div>
                  <button onClick={() => setEditingUser({ ...u })}>Επεξεργασία</button>
                  <button className="btn-danger" onClick={() => deleteUser(u.id)}>Διαγραφή</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
