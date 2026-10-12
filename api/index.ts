import app from '../server/app.ts';

// Vercel Serverless Function handler
export default function handler(req: any, res: any) {
  return app(req, res);
}
