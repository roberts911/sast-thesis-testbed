// control_pool/cwe_79_safe_stored_comments_react_ssr.tsx
// Bezpieczny odpowiednik: cwe_79_stored_comments_react_ssr.tsx
// Poprawka: komentarz przechowywany jako tekst i renderowany jako dziecko elementu,
// więc React escapuje go automatycznie. Formatowanie realizowane jest strukturalnie
// (akapity z podziału na linie), bez wstrzykiwania HTML.

import React from 'react';
import { renderToString } from 'react-dom/server';
import express, { Request, Response } from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MAX_COMMENT_LENGTH = 2000;

interface Comment {
  id: number;
  author: string;
  body_text: string;
}

app.post('/articles/:id/comments', async (req: Request, res: Response) => {
  const author = String(req.body.author ?? '').slice(0, 80);
  const body = String(req.body.body ?? '').slice(0, MAX_COMMENT_LENGTH);

  await pool.query('INSERT INTO comments(article_id, author, body_text) VALUES ($1, $2, $3)', [
    req.params.id,
    author,
    body,
  ]);

  res.status(201).json({ ok: true });
});

function CommentList({ comments }: { comments: Comment[] }) {
  return (
    <ul className="comments">
      {comments.map((comment) => (
        <li key={comment.id}>
          <strong>{comment.author}</strong>
          <div className="body">
            {comment.body_text.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

app.get('/articles/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query<Comment>(
    'SELECT id, author, body_text FROM comments WHERE article_id = $1',
    [req.params.id],
  );

  res.type('text/html; charset=utf-8').send(
    `<!DOCTYPE html>${renderToString(<CommentList comments={rows} />)}`,
  );
});

export { app, CommentList };
