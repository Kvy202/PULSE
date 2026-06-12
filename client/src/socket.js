import { io } from 'socket.io-client';
import { ensureSession } from './lib/session.js';

// Single shared connection to the heartbeat server. We obtain the signed session
// cookie BEFORE connecting (autoConnect: false) so the handshake carries it, and
// send credentials so the cookie travels with the websocket upgrade request.
const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export const socket = io(URL, { autoConnect: false, withCredentials: true });

ensureSession().finally(() => socket.connect());
