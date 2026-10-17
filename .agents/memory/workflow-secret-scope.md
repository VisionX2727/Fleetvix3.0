---
name: Secret visibility by runtime
description: A workspace-specific note about checking Replit secrets from shell versus managed app processes.
---

Do not infer that a configured secret is missing from the app just because `ShellExec` cannot see it. In this project, the Supabase URL and service-role secret were reported as present by the environment tooling but absent in a shell process.

**Why:** A direct shell-side Supabase probe found no shell environment values even though the Replit secret status showed both entries present.

**How to apply:** Check secret existence with environment tooling and diagnose the managed app through its workflow. Never print secret values.
