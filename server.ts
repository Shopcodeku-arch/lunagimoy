import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './server/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  // Bila file ini dijalankan dari hasil build (dist/server.js), index.html berada di folder yang sama.
  const builtIndex = path.join(__dirname, 'index.html');
  const isBuilt = fs.existsSync(builtIndex);
  const isProd = process.env.NODE_ENV === 'production' || isBuilt;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = isBuilt ? __dirname : path.resolve(__dirname, 'dist');
    const express = (await import('express')).default;
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
