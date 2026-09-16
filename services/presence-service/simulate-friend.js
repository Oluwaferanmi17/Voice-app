const { io } = require('socket.io-client');

const TOKEN = process.argv[2]; // Test Friend's accessToken ($token3)

const socket = io('http://192.168.18.50:4004', { auth: { token: TOKEN } });

socket.on('connect', () => console.log('[Test Friend] connected and listening for calls...'));
socket.on('connect_error', (err) => console.error('[Test Friend] connect_error:', err.message));

socket.on('call:incoming', (data) => {
  console.log('[Test Friend] incoming call from', data.caller.displayName || data.caller.id);
  console.log('[Test Friend] auto-accepting in 1.5s...');
  setTimeout(() => {
    socket.emit('call:accept', { callId: data.callId });
  }, 1500);
});

socket.on('call:connected', (data) => {
  console.log('[Test Friend] call connected! Waiting for messages...');
});

socket.on('message:receive', (data) => {
  console.log('[Test Friend] received message:', data.content);
  socket.emit('message:delivered', { messageId: data.messageId, senderId: data.senderId });

  // Reply back after a short pause, so you can hear a response too
  setTimeout(() => {
    console.log('[Test Friend] replying...');
    socket.emit('message:send', {
      callId: data.callId,
      content: "Hey! I'm a simulated friend, but I can hear you loud and clear.",
      clientMessageId: `sim-${Date.now()}`,
    });
  }, 2000);
});

socket.on('call:ended', () => console.log('[Test Friend] call ended.'));
socket.on('call:error', (data) => console.error('[Test Friend] error:', data.message));