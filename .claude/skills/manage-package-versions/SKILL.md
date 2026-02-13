---
name: manage-package-versions
description: Consistently manage package versions across the monorepo using pnpm and changie. Use when bumping versions, preparing releases, or syncing versions.
---

# Manage Package Versions Skill

This skill provides a standardized workflow for consistently bumping package versions across the entire monorepo. It ensures that both `package.json` files and the project changelog are kept in sync.

## When to Use

- When you need to update all packages to a specific version (e.g., "update to 0.1.0").
- When preparing for a new release.
- When syncing workspace package versions.

## Instructions

### Critical Constraints

- **NO Git Commits or Pushes**: Do NOT perform any `git commit`, `git push`, or similar destructive git operations as part of this skill. Only stage changes if necessary for verification, but never commit them. Leave these actions to the user.

### 1. Bump Package Versions

Use `pnpm` to update versions in `package.json` files. For monorepos, you must update both the root and all workspace packages.

**To update the root version:**

```bash
pnpm version <version> --no-git-tag-version
```

**To update all workspace packages recursively:**

```bash
pnpm -r version <version> --no-git-tag-version
```

_Note: The `--no-git-tag-version` flag prevents pnpm from creating a git commit and tag automatically, allowing you to review changes first._

### 2. Update Changelog with Changie

After bumping the package versions, you must also update the changelog to reflect the new version.

**Batch unreleased changes into the new version:**

```bash
changie batch <version>
```

**Merge the new version notes into CHANGELOG.md:**

```bash
changie merge
```

### 3. Sync Entrypoint Versions

Maintain the version string in CLI and MCP entrypoints by updating the `.version()` call to match the new version.

**Identify files with version strings:**

Search for `.version(` in the codebase to find relevant entrypoints. Common locations include:

- `packages/mcp/src/bin.ts`
- `packages/cli/src/index.ts`

**Update the version string:**

Replace the hardcoded version string with the new `<version>`.

## Best Practices

- Always use the same `<version>` string for both `pnpm` and `changie` commands.
- Run `pnpm install` after bumping versions to update the `pnpm-lock.yaml`.
- Verify the changes in `package.json` files and `CHANGELOG.md` before committing.
