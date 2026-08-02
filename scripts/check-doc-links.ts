import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = process.cwd();
const excludedDirectories = new Set(['.git', '.next', 'node_modules']);

async function collectMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }

  return files;
}

function localLinkTarget(rawTarget: string): string | null {
  let target = rawTarget.trim();

  if (target.startsWith('<')) {
    const closingBracket = target.indexOf('>');
    if (closingBracket === -1) return target;
    target = target.slice(1, closingBracket);
  } else {
    target = target.split(/\s+["']/u, 1)[0] ?? target;
  }

  target = target.split('#', 1)[0] ?? target;
  if (target.length === 0 || /^(?:https?:|mailto:|tel:|data:)/iu.test(target)) {
    return null;
  }

  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const markdownFiles = await collectMarkdownFiles(repositoryRoot);
  const failures = new Set<string>();
  const markdownLinkPattern = /\[[^\]]*\]\((?<target>[^)]+)\)/gu;
  const explicitDocsPathPattern = /docs\/(?<target>[A-Za-z0-9_./-]+\.md)/gu;

  for (const file of markdownFiles) {
    const content = await readFile(file, 'utf8');
    const relativeFile = path.relative(repositoryRoot, file);

    for (const match of content.matchAll(markdownLinkPattern)) {
      const target = localLinkTarget(match.groups?.target ?? '');
      if (target === null) continue;

      const candidate = path.resolve(path.dirname(file), target);
      if (
        !candidate.startsWith(`${repositoryRoot}${path.sep}`) ||
        !(await pathExists(candidate))
      ) {
        failures.add(`${relativeFile}: broken link ${target}`);
      }
    }

    for (const match of content.matchAll(explicitDocsPathPattern)) {
      const target = match.groups?.target;
      if (target === undefined) continue;

      const candidate = path.resolve(repositoryRoot, 'docs', target);
      if (!(await pathExists(candidate))) {
        failures.add(`${relativeFile}: missing docs/${target}`);
      }
    }
  }

  const decisionsDirectory = path.join(repositoryRoot, 'docs', 'decisions');
  const decisionFiles = await readdir(decisionsDirectory);
  const ids = new Map<string, string>();

  for (const file of decisionFiles) {
    const match = /^ADR-(?<id>\d{3})-/u.exec(file);
    const id = match?.groups?.id;
    if (id === undefined) continue;

    const existing = ids.get(id);
    if (existing !== undefined) {
      failures.add(`Duplicate ADR-${id}: ${existing}, ${file}`);
    } else {
      ids.set(id, file);
    }
  }

  if (failures.size > 0) {
    for (const failure of [...failures].sort()) console.error(failure);
    process.exitCode = 1;
    return;
  }

  console.info(
    `Documentation check PASS (${markdownFiles.length} Markdown files, ${ids.size} ADRs).`,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
