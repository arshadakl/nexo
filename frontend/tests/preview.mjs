import { createServer } from 'node:http';
import { createWorkspaceFixture } from './fixtures.mjs';

const fixture = createWorkspaceFixture();
const server = createServer(async (request, response) => {
  try {
    let body = '';
    for await (const chunk of request) body += chunk;
    const result = await fixture.fetcher(`http://127.0.0.1:8787${request.url}`, {
      method: request.method,
      ...(body ? { body } : {}),
    });
    response.writeHead(result.status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(await result.text());
  } catch {
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ success: false, error: { message: 'Fixture request failed' } }));
  }
});
server.listen(8787, '127.0.0.1', () =>
  console.log(
    'In-memory UI fixture API: http://127.0.0.1:8787 (no real messages or authentication)',
  ),
);
