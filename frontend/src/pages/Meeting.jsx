import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { io } from 'socket.io-client';
import './Meeting.css';

export default function Meeting() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, wsUrl, roomId, roomCode, user, isHost } = location.state || {};

  const [alert, setAlert] = useState(null);
  const [poll, setPoll] = useState(null);

  useEffect(() => {
    if (!token || !wsUrl) {
      navigate('/');
      return;
    }
  }, [token, wsUrl, navigate]);

  useEffect(() => {
    if (!roomCode) return;

    const socket = io(window.location.origin, { path: '/socket.io' });
    socket.emit('join-room', roomCode);

    socket.on('admin-alert', ({ message }) => {
      setAlert(message);
      setTimeout(() => setAlert(null), 5000);
    });

    socket.on('admin-mute', ({ participantId, mute }) => {
      if (participantId === user?.id) {
        window.dispatchEvent(new CustomEvent('admin-mute', { detail: { mute } }));
      }
    });

    socket.on('admin-mute-all', () => {
      window.dispatchEvent(new CustomEvent('admin-mute-all'));
    });

    socket.on('poll', (p) => setPoll(p));

    socket.on('room-closed', () => {
      window.alert('Η κλήση τερματίστηκε.');
      navigate('/');
    });

    return () => socket.disconnect();
  }, [roomCode, user?.id, navigate]);

  if (!token || !wsUrl) return null;

  return (
    <div className="meeting-page" data-lk-theme="default">
      {alert && <div className="admin-alert">{alert}</div>}

      {poll && (
        <div className="poll-overlay">
          <div className="poll-card">
            <h3>{poll.question}</h3>
            <div className="poll-options">
              {poll.options.map((opt, i) => (
                <button key={i} className="poll-option" onClick={() => {
                  fetch(`/api/polls/${poll.id}/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ participantId: user?.id, optionIndex: i }),
                  });
                  setPoll(null);
                }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        connect={true}
        audio={true}
        video={false}
        options={{ dynacast: true, adaptiveStream: true }}
        onDisconnected={() => navigate('/')}
        onError={(e) => console.error(e)}
      >
        <MeetingLayout isHost={isHost} user={user} onLeave={() => navigate('/')} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}

function MeetingLayout({ isHost, user, onLeave }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [handRaised, setHandRaised] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true });

  const hostCameraTrack = cameraTracks.find((t) => {
    try {
      const meta = JSON.parse(t.participant?.metadata || '{}');
      return meta.isHost;
    } catch { return false; }
  });

  const hostScreenTrack = screenTracks.find((t) => {
    try {
      const meta = JSON.parse(t.participant?.metadata || '{}');
      return meta.isHost;
    } catch { return false; }
  });

  const mainTrack = hostScreenTrack || hostCameraTrack;

  useEffect(() => {
    if (isHost && localParticipant) {
      localParticipant.setCameraEnabled(true);
    }
  }, [isHost, localParticipant]);

  useEffect(() => {
    if (!isHost || !localParticipant) return;
    const checkScreenShare = () => {
      const hasScreen = Array.from(localParticipant.trackPublications.values()).some(
        (p) => p.source === Track.Source.ScreenShare
      );
      setScreenSharing(hasScreen);
    };
    localParticipant.on('localTrackPublished', checkScreenShare);
    localParticipant.on('localTrackUnpublished', checkScreenShare);
    checkScreenShare();
    return () => {
      localParticipant.off('localTrackPublished', checkScreenShare);
      localParticipant.off('localTrackUnpublished', checkScreenShare);
    };
  }, [isHost, localParticipant]);

  useEffect(() => {
    const onAdminMute = (e) => {
      const mute = e.detail?.mute;
      localParticipant?.setMicrophoneEnabled(!mute);
      setMicEnabled(!mute);
    };
    const onAdminMuteAll = () => {
      localParticipant?.setMicrophoneEnabled(false);
      setMicEnabled(false);
    };
    window.addEventListener('admin-mute', onAdminMute);
    window.addEventListener('admin-mute-all', onAdminMuteAll);
    return () => {
      window.removeEventListener('admin-mute', onAdminMute);
      window.removeEventListener('admin-mute-all', onAdminMuteAll);
    };
  }, [localParticipant]);

  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    const newState = !micEnabled;
    await localParticipant.setMicrophoneEnabled(newState);
    setMicEnabled(newState);
  }, [localParticipant, micEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant || !isHost) return;
    try {
      const newState = !screenSharing;
      await localParticipant.setScreenShareEnabled(newState);
      setScreenSharing(newState);
    } catch (e) {
      console.error('Screen share error:', e);
    }
  }, [localParticipant, isHost, screenSharing]);

  const participantCount = participants.length;

  return (
    <div className="meeting-layout">
      {/* Video area */}
      <div className="video-area">
        {mainTrack ? (
          <VideoTrack
            trackRef={mainTrack}
            className="host-video"
          />
        ) : (
          <div className="no-video">
            <div className="no-video-icon">📹</div>
            <p>Αναμονή για την κάμερα ή οθόνη του προέδρου...</p>
          </div>
        )}
      </div>

      {/* Participants sidebar */}
      <div className="participants-sidebar">
        <h3>Συμμετέχοντες ({participantCount})</h3>
        <ul className="participants-list">
          {participants.map((p) => {
            let pIsHost = false;
            try { pIsHost = JSON.parse(p.metadata || '{}').isHost; } catch {}
            return (
              <li key={p.identity} className={`participant-item ${p.isSpeaking ? 'speaking' : ''}`}>
                <span className="participant-name">
                  {pIsHost && <span className="host-badge">👑</span>}
                  {p.name || p.identity}
                </span>
                <span className="participant-status">
                  {p.isMicrophoneEnabled ? '🎤' : '🔇'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom controls */}
      <div className="bottom-controls">
        <button
          className={`ctrl-btn ${!micEnabled ? 'off' : ''}`}
          onClick={toggleMic}
        >
          <span className="ctrl-icon">{micEnabled ? '🎤' : '🔇'}</span>
          <span className="ctrl-label">{micEnabled ? 'Μικρόφωνο' : 'Σίγαση'}</span>
        </button>

        {isHost && (
          <button
            className={`ctrl-btn ${screenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
          >
            <span className="ctrl-icon">{screenSharing ? '🖥️' : '📺'}</span>
            <span className="ctrl-label">{screenSharing ? 'Διακοπή κοινοποίησης' : 'Κοινοποίηση οθόνης'}</span>
          </button>
        )}

        <button
          className={`ctrl-btn ${handRaised ? 'active' : ''}`}
          onClick={() => setHandRaised((r) => !r)}
        >
          <span className="ctrl-icon">✋</span>
          <span className="ctrl-label">{handRaised ? 'Κάτω' : 'Χέρι'}</span>
        </button>

        <button className="ctrl-btn leave-btn" onClick={onLeave}>
          <span className="ctrl-icon">📞</span>
          <span className="ctrl-label">Έξοδος</span>
        </button>
      </div>
    </div>
  );
}
