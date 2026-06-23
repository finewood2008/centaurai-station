// Mock loopback /tool bridge for end-to-end testing the computer-use subcommand
// in BRIDGE mode. Stands in for the future aioncore-hosted /tool endpoint that
// will route to the owning client. Returns the fixed test image as base64.
//
// Run:  node mock-tool-bridge.mjs [port]   (default 8731)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGE_B64 = readFileSync(join(__dirname, 'test-image.png')).toString('base64');
const PORT = Number(process.argv[2] || 8731);

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/tool') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      process.stderr.write(`[mock-bridge] /tool called: ${body}\n`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ image: IMAGE_B64, mime_type: 'image/png', text: 'screen captured (mock bridge)' }));
    });
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(PORT, '127.0.0.1', () => process.stderr.write(`[mock-bridge] listening on 127.0.0.1:${PORT}\n`));
