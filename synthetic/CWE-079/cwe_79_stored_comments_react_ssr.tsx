// cwe_79_stored_comments_react_ssr.tsx
// Poziom przepływu 3/5: stored XSS + sink specyficzny dla frameworka.
// Scenariusz: sekcja komentarzy renderowana po stronie serwera w React. React domyślnie
// escapuje treść, więc autor sięgnął po dangerouslySetInnerHTML, aby zachować
// pogrubienia wpisane przez użytkowników. Source (POST) i sink (SSR) dzieli baza danych.

import React from 'react';
import { renderToString } from 'react-dom/server';
import express, { Request, Response } from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface Comment {
  id: number;
  author: string;
  body_html: string;
}

app.post('/articles/:id/comments', async (req: Request, res: Response) => {
  const { author, body } = req.body; // SOURCE

  await pool.query('INSERT INTO comments(article_id, author, body_html) VALUES ($1, $2, $3)', [
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
          {/* SINK: treść z bazy wstrzykiwana jako surowy HTML, z pominięciem escapingu Reacta. */}
          <div dangerouslySetInnerHTML={{ __html: comment.body_html }} />
        </li>
      ))}
    </ul>
  );
}

app.get('/articles/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query<Comment>(
    'SELECT id, author, body_html FROM comments WHERE article_id = $1',
    [req.params.id],
  );

  res.type('html').send(`<!DOCTYPE html>${renderToString(<CommentList comments={rows} />)}`);
});

export { app, CommentList };
