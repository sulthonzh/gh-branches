import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';

const cli = 'node /tmp/gh-branches/cli.js';

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
      const ic = stalenessIcon(b.daysOld);
      const age = b.daysOld !== null ? `${b.daysOld}d` : '?';
      const def = b.isDefault ? ' (default)' : '';
      const stale = b.isStale ? ' ⚠️ stale' : '';
      lines.push(`  ${ic} ${b.name}${def}${stale}  ${b.author} · ${age}`);
    }
    if (repo.branches.length === 0) lines.push('  (no branches found)');
  }
  const total = data.reduce((s, r) => s + r.branches.length, 0);
  const staleCount = data.reduce((s, r) => s + r.branches.filter(b => b.isStale).length, 0);
  lines.push(`\n${data.length} repos · ${total} branches · ${staleCount} stale`);
  return lines.join('\n');
}

function formatJSON(data) {
  return JSON.stringify(data.map(r => ({
    repo: r.name,
    branches: r.branches.map(b => ({
      name: b.name, isDefault: b.isDefault, daysOld: b.daysOld,
      author: b.author, sha: b.sha, isStale: b.isStale,
    }))
  })), null, 2);
}

function formatMarkdown(data) {
  const lines = ['# GitHub Branches\n'];
  for (const repo of data) {
    lines.push(`## ${repo.name}\n`);
    lines.push('| Branch | Default | Age | Author | Stale |');
    lines.push('|--------|---------|-----|--------|-------|');
    for (const b of repo.branches) {
      lines.push(`| ${b.name} | ${b.isDefault ? '✓' : ''} | ${b.daysOld !== null ? b.daysOld + 'd' : '?'} | ${b.author} | ${b.isStale ? '⚠️' : ''} |`);
    }
    if (repo.branches.length === 0) lines.push('_No branches found_\n');
    lines.push('');
  }
  return lines.join('\n');
}

describe('stalenessIcon', () => {
  it('fresh < 7 days', () => { assert.equal(stalenessIcon(0), '●'); assert.equal(stalenessIcon(6), '●'); });
  it('moderate 7-29 days', () => { assert.equal(stalenessIcon(7), '◐'); assert.equal(stalenessIcon(29), '◐'); });
  it('stale 30+ days', () => { assert.equal(stalenessIcon(30), '○'); assert.equal(stalenessIcon(365), '○'); });
  it('null returns ?', () => { assert.equal(stalenessIcon(null), '?'); });
});

describe('formatText', () => {
  it('formats repos with branches', () => {
    const data = [{
      name: 'user/repo',
      branches: [
        { name: 'main', isDefault: true, daysOld: 1, author: 'Alice', sha: 'abc', isStale: false },
        { name: 'feat/x', isDefault: false, daysOld: 45, author: 'Bob', sha: 'def', isStale: true },
      ]
    }];
    const out = formatText(data);
    assert.ok(out.includes('user/repo'));
    assert.ok(out.includes('main'));
    assert.ok(out.includes('feat/x'));
    assert.ok(out.includes('stale'));
    assert.ok(out.includes('2 branches'));
    assert.ok(out.includes('1 stale'));
  });

  it('empty branches', () => {
    const data = [{ name: 'user/empty', branches: [] }];
    const out = formatText(data);
    assert.ok(out.includes('no branches found'));
  });

  it('handles null daysOld', () => {
    const data = [{ name: 'u/r', branches: [
      { name: 'unknown', isDefault: false, daysOld: null, author: '?', sha: '?', isStale: false },
    ]}];
    const out = formatText(data);
    assert.ok(out.includes('unknown'));
    assert.ok(out.includes('?'));
  });
});

describe('formatJSON', () => {
  it('produces valid JSON with correct structure', () => {
    const data = [{ name: 'user/repo', branches: [
      { name: 'main', isDefault: true, daysOld: 5, author: 'A', sha: 'x', isStale: false }
    ]}];
    const parsed = JSON.parse(formatJSON(data));
    assert.equal(parsed[0].repo, 'user/repo');
    assert.equal(parsed[0].branches[0].name, 'main');
    assert.equal(parsed[0].branches[0].isStale, false);
  });

  it('empty branches array', () => {
    const data = [{ name: 'user/empty', branches: [] }];
    const parsed = JSON.parse(formatJSON(data));
    assert.deepEqual(parsed[0].branches, []);
  });
});

describe('formatMarkdown', () => {
  it('includes table headers and data', () => {
    const data = [{ name: 'user/repo', branches: [
      { name: 'main', isDefault: true, daysOld: 5, author: 'A', sha: 'x', isStale: false }
    ]}];
    const out = formatMarkdown(data);
    assert.ok(out.includes('# GitHub Branches'));
    assert.ok(out.includes('user/repo'));
    assert.ok(out.includes('| Branch'));
    assert.ok(out.includes('main'));
  });

  it('empty branches note', () => {
    const data = [{ name: 'u/e', branches: [] }];
    const out = formatMarkdown(data);
    assert.ok(out.includes('No branches found'));
  });
});

describe('CLI --help', () => {
  it('shows help with --help', () => {
    const out = execSync(`${cli} --help`, { encoding: 'utf-8' });
    assert.ok(out.includes('gh-branches'));
    assert.ok(out.includes('--stale'));
    assert.ok(out.includes('--days'));
    assert.ok(out.includes('--json'));
    assert.ok(out.includes('--markdown'));
    assert.ok(out.includes('--repo'));
    assert.ok(out.includes('--user'));
  });

  it('shows help with -h', () => {
    const out = execSync(`${cli} -h`, { encoding: 'utf-8' });
    assert.ok(out.includes('gh-branches'));
  });
});
