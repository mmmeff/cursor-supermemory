---
name: supermemory-config
description: Configure Supermemory settings for this project
---

Create or edit `.cursor/.supermemory/config.json` at your project root:

```json
{
  "apiKey": null,
  "projectContainerTag": null,
  "userContainerTag": null
}
```

Settings:
- `apiKey`: Override the global API key for this project
- `projectContainerTag`: Custom tag for project memories (default: auto-generated from git root). Commit this when a team should share one project memory bucket.
- `userContainerTag`: Custom tag for user memories (default: auto-generated from email/machine)

Do not commit `apiKey`. If the config only contains a shared `projectContainerTag` and non-secret defaults, it is safe to commit.
