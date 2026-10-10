# GitHub Organization Creation: github.com/de-agent

## Purpose
Create the `de-agent` GitHub organization to host the 111 first-party resources (skills, agents, hooks, plugins, templates, projects, patterns, runbooks) currently pointing to the non-existent `github.com/de-agent` organization.

## Current State
- 111 records in the registry have `github_url` pointing to `github.com/de-agent/*`
- All 111 return 404 (organization doesn't exist)
- Freshness checks report these as "unreachable" with 404 errors
- Records are currently marked as `verification: community` with `unreachable: true` in provenance

## Required Steps

### 1. Create GitHub Organization
1. Go to https://github.com/organizations/new
2. Organization name: `de-agent`
3. Billing email: [your-email@domain.com]
4. Plan: Free (or Team/Enterprise if needed)
4. Complete setup

### 2. Create Repositories
For each of the 8 repository groups, create the corresponding repo:

| Repo Name | Description | Source Records |
|-----------|-------------|----------------|
| `agents` | DE//AGENT agents (SQL review, Kafka lag triage, etc.) | 12 agents |
| `hooks` | DE//AGENT hooks (schema change check, cost deploy guard, etc.) | 2 hooks |
| `patterns` | DE//AGENT patterns (medallion zones, small files compaction, etc.) | 15 patterns |
| `plugins` | DE//AGENT plugins (contract kit, cost lens, etc.) | 10 plugins |
| `projects` | DE//AGENT starter projects | 6 projects |
| `runbooks` | DE//AGENT runbooks (Spark warehouse, CDC, etc.) | 15 runbooks |
| `skills` | DE//AGENT skills (Spark quality, SQL review, etc.) | 24 skills |
| `templates` | DE//AGENT templates (Airflow DAG, dbt project, etc.) | 7 templates |

### 3. Configure Each Repository
For each repo:
1. Initialize with README.md
2. Add LICENSE (Apache-2.0 for code, CC-BY-4.0 for docs)
3. Add `.github/workflows/ci.yml` for CI
4. Add `CODEOWNERS` file
5. Enable GitHub Actions
6. Configure branch protection (main branch)
7. Add repository topics/tags for discoverability

### 4. Populate Repositories
For each record in the registry:
1. Create directory structure matching `source_url` path
2. Add skill/agent/hook implementation files
2. Add `SKILL.md` / `AGENT.md` / `HOOK.md` manifest
4. Add tests/examples
5. Add README.md with usage instructions

### 5. Update Registry Records
After repos are created:
1. Run `node pipelines/refresh-provenance.mjs` to update provenance
2. Run `node pipelines/run.mjs --check` to verify
3. Run `npm run build` to rebuild site

### 6. Update Source URLs
Update `github_url` and `source_url` in curated YAML files to point to the new real URLs.

## Verification Checklist
- [ ] Organization created at github.com/de-agent
- [ ] All 8 repositories created
- [ ] All 111 records have corresponding files in repos
- [ ] `refresh-provenance.mjs` runs without 404 errors
- [ ] Pipeline passes with 0 unreachable upstreams
- [ ] `npm run build` completes successfully
- [ ] Sitemap includes all 152 resources

## Timeline Estimate
- Org creation: 15 min
- Repo creation: 30 min
- Population: 2-4 hours (depending on content readiness)
- Verification: 30 min
- **Total: ~3-5 hours**

## Notes
- The `de-agent` org name may be taken; alternatives: `de-agent-platform`, `de-agent-registry`, `data-engineering-agent`
- Consider using GitHub Teams for access control
- Enable Dependabot for dependency updates
- Enable CodeQL for security scanning