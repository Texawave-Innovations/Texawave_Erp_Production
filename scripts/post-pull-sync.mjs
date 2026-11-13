// Runs after `git pull` / merge / rebase (via .husky/post-merge and .husky/post-rewrite).
// Cross-platform (Node only). Never fails the git operation: problems are printed as warnings.
import { execSync, spawnSync } from 'node:child_process';

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();

let changed;
try {
  changed = git('diff --name-only ORIG_HEAD HEAD').split('\n').filter(Boolean);
} catch {
  process.exit(0); // no ORIG_HEAD (fresh clone etc.) — nothing to compare
}

const touched = (re) => changed.some((f) => re.test(f));
const run = (label, args) => {
  console.log(`\n[post-pull] ${label}: pnpm ${args.join(' ')}`);
  const r = spawnSync('pnpm', args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.warn(`[post-pull] WARNING: "${label}" failed. Run it manually: pnpm ${args.join(' ')}`);
    return false;
  }
  return true;
};

const deps = touched(/(^|\/)(pnpm-lock\.yaml|package\.json)$/);
const prisma = touched(/^packages\/database\/prisma\/(schema\.prisma|migrations\/)/);
const migrations = touched(/^packages\/database\/prisma\/migrations\//);
const perms = touched(/^packages\/database\/prisma\/permissions\//);
const menu = touched(/^packages\/database\/prisma\/menu\//);

if (deps) run('Install dependencies', ['install', '--frozen-lockfile']);
if (deps || prisma) run('Generate Prisma client', ['--filter', 'database', 'generate']);
if (migrations) run('Apply DB migrations', ['--filter', 'database', 'migrate:deploy']);
if (perms) run('Sync permissions', ['--filter', 'database', 'permissions:sync']);
if (menu) run('Sync menu', ['--filter', 'database', 'menu:sync']);

if (!(deps || prisma || perms || menu)) console.log('[post-pull] Nothing to sync.');
