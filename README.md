# gh-branches

See all branches across your GitHub repos. Find stale branches, clean up your repos.

## Why?

You have 20+ repos. Each one sprouts branches like weeds. `feature/fix-thing`, `wip`, `temp`, `old-approach` — they pile up. `gh-branches` shows you everything across all your repos at once, with staleness indicators so you know what to delete.

## Install

```bash
npm install -g gh-branches
```

Requires [GitHub CLI](https://cli.github.com) (`gh`) installed and authenticated.

## Usage

```bash
# See all branches across all your repos
gh-branches

# Only stale branches (30+ days old by default)
gh-branches --stale

# Stale threshold: 60 days
gh-branches --stale --days 60

# Single repo
gh-branches --repo owner/repo

# Check another user's repos
gh-branches --user octocat

# JSON output
gh-branches --json

# Markdown table
gh-branches --markdown
```

## Output

```
📁 sulthonzh/gh-branches
  ● main (default)  Alice · 1d
  ○ feat/old-thing  Bob · 45d ⚠️ stale

📁 sulthonzh/depwalk
  ● main (default)  Alice · 3d

2 repos · 3 branches · 1 stale
```

Staleness indicators:
- `●` Active (< 7 days)
- `◐` Low activity (7-29 days)
- `○` Stale (30+ days)

Exit codes: `0` = no stale branches, `1` = stale branches found, `2` = error

Great for CI — fail your pipeline when branches pile up.

## As a module

```js
const { execSync } = require('child_process');
// This CLI is designed for terminal use.
// For programmatic GitHub API access, use the `gh` CLI or Octokit directly.
```

## License

MIT
