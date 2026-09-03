// cwe_1321_websocket_path_assignment.js
// Poziom przepływu 5/5: najtrudniejszy - źródłem jest wiadomość WebSocket,
// a zapis odbywa się przez własną funkcję setByPath ze ścieżką w notacji kropkowej.
// Scenariusz: edytor współdzielony wysyła patche stanu dokumentu. Ścieżka ("meta.title")
// jest rozbijana na segmenty i użyta do nawigacji po obiekcie - segment "__proto__"
// wyprowadza zapis poza dokument.
// Dane przechodzą przez JSON.parse, normalizację patcha i rejestr dokumentów w pamięci,
// a sam sink nie zawiera żadnego literału klucza - jest w pełni dynamiczny.
// Test dla skanera: czy śledzi taint przez notację kropkową i indeksowanie tablicą segmentów.

const { WebSocketServer } = require('ws');

const documents = new Map();

function setByPath(target, dottedPath, value) {
  const segments = String(dottedPath).split('.');
  let cursor = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];

    if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }

  // SINK: ostatni segment ścieżki użyty jako klucz zapisu, bez wykluczenia __proto__.
  cursor[segments[segments.length - 1]] = value;
  return target;
}

function normalizePatch(rawPatch) {
  return {
    documentId: String(rawPatch.documentId || ''),
    path: rawPatch.path,
    value: rawPatch.value,
  };
}

function applyPatch(patch) {
  if (!documents.has(patch.documentId)) {
    documents.set(patch.documentId, { meta: {}, blocks: [] });
  }
  return setByPath(documents.get(patch.documentId), patch.path, patch.value);
}

function startCollabServer(port) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (socket) => {
    socket.on('message', (raw) => {
      const patch = normalizePatch(JSON.parse(raw.toString())); // SOURCE
      const document = applyPatch(patch);
      socket.send(JSON.stringify({ ok: true, document }));
    });
  });

  return wss;
}

module.exports = { startCollabServer, applyPatch, setByPath };
