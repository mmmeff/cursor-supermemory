---
name: memory-init
description: Deep codebase exploration to initialize project memory. Use when starting work on a new project or when user asks to "index" or "learn" the codebase.
---

1. Explore the project structure: read package.json, README, main entry points
2. Identify: tech stack, framework, architecture patterns, key directories
3. Find conventions: naming, testing approach, build system, deployment
4. Read core files to understand data models and business logic
5. Save architecture summary: call `supermemory_add` with type=architecture
6. Save tech stack: call `supermemory_add` with type=project-config
7. Save key conventions: call `supermemory_add` with type=learned-pattern
8. Confirm: "Codebase indexed — [N] memories saved about [project name]"
