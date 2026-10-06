# Technical Post-Mortem: Prisma 8 CLI Initialization Failure (CLI.INIT_EMIT_FAILED)

## Executive Summary

- **Incident Type:** Local Enviornment & Toolchain Enviornment Failure
- **Affected Service/Package:** `prisma` CLI & ORM Toolchain(v8.0.0 Pre-release)
- **Error Codes:** `CLI.INIT_EMIT_FAILED`, `CONTRACT.PACK_CONTRIBUTION_INVALID`

* **Resolution:** Cleared corrupted package lock trees, force-synchronized internal engine/CLI pre-release versions via strict pinning (`--save-exact`), and explicitly installed missing environment peer dependencies (`temporal-polyfill`).

---

## The Symptom & Detection

During the initialization of a fresh project environment via `prisma init`, the installation process aborted with an explicit toolchain failure: **`CLI.INIT_EMIT_FAILED`**.

Instead of correctly generating standard database migration models and schema architectures, the primary CLI runner terminated immediately when encountering the `enum` keyword in the schema layout, throwing a secondary runtime crash: **`CONTRACT.PACK_CONTRIBUTION_INVALID`**.

---

## Root Cause Analysis (RCA)

### 1. Version Asynchrony in Pre-release Sub-packages

Because Prisma 8 was running on pre-release versions (`-rc`), standard `npm` semver ranges allowed mismatched internal engine components to install concurrently. The primary CLI runner (`8.0.0-rc.19`) was operating with underlying database engine packages running an older iteration (`8.0.0-rc.14`). The primary runner could not parse or interpret the payload structures emitted by the older compiler engine, resulting in a parser crash on the `enum` keyword (`pslBlock contribution at enum`).

### 2. Missing Runtime Peer Dependency

Modern Prisma 8 internal architecture shifts core time-tracking capabilities to native JavaScript Temporal APIs. The global configuration evaluator (`prisma.config.ts`) crashed instantly because the required peer environment dependency, `temporal-polyfill`, was missing from the node workspace.

### 3. AI Extension Hook Loop

Executing the generic `prisma init` mistakenly entered Prisma 8's new automated "AI Coding Agent Skills" flow. Rather than bootstrapping standard database configuration files, it attempted to scaffold workspace reference documentation intended for AI-augmented editors (such as Cursor, Claude, and Devin), compounding the deployment loop.

---

## Step-by-Step Resolution

### Step 1: Purged The Corrupted Dependency Trees

Wiped out the local package lock and cached modules to ensure no stale pre-release references remain:

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
```

### Step 2: Provisioned Missing Environment Peer Dependencies

Explicitly injected the required runtime polyfill into the development workspace:

```bash
npm install temporal-polyfill
```

### Step 3: Applied Strict Version Pinning

Forced to align the mismatched internal engines and toolchains by using strict exact version boundaries (`--save-exact` / `-E`) to prevent semver range drift:

```bash

# Pinned the specific Postgres engine package
npm install @prisma/orm-postgres@8.0.0-rc.13 --save-exact

# Aligned the development toolchain and primary CLI runner
npm install prisma@8.0.0-rc.19 --save-dev --save-exact
```

---

## Preventive Guardrails

- **Lock Pre-releases Strictly:** When evaluating pre-release builds (`-alpha`, `-beta`, `-rc`), never rely on caret (`^`) or tilde (`~`) semver ranges. Always enforce exact version pinning via `package.json` to prevent dependency mismatch loops.
- **Isolate Agent Workflows:** Ensured that flags or targeted commands are verified when working in IDE environments utilizing automated AI coding tools, ensuring standard framework bootstrapping commands don't default to agentic scaffolding tasks.
