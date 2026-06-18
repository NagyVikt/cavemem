---
"@colony/mcp-server": patch
---

mcp: live registration telemetry now reports a `schema_tokens` proxy + `total_tokens` in `savings_report`. Previously `registration_cost` counted name+description only, under-reporting the true per-session injection cost; the schema portion (param keys + describe strings) is now included so live receipts track closer to the byte-exact budget enforced by `tool-budget.test.ts`.
