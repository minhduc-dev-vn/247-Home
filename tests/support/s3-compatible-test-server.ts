import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';

const port = Number.parseInt(process.env.STORAGE_TEST_PORT ?? '9010', 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error('STORAGE_TEST_PORT is invalid.');

const objects = new Map<string, { body: Buffer; contentType: string }>();
const controlToken = process.env.STORAGE_TEST_CONTROL_TOKEN;
if (!controlToken || controlToken.length < 16)
  throw new Error(
    'STORAGE_TEST_CONTROL_TOKEN must contain at least 16 characters.',
  );

function objectKey(request: IncomingMessage): string | null {
  if (!request.url) return null;
  const url = new URL(request.url, `http://${request.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const key = parts.slice(1).map(decodeURIComponent).join('/');
  return /^installation-evidence\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)
    ? key
    : null;
}

function isSigned(request: IncomingMessage): boolean {
  if (!request.url) return false;
  const url = new URL(request.url, `http://${request.headers.host}`);
  return (
    request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 ') === true ||
    url.searchParams.has('X-Amz-Signature')
  );
}

function sendXmlError(response: ServerResponse, status: number, code: string) {
  response.writeHead(status, { 'Content-Type': 'application/xml' });
  response.end(`<Error><Code>${code}</Code><Message>${code}</Message></Error>`);
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 6 * 1024 * 1024) throw new Error('Object exceeds test limit.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (request, response) => {
  try {
    if (request.url?.startsWith('/__test__/stats')) {
      if (request.headers['x-test-control-token'] !== controlToken) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ objects: objects.size }));
      return;
    }
    if (!isSigned(request)) {
      sendXmlError(response, 403, 'AccessDenied');
      return;
    }
    const key = objectKey(request);
    if (!key) {
      sendXmlError(response, 400, 'InvalidObjectKey');
      return;
    }

    if (request.method === 'PUT') {
      const body = await readBody(request);
      objects.set(key, {
        body,
        contentType:
          request.headers['content-type'] ?? 'application/octet-stream',
      });
      response.writeHead(200, { ETag: `"test-${body.length}"` });
      response.end();
      return;
    }

    if (request.method === 'DELETE') {
      objects.delete(key);
      response.writeHead(204);
      response.end();
      return;
    }

    const object = objects.get(key);
    if (!object) {
      sendXmlError(response, 404, 'NoSuchKey');
      return;
    }
    if (request.method === 'HEAD') {
      response.writeHead(200, {
        'Content-Length': String(object.body.length),
        'Content-Type': object.contentType,
      });
      response.end();
      return;
    }
    if (request.method === 'GET') {
      response.writeHead(200, {
        'Content-Length': String(object.body.length),
        'Content-Type': object.contentType,
      });
      response.end(object.body);
      return;
    }

    response.writeHead(405, { Allow: 'DELETE, GET, HEAD, PUT' });
    response.end();
  } catch {
    sendXmlError(response, 500, 'InternalError');
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(
    `${JSON.stringify({ event: 's3.test-server.ready', port })}\n`,
  );
});

function shutdown() {
  process.stdout.write(
    `${JSON.stringify({ event: 's3.test-server.stopping', objectsRemaining: objects.size })}\n`,
  );
  server.close((error) => {
    if (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
