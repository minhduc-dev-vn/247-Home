import { assertLocalDemoRuntime, runPnpm } from './demo-runtime';

async function main() {
  const target = assertLocalDemoRuntime(process.env, { destructive: false });
  process.stdout.write(
    `Bootstrapping local demo database ${target.database} on ${target.host}.\n`,
  );
  await runPnpm(['db:migrate']);
  await runPnpm(['db:seed']);
  await runPnpm(['demo:seed-evidence']);
  await runPnpm(['demo:verify']);
}

void main();
