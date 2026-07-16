import { assertLocalDemoRuntime, runPnpm } from './demo-runtime';

async function main() {
  const target = assertLocalDemoRuntime(process.env, { destructive: true });
  process.stdout.write(
    `Resetting approved local demo database ${target.database} on ${target.host}.\n`,
  );
  await runPnpm([
    'exec',
    'prisma',
    'migrate',
    'reset',
    '--force',
    '--skip-seed',
    '--skip-generate',
  ]);
  await runPnpm(['demo:storage-clean']);
  await runPnpm(['db:migrate']);
  await runPnpm(['db:seed']);
  await runPnpm(['demo:seed-evidence']);
  await runPnpm(['demo:verify']);
}

void main();
