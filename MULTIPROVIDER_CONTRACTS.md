# Portable project flows — 2.10

All six agents keep the provider/model selected by the user. No automatic model substitution or additional repair requests are introduced.

Each stage produces a bounded JSON handoff. The runtime validates required fields, string/list limits, allowed fields and review evidence locally. Valid JSON does not prove semantic correctness: independent review, QA, source hashes and supervised writes remain in force. Developer output still uses compact edits resolved against exact originals. Incomplete or invalid results stop the flow without writing sources.

Provider adapters use native schema output only for recognized supported model families or advertised gateway capabilities. Unknown models and custom endpoints use JSON instructions with the same local validation. Selecting prompt format explicitly disables native schema parameters. A rejected native request is not silently resent.

The model catalog can supply output limits. Unknown context/output limits are recorded as unknown rather than guessed. Configured output ceilings remain bounded; a known smaller output limit is respected. Compatibility detection is conservative and is not a guarantee that an arbitrary model will follow instructions.

Sources precede changing task metadata in the stage messages. Structured handoffs are passed only to their dependent stages; QA never receives the reviewer's conclusion. The reviewer still receives full originals and proposals; QA receives complete proposed files. Only adjacent identical conversation entries are deduplicated. No learned/lossy compressor is applied to code, requirements, JSON or patches.

## Optional policy

Flow requests accept a snapshot policy:

```json
{"format":"auto","cache":"provider","history":"dedupe","agents":{"qa":{"format":"prompt"}}}
```

- `format`: `auto` or `prompt`.
- `cache`: `provider` (default, no explicit writes) or `explicit` (compatible Anthropic endpoint only, with a sufficiently long source prefix). Explicit caching can incur write/storage charges and does not guarantee a hit. The prefix heuristic does not replace provider token counting. Other endpoints retain their provider-managed behavior; implicit caching may operate regardless of this setting.
- `history`: `dedupe` or `full`. Requirements are never shortened.
- `agents`: optional per-role overrides, inheriting the common policy.

The project UI offers format/cache selection. The inspector records contract and adapter mode. Cache read/write and known thinking counts are normalized from reported usage. Provider output counters have different semantics; a missing breakdown is not inferred as a verified cache hit or monetary saving.

## Measurement

Compare the same goal, source snapshot, history, bindings and completed stages. Record prompt, output, provider total, cache reads/writes, attempts and finish status. A single before/after sample is observational: stochastic output and reasoning differ. Monetary cost requires the user's actual billing tier and applicable rates; token totals alone cannot establish a dollar amount.

No LLMLingua, Instructor, LiteLLM or RouteLLM service is required. Learned compression and automatic model routing remain separate opt-in experiments requiring quality evaluations. The current routing policy is the explicit per-agent binding.

## Authorized model changes on resume

Resume preserves completed stages and their original bindings. Rebinding unfinished stages requires `confirmModelChange: true` and a new `bindings` map; an audit event records each old/new pair. The UI exposes this as an unchecked option. Model selection is never silently refreshed from global settings.

For a server restart, failed checkpoints **before proposal creation only** can be restored by opening the same root and supplying `savedProjectId` to the resume endpoint. The runtime loads its own saved flow, verifies the saved session root and every source hash, and preserves the flow ID, call budget, active deadline and retry counter. Checkpoints with drafts, changed sources or an exhausted retry budget are rejected. This is not a general restart recovery mechanism for applied drafts.
