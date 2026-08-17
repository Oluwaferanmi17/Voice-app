const { io } = require('socket.io-client');

const USER1_TOKEN = process.argv[2];
const USER2_TOKEN = process.argv[3];
const USER2_ID = process.argv[4];

const socket1 = io('http://localhost:4004', { auth: { token: USER1_TOKEN } });
const socket2 = io('http://localhost:4004', { auth: { token: USER2_TOKEN } });

socket1.on('connect_error', (err) => console.error('[user1] connect_error:', err.message));
socket2.on('connect_error', (err) => console.error('[user2] connect_error:', err.message));

socket1.on('connect', () => console.log('[user1] connected'));
socket2.on('connect', () => console.log('[user2] connected'));

let activeCallId = null;

socket2.on('call:incoming', (data) => {
  console.log('[user2] received call:incoming', data);
  activeCallId = data.callId;
  socket2.emit('call:accept', { callId: data.callId });
});

socket1.on('call:ringing', (data) => console.log('[user1] call:ringing', data));

socket1.on('call:connected', (data) => {
  console.log('[user1] call:connected! Sending a test message...');
  socket1.emit('message:send', {
    callId: data.callId,
    content: 'Hello from the integration test!',
    clientMessageId: 'test-msg-1',
  });
});

socket2.on('call:connected', (data) => console.log('[user2] call:connected!'));

// --- Phase 3: messaging events ---
socket1.on('message:ack', (data) => console.log('[user1] message:ack', data));
socket2.on('message:receive', (data) => {
  console.log('[user2] message:receive', data);
  socket2.emit('message:delivered', { messageId: data.messageId, senderId: data.senderId });
});
socket1.on('message:status', (data) => console.log('[user1] message:status', data));

// --- Phase 4: speech synthesis relay ---
let audioChunkCount = 0;
socket2.on('speech:chunk', (data) => {
  audioChunkCount++;
  console.log(`[user2] speech:chunk #${audioChunkCount}, messageId=${data.messageId}, bytes=${data.audio?.length || data.audio?.byteLength}`);
});
socket2.on('speech:complete', (data) => {
  console.log('[user2] speech:complete', data);
  console.log(`--- FULL FLOW TEST PASSED (${audioChunkCount} audio chunks received) ---`);
  process.exit(0);
});
socket2.on('speech:error', (data) => console.error('[user2] speech:error', data));

setTimeout(() => {
  console.log('[user1] starting call to user2...');
  socket1.emit('call:start', { calleeId: USER2_ID });
}, 1000);

setTimeout(() => {
  console.error('--- TIMEOUT: full flow did not complete in time ---');
  process.exit(1);
}, 20000); // longer timeout — speech synthesis takes a few seconds