
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
    console.log('Connected!');
    ws.close();
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('Connection failed:', err.message);
    process.exit(1);
});
