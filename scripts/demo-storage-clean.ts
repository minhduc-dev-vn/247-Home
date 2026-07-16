import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

import { assertLocalDemoRuntime } from './demo-runtime';

async function main() {
  assertLocalDemoRuntime(process.env, { destructive: true });
  const bucket = process.env.STORAGE_BUCKET;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;
  if (
    !bucket?.includes('demo') ||
    !endpoint ||
    !accessKeyId ||
    !secretAccessKey
  )
    throw new Error('A local demo storage configuration is required.');
  const endpointUrl = new URL(endpoint);
  if (!['127.0.0.1', 'localhost', 'storage'].includes(endpointUrl.hostname))
    throw new Error(
      'Demo storage cleanup only accepts a local MinIO endpoint.',
    );

  const client = new S3Client({
    region: process.env.STORAGE_REGION ?? 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  let continuationToken: string | undefined;
  let deleted = 0;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'installation-evidence/',
        ContinuationToken: continuationToken,
      }),
    );
    const objects = (page.Contents ?? []).flatMap(({ Key }) =>
      Key ? [{ Key }] : [],
    );
    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects },
        }),
      );
      deleted += objects.length;
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);
  client.destroy();
  process.stdout.write(`Removed ${deleted} local demo evidence object(s).\n`);
}

void main();
