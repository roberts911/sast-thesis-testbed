// control_pool/cwe_22_safe_naive_replace_avatar.js
// Bezpieczny odpowiednik: cwe_22_naive_replace_avatar.js
// Poprawka: rezygnacja z usuwania sekwencji (podejście nieidempotentne) na rzecz
// allowlisty znaków w nazwie pliku oraz weryfikacji ścieżki po rozwiązaniu.
// sendFile dodatkowo uruchamiany z opcją root, która sam w sobie blokuje wyjście
// poza katalog bazowy.

const path = require('path');
const express = require('express');

const app = express();

const AVATAR_DIR = path.resolve(__dirname, 'storage', 'avatars');
const FILENAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}\.(png|jpg|jpeg|webp)$/;

function resolveAvatarPath(filename) {
  if (!FILENAME_PATTERN.test(String(filename))) {
    throw new Error('invalid avatar name');
  }

  const fullPath = path.resolve(AVATAR_DIR, filename);
  if (!fullPath.startsWith(AVATAR_DIR + path.sep)) {
    throw new Error('path outside avatar directory');
  }
  return fullPath;
}

app.get('/avatars/:filename', (req, res) => {
  let fullPath;
  try {
    fullPath = resolveAvatarPath(req.params.filename);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  res.sendFile(path.basename(fullPath), { root: AVATAR_DIR }, (err) => {
    if (err) res.status(404).json({ error: 'avatar not found' });
  });
});

module.exports = { app, resolveAvatarPath };
