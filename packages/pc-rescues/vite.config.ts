import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Capture immutable build identity at compile time. Lambda deployments do not
// necessarily contain a .git directory, so never look up HEAD at request time.
const webPackage = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim() || null;
  } catch {
    return null;
  }
}

const gitHead = git('rev-parse', 'HEAD');
const gitCommit = [
  process.env.RESCUE_HUB_GIT_SHA,
  process.env.GITHUB_SHA,
  gitHead
].map(value => value?.trim()).find(value => value && /^[a-f0-9]{40}$/i.test(value))?.toLowerCase() ?? null;
const gitBranch = [
  process.env.RESCUE_HUB_GIT_BRANCH,
  process.env.GITHUB_HEAD_REF,
  process.env.GITHUB_REF_NAME,
  git('symbolic-ref', '--quiet', '--short', 'HEAD')
].map(value => value?.trim()).find(value => value && value !== 'HEAD') ?? null;
const buildInfo = {
  version: webPackage.version,
  gitCommit,
  gitBranch,
  builtAt: new Date().toISOString()
};

export default defineConfig({
  define: {
    __RESCUE_HUB_BUILD_INFO__: JSON.stringify(buildInfo)
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0'
  },
  plugins: [sveltekit()]
});
