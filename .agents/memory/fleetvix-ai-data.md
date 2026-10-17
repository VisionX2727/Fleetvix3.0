---
name: Fleetu AI and persistence
description: User's product requirement for Fleetu's AI provider and durable fleet data storage.
---

Fleetu must use the user's Gemini API key through the backend. Fleet records should persist through the API server to Supabase PostgreSQL, not browser-only state.

**Why:** the user explicitly requested Gemini for Fleetu and backend persistence.

**How to apply:** Keep Gemini calls and database writes on the API server; do not switch Fleetu to another provider or treat browser-local state as the durable store.
