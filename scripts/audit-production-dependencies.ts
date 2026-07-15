import { spawnSync } from 'node:child_process';

type DependencyNode = {
  version?: string;
  dependencies?: Record<string, DependencyNode>;
};

type Advisory = {
  id?: number | string;
  title?: string;
  severity?: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  url?: string;
};

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
} as const;

function collectDependencies(
  dependencies: Record<string, DependencyNode> | undefined,
  versions: Map<string, Set<string>>,
) {
  for (const [name, dependency] of Object.entries(dependencies ?? {})) {
    if (dependency.version) {
      const packageVersions = versions.get(name) ?? new Set<string>();
      packageVersions.add(dependency.version);
      versions.set(name, packageVersions);
    }
    collectDependencies(dependency.dependencies, versions);
  }
}

async function main() {
  const listArguments = ['list', '--prod', '--json', '--depth', 'Infinity'];
  const listed = process.env.npm_execpath
    ? spawnSync(
        process.execPath,
        [process.env.npm_execpath, ...listArguments],
        {
          encoding: 'utf8',
        },
      )
    : spawnSync('pnpm', listArguments, { encoding: 'utf8' });
  if (listed.status !== 0)
    throw new Error(listed.stderr || 'Unable to list production dependencies.');

  const roots = JSON.parse(listed.stdout) as Array<{
    dependencies?: Record<string, DependencyNode>;
  }>;
  const versions = new Map<string, Set<string>>();
  for (const root of roots) collectDependencies(root.dependencies, versions);

  const response = await fetch(
    'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        Object.fromEntries(
          [...versions].map(([name, packageVersions]) => [
            name,
            [...packageVersions],
          ]),
        ),
      ),
    },
  );
  if (!response.ok)
    throw new Error(
      `Bulk advisory endpoint failed with HTTP ${response.status}.`,
    );

  const result = (await response.json()) as Record<string, Advisory[]>;
  const findings = Object.entries(result).flatMap(([name, advisories]) =>
    advisories
      .filter(
        (advisory) =>
          severityRank[advisory.severity ?? 'info'] >= severityRank.moderate,
      )
      .map((advisory) => ({ name, ...advisory })),
  );

  if (findings.length) {
    process.stderr.write(`${JSON.stringify({ findings }, null, 2)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Production dependency audit PASS (${versions.size} packages, no moderate-or-higher advisories).\n`,
    );
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
