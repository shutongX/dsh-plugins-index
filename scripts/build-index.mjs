/**
 * Build index.json for the shutongX DSH plugin market.
 *
 * Both modes pin the highest SemVer release tag. Local mode reads sibling plugin
 * repos from disk; remote mode is for CI and reads published releases from GitHub.
 *
 * Usage:
 *   node scripts/build-index.mjs               # print the index, no write
 *   node scripts/build-index.mjs --write       # write index.json + icons
 *   node scripts/build-index.mjs --remote --write
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rcompare, valid } from 'semver';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE = process.argv.includes('--remote');
const WRITE = process.argv.includes('--write');
const OWNER = 'shutongX';
const INDEX_URL = 'https://shutongX.github.io/dsh-plugins-index/index.json';
const ENGINE = '>=0.2.1-rc.1 <3';

const CATEGORIES = {
  tools: { en: 'Tools', zh: '实用工具' },
  dev: { en: 'Developer Tools', zh: '开发者工具' },
  remote: { en: 'Remote Access', zh: '远程访问' },
};

const PLUGINS = [
  {
    repo: 'dsh-session-message',
    title: { en: 'Session Messaging', zh: '跨会话消息' },
    description: {
      en: 'Send a user-role message to another DSH session in any workspace, and let it reply.',
      zh: '给任意工作区的另一个会话发一条 user 消息；对方可以再回给你。',
    },
    category: 'tools',
  },
  {
    repo: 'dsh-pocket-switch',
    title: { en: 'Pocket Switch', zh: '换电脑' },
    description: {
      en: 'Switch between DSH hosts from your phone: addresses and access pins stored once, automatic login.',
      zh: '在多台电脑的 DSH（dsh-pocket 手机访问）之间一键切换：保存地址与密码、自动登录。',
    },
    category: 'remote',
  },
  {
    repo: 'dsh-config-migrator',
    title: { en: 'Config Migrator', zh: '配置迁移' },
    description: {
      en: 'Export selected DSH configuration sections as a zip and restore them on a new machine with a conflict preview.',
      zh: '把本机 DSH 的分区配置导出为 zip，在新机器上按需导入并先分析冲突。',
    },
    category: 'dev',
  },
  {
    repo: 'dsh-perf',
    title: { en: 'Performance Suite', zh: '性能套件' },
    description: {
      en: 'Measure per-plugin client cost, compare runs, and generate agent-readable optimization reports.',
      zh: '按插件采集耗时、保存对比记录、生成给 agent 读的优化报告。',
    },
    category: 'dev',
  },
];

function pickLatestTag(tags) {
  const stable = tags.map((tag) => tag.replace(/^v/, '')).filter((tag) => valid(tag) !== null);
  if (stable.length === 0) throw new Error('no SemVer release tag found');
  return 'v' + stable.sort(rcompare)[0];
}

function localPackage(repo) {
  const dir = resolve(ROOT, '..', repo);
  const tags = execFileSync('git', ['-C', dir, 'tag', '--list', 'v*'], { encoding: 'utf8' })
    .split('\n').map((line) => line.trim()).filter(Boolean);
  const tag = pickLatestTag(tags);
  const manifest = JSON.parse(execFileSync('git', ['-C', dir, 'show', tag + ':package.json'], { encoding: 'utf8' }));
  const commit = execFileSync('git', ['-C', dir, 'rev-list', '-n', '1', tag], { encoding: 'utf8' }).trim();
  const time = Number(execFileSync('git', ['-C', dir, 'log', '-1', '--format=%ct', tag], { encoding: 'utf8' }).trim());
  return { manifest, commit, time, iconFile: join(dir, 'icon.svg') };
}

async function remotePackage(repo) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'dsh-plugins-index' };
  if (process.env.GITHUB_TOKEN) headers.authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const base = 'https://api.github.com/repos/' + OWNER + '/' + repo;
  const releaseResponse = await fetch(base + '/releases?per_page=100', { headers });
  if (!releaseResponse.ok) throw new Error(repo + ': releases HTTP ' + releaseResponse.status);
  const releases = (await releaseResponse.json())
    .filter((release) => release.draft !== true && release.prerelease !== true)
    .map((release) => release.tag_name);
  const ref = pickLatestTag(releases);
  const tagCommit = await fetch(base + '/commits/' + ref, { headers });
  if (!tagCommit.ok) throw new Error(repo + ': commits/' + ref + ' HTTP ' + tagCommit.status);
  const tagJson = await tagCommit.json();
  const commit = tagJson.sha;
  const time = Math.floor(Date.parse(tagJson.commit.committer.date) / 1000);
  const manifestResponse = await fetch('https://raw.githubusercontent.com/' + OWNER + '/' + repo + '/' + ref + '/package.json', { headers });
  if (!manifestResponse.ok) throw new Error(repo + ': package.json@' + ref + ' HTTP ' + manifestResponse.status);
  const iconResponse = await fetch('https://raw.githubusercontent.com/' + OWNER + '/' + repo + '/' + ref + '/icon.svg', { headers });
  if (!iconResponse.ok) throw new Error(repo + ': icon.svg@' + ref + ' HTTP ' + iconResponse.status);
  return { manifest: await manifestResponse.json(), commit, time, icon: Buffer.from(await iconResponse.arrayBuffer()) };
}

const plugins = [];
for (const spec of PLUGINS) {
  const loaded = REMOTE ? await remotePackage(spec.repo) : localPackage(spec.repo);
  const manifest = loaded.manifest;
  if (manifest.name !== spec.repo) throw new Error(spec.repo + ': package name must be ' + spec.repo + ', got ' + manifest.name);
  if (!manifest.dsh || !manifest.dsh.bundle || !manifest.dsh.bundle.patch) throw new Error(spec.repo + ': missing dsh.bundle.patch');
  const url = 'https://github.com/' + OWNER + '/' + spec.repo;
  plugins.push({
    name: manifest.name,
    title: spec.title,
    description: spec.description,
    icon: 'icons/' + spec.repo + '.svg',
    author: 'shutongX',
    homepage: url + '#readme',
    repository: { url },
    metadata: {
      category: spec.category,
      keywords: manifest.keywords ?? [],
      labels: ['git'],
    },
    versions: [{
      version: manifest.version,
      publishTimestamp: loaded.time,
      source: { type: 'git', url, commit: loaded.commit },
      engines: { dsh: manifest.engines?.dsh ?? ENGINE },
    }],
  });
  if (WRITE) {
    mkdirSync(join(ROOT, 'icons'), { recursive: true });
    writeFileSync(join(ROOT, 'icons', spec.repo + '.svg'), REMOTE ? loaded.icon : readFileSync(loaded.iconFile));
  }
}

const index = {
  format: 1,
  title: { en: 'shutongX DSH plugins', zh: 'shutongX 的 DSH 插件' },
  description: {
    en: 'Community plugins for DeepSeek Harness by shutongX: cross-session messaging, pocket switching, configuration migration and performance profiling.',
    zh: 'shutongX 的 DeepSeek Harness 插件：跨会话消息、换电脑、配置迁移、性能套件。',
  },
  metadata: {
    categories: Object.fromEntries(Object.entries(CATEGORIES).map(([id, titles]) => [id, { title: titles }])),
    labels: { git: { title: { en: 'Git bundle', zh: 'Git 源码包' } } },
  },
  plugins,
};

if (WRITE) writeFileSync(join(ROOT, 'index.json'), JSON.stringify(index, null, 2) + '\n');

try {
  const { parseMarketIndex } = await import('@deepseek-ai/dsh-plugin-market-index');
  const parsed = parseMarketIndex(index, INDEX_URL);
  console.log('valid index format 1:', parsed.plugins.length, 'plugins');
} catch (error) {
  if (error && error.code === 'ERR_MODULE_NOT_FOUND') console.log('validator not installed; skipped validation');
  else throw error;
}

if (!WRITE) console.log(JSON.stringify(index, null, 2));
