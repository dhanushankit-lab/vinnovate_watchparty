import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { InMemoryRoomManager } from './room/InMemoryRoomManager.js';
import {
  getAllMovies,
  getCategories,
  getMovieById,
  getRecommendations,
  searchAndFilterMovies
} from './catalog/movieService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const roomManager = new InMemoryRoomManager();

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveStatic(reqPath: string, res: http.ServerResponse): boolean {
  const clientDistPaths = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
    path.resolve(process.cwd(), 'client/dist')
  ];

  let clientDist: string | null = null;
  for (const p of clientDistPaths) {
    if (fs.existsSync(p)) {
      clientDist = p;
      break;
    }
  }

  if (!clientDist) return false;

  let filePath = path.join(clientDist, reqPath === '/' ? 'index.html' : reqPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(clientDist, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '';
  const query = parsedUrl.query;

  if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      activeRooms: roomManager.getActiveRoomCount(),
      uptime: process.uptime()
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/movies') {
    const genres = query.genres
      ? (Array.isArray(query.genres) ? query.genres : [query.genres as string])
      : undefined;

    const filtered = searchAndFilterMovies({
      search: typeof query.search === 'string' ? query.search : undefined,
      genres,
      minYear: query.minYear ? parseInt(query.minYear as string, 10) : undefined,
      maxYear: query.maxYear ? parseInt(query.maxYear as string, 10) : undefined,
      minRating: query.minRating ? parseFloat(query.minRating as string) : undefined,
      maxRuntime: query.maxRuntime ? parseInt(query.maxRuntime as string, 10) : undefined,
      language: typeof query.language === 'string' ? query.language : undefined
    });
    sendJson(res, 200, filtered);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/movies/categories') {
    const categories = getCategories();
    sendJson(res, 200, categories);
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/movies/') && pathname.endsWith('/recommendations')) {
    const parts = pathname.split('/');
    const movieId = parts[3];
    const recs = getRecommendations(movieId);
    sendJson(res, 200, recs);
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/movies/')) {
    const movieId = pathname.split('/')[3];
    const movie = getMovieById(movieId);
    if (!movie) {
      sendJson(res, 404, { error: 'Movie not found' });
      return;
    }
    sendJson(res, 200, movie);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/rooms') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const movie = payload.movieId ? getMovieById(payload.movieId) : undefined;
        const room = await roomManager.createRoom(payload.hostId, movie);
        sendJson(res, 201, {
          code: room.code,
          state: room.getState()
        });
      } catch (err) {
        sendJson(res, 400, { error: 'Failed to create room' });
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/rooms/')) {
    const code = pathname.split('/')[3];
    const room = await roomManager.getRoom(code);
    if (!room) {
      sendJson(res, 404, { error: 'Room not found' });
      return;
    }
    sendJson(res, 200, {
      code: room.code,
      connectedCount: room.getConnectedCount(),
      participantCount: room.getParticipantCount()
    });
    return;
  }

  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    if (serveStatic(pathname, res)) {
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
  const parsedUrl = parse(request.url || '', true);
  const pathname = parsedUrl.pathname || '';

  if (pathname === '/ws' || pathname.startsWith('/ws/')) {
    let roomCode = parsedUrl.query.roomId as string | undefined;
    if (!roomCode && pathname.startsWith('/ws/')) {
      roomCode = pathname.replace('/ws/', '').trim();
    }

    if (!roomCode) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const code = roomCode.toUpperCase();
    let room = await roomManager.getRoom(code);
    if (!room) {
      const initialMovies = getAllMovies();
      room = await roomManager.createRoom(undefined, initialMovies[0]);
    }

    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      room.handleConnection(ws);
    });
  } else {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
