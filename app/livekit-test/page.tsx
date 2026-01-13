'use client';

import { useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';

export default function LiveKitTest() {
  const [status, setStatus] = useState('idle');
  const roomRef = useRef<Room | null>(null);

  const connect = async () => {
    try {
      setStatus('fetching token');

      // Generate unique room and identity
      const room = `room_${Date.now()}`;
      const identity = `user_${Date.now()}`;

      console.log(`🔄 Creating room: ${room}, identity: ${identity}`);

      // 1. Get token
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: room,
          identity: identity,
        }),
      });

      if (!res.ok) {
        throw new Error(`Token request failed: ${res.status}`);
      }

      const { token } = await res.json();
      console.log('✅ Token received');

      // 2. Create room instance
      const roomObj = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = roomObj;

      // 3. Setup event listeners BEFORE connecting
      roomObj.on(RoomEvent.Connected, () => {
        console.log('✅ Connected to LiveKit room');
        setStatus('connected');
      });

      roomObj.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log(` Participant connected: ${participant.identity}`);
        if (participant.identity.includes('agent') || participant.identity.includes('assistant')) {
          console.log(' AGENT HAS JOINED THE ROOM!');
          setStatus('agent joined');
        }
      });

      roomObj.on(RoomEvent.Disconnected, () => {
        console.log('❌ Disconnected from room');
        setStatus('disconnected');
      });

      roomObj.on(RoomEvent.Reconnecting, () => {
        console.log('🔄 Reconnecting...');
        setStatus('reconnecting');
      });

      // 4. Connect to room FIRST
      console.log('🔄 Connecting to LiveKit server...');

      // Make sure NEXT_PUBLIC_LIVEKIT_URL is set in your .env.local
      const livekitUrl = process.env.LIVEKIT_URL;
      if (!livekitUrl) {
        throw new Error('NEXT_PUBLIC_LIVEKIT_URL is not set');
      }

      await roomObj.connect(livekitUrl, token);
      console.log('✅ Room connection established');

      // 5. Dispatch agent AFTER successful connection
      console.log('🔄 Dispatching agent...');
      try {
        const dispatchRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/dispatch-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: room }),
        });

        if (dispatchRes.ok) {
          console.log('✅ Agent dispatch request sent');
          const data = await dispatchRes.json();
          console.log('Dispatch response:', data);
        } else {
          console.error('❌ Agent dispatch failed');
        }
      } catch (dispatchError) {
        console.error('Failed to dispatch agent:', dispatchError);
      }

      // 6. Enable microphone AFTER agent dispatch
      console.log('🔄 Enabling microphone...');
      try {
        await roomObj.localParticipant.setMicrophoneEnabled(true);
        console.log('🎤 Microphone enabled');
      } catch (micError) {
        console.error('Failed to enable microphone:', micError);
      }
    } catch (error: unknown) {
      console.error('❌ Connection failed:', error);

      if (error instanceof Error) {
        setStatus(`failed: ${error.message}`);
      } else {
        setStatus('failed: unknown error');
      }
    }
  };

  const disconnect = async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
      setStatus('disconnected');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>LiveKit Connection Test</h1>
      <button
        onClick={connect}
        style={{ padding: '10px 20px', marginRight: '10px' }}
        disabled={status === 'connected' || status === 'reconnecting'}
      >
        Connect
      </button>
      <button
        onClick={disconnect}
        style={{ padding: '10px 20px', backgroundColor: '#ff4444', color: 'white' }}
        disabled={status !== 'connected'}
      >
        Disconnect
      </button>
      <p>
        Status: <strong>{status}</strong>
      </p>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <h3>Expected Flow:</h3>
        <ol>
          <li>Get token from server</li>
          <li>Connect to LiveKit room</li>
          <li>Dispatch agent to room</li>
          <li>Enable microphone</li>
          <li>Agent joins room</li>
        </ol>
      </div>
    </div>
  );
}
