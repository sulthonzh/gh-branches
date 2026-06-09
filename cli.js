#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');

function ghAvailable() {
  try { execSync('gh --version', { stdio: 'pipe' }); return true; }
  catch { return false; }
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--user') { args.user = argv[++i]; }
    else if (a === '--repo') { args.repo = argv[++i]; }
    else if (a === '--stale') { args.stale = true; }
    else if (a === '--days') { args.days = parseInt(argv[++i], 10) || 30; }
    else if (a === '--json') { args.json = true; }
    else if (a === '--markdown') { args.markdown = true; }
    else if (a === '--help' || a === '-h') { args.help = true; }
    else { args._.push(a); }
  }
  if (!args.days) args.days = 30;
  return args;
}

const HELP = `
gh-branches — see all branches across your GitHub repos

USAGE:
  gh-branches [options]

OPTIONS:
  --user <user>       target GitHub user (default: authenticated user)
  --repo <repo>       single repo (owner/repo)
  --stale             show only branches older than --days
  --days <n>          stale threshold in days (default: 30)
  --json              JSON output
  --markdown          markdown output
  -h, --help          show this help

EXAMPLES:
  gh-branches                    show all branches across your repos
  gh-branches --stale            show branches inactive 30+ days
  --stale --days 60              show branches inactive 60+ days
  --repo owner/repo              branches for a single repo
`;

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function getAllRepos(user) {
  const login = user || JSON.parse(execSync('gh api user --jq .login', { encoding: 'utf-8' })).trim();
  const out = execSync(
    `gh api users/${login}/repos --paginate --jq '.[] | select(.fork == false) | .full_name'`,
    { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
  );
  return out.trim().split('\n').filter(Boolean);
}

function getBranches(repo) {
  try {
    const out = execSync(
      `gh api repos/${repo}/branches --paginate --jq '.[] | .name'`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 5 * 1024 * 1024 }
    );
    return out.trim().split('\n').filter(Boolean);
  } catch { return []; }
}

function getBranchInfo(repo, branch) {
  try {
    const out = execSync(
      `gh api repos/${repo}/branches/${encodeURIComponent(branch)} --jq '{sha: .commit.sha, date: .commit.commit.author.date, author: .commit.commit.author.name}'`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(out);
  } catch {
    return { sha: '?', date: null, author: '?' };
  }
}

function getDefaultBranch(repo) {
  try {
    return execSync(`gh api repos/${repo} --jq .default_branch`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch { return 'main'; }
}

function stalenessIcon(days) {
  if (days === null) return '?';
  if (days < 7) return '●';
  if (days < 30) return '◐';
  return '○';
}

function formatText(data) {
  const lines = [];
  for (const repo of data) {
    lines.push(`\n📁 ${repo.name}`);
    for (const b of repo.branches) {
      const icon = stalenessIcon(b.daysOld);
      const age = b.daysOld !== null ? `${b.daysOld}d` : '?';
      const def = b.isDefault ? ' (default)' : '';
      const stale = b.isStale ? ' ⚠️ stale' : '';
      lines.push(`  ${icon} ${b.name}${def}${stale}  ${b.author} · ${age}`);
    }
    if (repo.branches.length === 0) lines.push('  (no branches found)');
  }
  const total = data.reduce((s, r) => s + r.branches.length, 0);
  const staleCount = data.reduce((s, r) => s + r.branches.filter(b => b.isStale).length, 0);
  lines.push(`\n${data.length} repos · ${total} branches · ${staleCount} stale`);
  return lines.join('\n');
}

function formatJSON(data) {
  const out = data.map(r => ({
    repo: r.name,
    branches: r.branches.map(b => ({
      name: b.name,
      isDefault: b.isDefault,
      daysOld: b.daysOld,
      author: b.author,
      sha: b.sha,
      isStale: b.isStale,
    }))
  }));
  return JSON.stringify(out, null, 2);
}

function formatMarkdown(data) {
  const lines = ['# GitHub Branches\n'];
  for (const repo of data) {
    lines.push(`## ${repo.name}\n`);
    lines.push('| Branch | Default | Age | Author | Stale |');
    lines.push('|--------|---------|-----|--------|-------|');
    for (const b of repo.branches) {
      const def = b.isDefault ? '✓' : '';
      const stale = b.isStale ? '⚠️' : '';
      const age = b.daysOld !== null ? `${b.daysOld}d` : '?';
      lines.push(`| ${b.name} | ${def} | ${age} | ${b.author} | ${stale} |`);
    }
    if (repo.branches.length === 0) lines.push('_No branches found_\n');
    lines.push('');
  }
  return lines.join('\n');
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) { console.log(HELP); process.exit(0); }
  if (!ghAvailable()) { console.error('Error: gh CLI not found. Install from https://cli.github.com'); process.exit(2); }

  const repos = args.repo ? [args.repo] : getAllRepos(args.user);
  if (repos.length === 0) { console.log('No repos found.'); process.exit(0); }

  const staleDays = args.days;
  const data = [];

  for (const repo of repos) {
    const defaultBranch = getDefaultBranch(repo);
    const branches = getBranches(repo);
    const branchData = [];

    for (const name of branches) {
      const info = getBranchInfo(repo, name);
      const daysOld = daysSince(info.date);
      const isStale = daysOld !== null && daysOld >= staleDays && name !== defaultBranch;
      if (args.stale && !isStale) continue;
      branchData.push({ name, isDefault: name === defaultBranch, daysOld, author: info.author || '?', sha: info.sha, isStale });
    }

    branchData.sort((a, b) => { if (a.isDefault) return -1; if (b.isDefault) return 1; return (a.daysOld ?? 999) - (b.daysOld ?? 999); });
    data.push({ name: repo, branches: branchData });
  }

  if (args.json) console.log(formatJSON(data));
  else if (args.markdown) console.log(formatMarkdown(data));
  else console.log(formatText(data));

  const hasStale = data.some(r => r.branches.some(b => b.isStale));
  process.exit(hasStale ? 1 : 0);
}

run().catch(e => { console.error('Error:', e.message); process.exit(2); });
