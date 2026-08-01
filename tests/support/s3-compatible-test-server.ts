import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { fileURLToPath } from 'node:url';

type StoredTestObject = { body: Buffer; contentType: string };

export type S3CompatibleTestServer = {
  endpoint: string;
  objectCount(): number;
  close(): Promise<void>;
};

type StartS3CompatibleTestServerOptions = {
  controlToken?: string;
  port?: number;
};

const privateImageKeyPattern =
  /^(?:(?:installation|warranty)-evidence|catalog-images)\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

function objectKey(request: IncomingMessage): string | null {
  if (!request.url) return null;
  const url = new URL(request.url, `http://${request.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const key = parts.slice(1).map(decodeURIComponent).join('/');
  return privateImageKeyPattern.test(key) ? key : null;
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

function createS3CompatibleServer(
  objects: Map<string, StoredTestObject>,
  controlToken: string | undefined,
): Server {
  return createServer(async (request, response) => {
    try {
      if (request.url?.startsWith('/__test__/stats')) {
        if (
          !controlToken ||
          request.headers['x-test-control-token'] !== controlToken
        ) {
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
}

export async function startS3CompatibleTestServer(
  options: StartS3CompatibleTestServerOptions = {},
): Promise<S3CompatibleTestServer> {
  const objects = new Map<string, StoredTestObject>();
  const server = createS3CompatibleServer(objects, options.controlToken);
  const port = options.port ?? 0;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    throw new Error('S3-compatible test server did not expose a TCP address.');
  }

  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    objectCount: () => objects.size,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

function configuredPort(): number {
  const port = Number.parseInt(process.env.STORAGE_TEST_PORT ?? '9010', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error('STORAGE_TEST_PORT is invalid.');
  return port;
}

const executedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (executedDirectly) {
  const controlToken = process.env.STORAGE_TEST_CONTROL_TOKEN;
  if (!controlToken || controlToken.length < 16)
    throw new Error(
      'STORAGE_TEST_CONTROL_TOKEN must contain at least 16 characters.',
    );

  void startS3CompatibleTestServer({
    controlToken,
    port: configuredPort(),
  }).then((server) => {
    process.stdout.write(
      `${JSON.stringify({ event: 's3.test-server.ready', endpoint: server.endpoint })}\n`,
    );
    const shutdown = () => {
      void server.close().catch((error: unknown) => {
        process.stderr.write(
          `${error instanceof Error ? error.message : 'Unknown shutdown error.'}\n`,
        );
        process.exitCode = 1;
      });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
