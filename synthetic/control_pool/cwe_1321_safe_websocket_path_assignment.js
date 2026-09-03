// control_pool/cwe_1321_safe_websocket_path_assignment.js
// Bezpieczny odpowiednik: cwe_1321_websocket_path_assignment.js
// Poprawka: każdy segment ścieżki musi przejść walidację wzorcem i nie może odnosić
// się do prototypu, obiekty pośrednie tworzone są bez prototypu, a głębokość ścieżki
// jest ograniczona. Rejestr dokumentów oparty na Map, więc identyfikator dokumentu
// nie staje się kluczem zwykłego obiektu.

const { WebSocketServer } = require('ws');

const documents = new Map();

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const SEGMENT_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_DEPTH = 8;

function parsePath(dottedPath) {
  const segments = String(dottedPath).split('.');

  if (segments.length === 0 || segments.length > MAX_DEPTH) {
    throw new Error('invalid path depth');
  }
  for (const segment of segments) {
    if (!SEGMENT_PATTERN.test(segment) || FORBIDDEN_SEGMENTS.has(segment)) {
      throw new Error('invalid path segment');
    }
  }
  return segments;
}

function setByPath(target, dottedPath, value) {
  const segments = parsePath(dottedPath);
  let cursor = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];

    if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
      cursor[segment] = Object.create(null);
    }
    cursor = cursor[segment];
  }

  cursor[segments[segments.length - 1]] = value;
  return target;
}

function applyPatch(patch) {
  if (!documents.has(patch.documentId)) {
    documents.set(patch.documentId, { meta: Object.create(null), blocks: [] });
  }
  return setByPath(documents.get(patch.documentId), patch.path, patch.value);
}

function startCollabServer(port) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (socket) => {
    socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        const document = applyPatch({
          documentId: String(parsed.documentId || ''),
          path: parsed.path,
          value: parsed.value,
        });
        socket.send(JSON.stringify({ ok: true, document }));
      } catch (err) {
        socket.send(JSON.stringify({ ok: false, error: err.message }));
      }
    });
  });

  return wss;
}

module.exports = { startCollabServer, applyPatch, setByPath, parsePath };
