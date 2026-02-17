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
- `projectContainerTag`: Custom tag for project memories (default: auto-generated from git root)
- `userContainerTag`: Custom tag for user memories (default: auto-generated from email/machine)

Add `.cursor/.supermemory/` to your `.gitignore` to keep credentials out of version control.
