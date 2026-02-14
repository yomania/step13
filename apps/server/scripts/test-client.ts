import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
    console.log('Bot Connected');
    const joinMsg = JSON.stringify({ type: 'JOIN', playerId: 'bot-player-2' });
    ws.send(joinMsg);
    console.log('Sent:', joinMsg);
});

ws.on('message', (data) => {
    console.log('Received:', data.toString());
});

ws.on('error', (err) => {
    console.error('Error:', err);
});
