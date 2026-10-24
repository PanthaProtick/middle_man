# Codex ticket implementation: tool costs and environment priorities

Analysed **24 October 2026, Asia/Dhaka**. This report covers every locally discoverable Codex ticket implementation/review chat for `E:\middle_man`: **six parents, twelve review children, 513 outer tool calls, and 414 command-completion events**. It reports historical measurements and proposes experiments; it does not change the environment.

## Main findings

The most expensive tools depend on what “taxing” means:

| Cost to optimize | Largest measured contributor | Practical implication |
| --- | --- | --- |
| Readable material returned to the model | Read/search/diff: **687,081 estimated tokens**, 74.9% of all readable tool results | Bound source/spec/diff reads before optimizing prose or command startup. |
| Recorded command duration | Browser/server and database lifecycle categories: **5,312.6 seconds**, 89.4% of summed command duration | Build repeatable disposable acceptance fixtures; separate server lifetime from blocked work first. |
| Repeated model processing | Ticket 03 parent: **14.48M input tokens** across 93 responses; peak request **222,334** | This is the highest-cost ticket by parent model input and request pressure. |
| Avoidable failed operations | **9 PowerShell parser failures**, 3 restricted-token PostgreSQL failures, 2 encoding failures | Fix command construction and fixture startup paths before considering hardware changes. |
| Review overhead | Twelve children: **98 calls**, **6.15M input tokens**, about **296k estimated result tokens** | Preserve independent review, but give reviewers bounded, relevant evidence. |

All six parents exceeded 150k recorded input tokens in one request. Their starting requests already contained about 35k–37k. High cache reuse did not keep requests small. The logs do **not** measure CPU, RAM, disk contention, inference latency, energy, subscription quota accounting, or dollar cost per tool. There is no evidence here that buying more RAM, moving to Linux, or disabling reviews would improve the overall result.

## Scope, discovery, and exclusions

Fresh discovery read metadata from **111 JSONL files**, with **zero metadata parsing errors**. Of these, **34 files / 32 unique session IDs** declared this repository as their working directory. Multiple files for one later harness discussion are rotations of one chat, not separate ticket implementations.

The six parents and explicit `thread_spawn.parent_thread_id` children match the earlier source manifest. All **18 complete source SHA-256 hashes**, canonical tool-call counts, unique response counts, and per-response usage sums were checked against raw logs. None of those source files changed. The original measurement cutoff is **24 October 2026, 05:14:37.677 UTC / 11:14:37.677 Dhaka**; fresh discovery found no later Codex ticket implementation chat.

| Alias | Ticket / actual work | Parent session ID | Parent calls | Child calls | Family total |
| --- | --- | --- | ---: | ---: | ---: |
| C03 | 03: Buyer submission review, fixes, acceptance and completion | `01a169ca-7337-7651-a90d-d67def5a7be5` | 90 | 15 | 105 |
| C06 | 06: SMS import | `01a16a34-7b8b-79e0-9935-3f91a3454073` | 73 | 17 | 90 |
| C07 | 07: Evidence conflict resolution | `01a16a47-4d75-7fb1-9bc6-ec87806e63ff` | 58 | 15 | 73 |
| C08 | 08: Pending buyer corrections | `01a16a55-a6d2-72c0-bb9e-06c0df7fac26` | 71 | 16 | 87 |
| C09 | 09: Unallocated receipt corrections | `01a16c25-897a-7361-b40b-2de37670fedc` | 60 | 14 | 74 |
| C10 | 10: Manual payment exceptions | `01a16c38-c9a2-7a00-a516-d535ea93fd23` | 63 | 21 | 84 |
| **Total** | | | **415** | **98** | **513** |

Excluded from ticket totals:

- Phase-1 planning and its two research children: design work, not ticket implementation.
- Six guardian sessions: zero tool calls. They separately record **1,109,115 input / 3,986 output tokens**; metadata does not establish explicit parent linkage, so they are not allocated to ticket families.
- Context investigations, harness optimization/benchmarking discussions, their research child, a later guardian, and this report chat. Including analysis work would contaminate the measured workload.
- Antigravity implementations/reviews. Tickets 01, 02, 04 and 05 have no Codex ticket implementation parent in the discovered logs. Ticket 03 also has Antigravity history; this report counts its Codex work only. No Codex ticket 11–19 implementation was discovered.
- Deleted/unavailable histories and sessions started outside this working directory. “All” means all discoverable repository-linked Codex ticket logs, not proof that no other work ever occurred.

The separate [Antigravity tool-call report](tool-call-analysis-and-environment-optimization.md) measures another client. Its tool schemas, timer loops, shell timings and provider counters must not be imported into Codex totals. That document and its index entry were being updated independently during this investigation; those edits were preserved.

## Evidence and accounting method

- [Codex audit and source verification](session-analysis/codex-ticket-tool-audit.json): selected session IDs, source paths/hashes, discovery/exclusions, usage, inventories, largest results and command aggregates.
- [Command event ledger](session-analysis/codex-ticket-command-events.csv): 414 unique execution IDs, source lines, duration, exit status, classification, diagnostic flags and inferred intervals; no raw commands/output bodies.
- [Existing outer-call ledger](session-analysis/tool-calls.csv): canonical call IDs, invocation/result lines, readable sizes, images, opacity and truncation. Filter to the 18 IDs in the audit; it also contains excluded work and Antigravity records.
- [Existing response ledger](session-analysis/model-responses.csv), [source manifest](session-analysis/measurements.json), and [detailed token methodology](session-analysis-methodology.md).

One `exec` can run multiple commands, patches or polls. Count it once in the outer inventory and inspect nested operations separately. UI command-completion events are another representation of execution, not another set of model tool calls. Their output is **not** added to outer-result text again.

Usage is summed by unique response ID, not cumulative snapshots. Every selected session reconciles with its manifest. Cached input is already part of input; reasoning is part of output. Parent-plus-child usage is **62,461,415 input**, including **61,195,520 cached input**, and **212,723 output**, including **38,179 reasoning output**. The weighted cached-input ratio is **98.0%**. These are processing totals across successive requests, not simultaneous occupancy. [Official prompt-caching documentation](https://developers.openai.com/api/docs/guides/prompt-caching) explains reuse of shared input prefixes; caching does not remove that input from a request.

Transcript token estimates below use **readable body characters / 4**, not model-tokenizer counts. Across selected tool calls, **50 opaque spans** are excluded and **20 image blocks** are counted separately. No content was decrypted; image tokens were not inferred from base64 bytes. Private prompts, code bodies and reasoning are not copied into the new evidence files. Zero readable coordination text does not mean zero cost.

Command categories classify the **whole shell invocation**, with precedence: full check, focused/stage check, database lifecycle, browser/server, edit, Git mutation, inspection, other. PowerShell here-string bodies are removed first so writing “npm run check” into a ticket is not counted as running it. Mixed invocations stay in one category. These are lexical indicators, not exact partitions of subprocess work. Nested-tool counts are syntactic occurrences, not proof that every expression ran.

## Tool inventory: volume versus returned context

| Outer tool | Calls | Share | Est. argument tokens | Est. result tokens |
| --- | ---: | ---: | ---: | ---: |
| `functions.exec` | 375 | 73.1% | 145,680 | 774,459 |
| `mcp__cua_repl.js` | 95 | 18.5% | 5,355 | 135,680 |
| `collaboration.spawn_agent` | 12 | 2.3% | 124 | 103 |
| `collaboration.send_message` | 14 | 2.7% | 108 | 0* |
| `collaboration.followup_task` | 9 | 1.8% | 88 | 0* |
| `request_user_input_async` | 6 | 1.2% | 561 | 26 |
| `functions.wait` | 1 | 0.2% | 8 | 7,356 |
| `clock.sleep` | 1 | 0.2% | 5 | 11 |
| **Total, rounded after summing characters** | **513** | **100%** | **151,929** | **917,635** |

`*` Unreadable content includes opacity; this is not a zero-cost conclusion. Row rounding can differ slightly from totals.

Inside `exec`, readable source contains **418 `tools.exec_command(...)`**, **73 `tools.apply_patch(...)`**, and **23 `tools.write_stdin(...)`** expressions. Do not add those 514 expressions to the 513 outer calls. There are **414 actual command-completion events**, all with unique execution IDs; completion count and invocation-expression count measure different things.

| Existing outer-call purpose classification | Calls | Est. result tokens | Result text share |
| --- | ---: | ---: | ---: |
| Read/search/diff | 221 | 687,081 | 74.9% |
| Browser/web/media | 95 | 135,680 | 14.8% |
| Mixed batch | 69 | 45,269 | 4.9% |
| Focused check | 40 | 24,087 | 2.6% |
| Full check | 17 | 12,589 | 1.4% |
| Wait/status | 2 | 7,366 | 0.8% |
| Other/mixed | 30 | 5,377 | 0.6% |
| Delegation | 35 | 103 | <0.1% |
| Write/edit | 4 | 82 | <0.1% |

These purpose labels come from the existing ledger. Many writes/tests occur inside mixed batches; four “write/edit” calls does not mean four edits. The newer command classifier finds 18 full-check-containing events; the 17 outer calls labeled full check are not an interchangeable count.

## Ranking ticket sessions

| Parent | Responses | Cumulative input | Peak request input | First response >100k / >150k | Est. arguments | Est. results | Truncated results |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C03 | 93 | **14,476,212** | **222,334** | 17 / 38 | 32,350 | **122,831** | 8 |
| C06 | 76 | 9,696,082 | 170,792 | 20 / 47 | 19,058 | 96,997 | 7 |
| C07 | 59 | 7,504,136 | 175,137 | 15 / 35 | 22,513 | 106,867 | **15** |
| C08 | 72 | 8,343,853 | 160,583 | 22 / 62 | 20,786 | 91,414 | 13 |
| C09 | 63 | 7,637,748 | 172,434 | 18 / 47 | 26,927 | 97,924 | 5 |
| C10 | 65 | 8,653,399 | 183,379 | 16 / 33 | 22,661 | 105,361 | 7 |

C03 is the first session to inspect for model/context cost. C07 is especially useful for investigating truncation. C06 and C09 have the largest parent command-duration sums, affected by long-lived processes. Different ticket complexity and starting state prevent treating this as a controlled productivity ranking.

Across parents, estimated results total **621,394 tokens** versus **144,295 argument tokens**. Children add about **296,241 result / 7,634 argument tokens**. Children account for **19.1% of outer calls**, **9.8% of input**, and **32.3% of readable result text**. Independent review's benefit is not measured by these costs alone.

## Oversized reads, truncation, and browser setup

There are **60 flagged truncated tool results**: 55 in parents and 5 in reviewers. The ten largest returned bodies contain approximately **108,140 estimated tokens**, 11.8% of all result text. Truncation can omit callers or acceptance rules; reducing output helps only if the relevant evidence remains accessible.

Representative calls below use alias and **raw invocation line**; resolve the alias through the audit manifest:

| Source | Operation | Est. result tokens | Interpretation |
| --- | --- | ---: | --- |
| C08:332 | Initial `cua.createBrowserTab` | 11,999 | Computer Use documentation plus setup state. |
| C09:241 | Initial `cua.createBrowserTab` | 11,999 | Similar setup burden in another ticket. |
| C06:209 | `cua.createBrowserTab` after earlier browser entry | 11,972 | Later browser call also returned substantial documentation. |
| C07:270 | `cua.createBrowserTab` after earlier browser entry | 11,969 | Documentation burden is not limited to a first call. |
| C08:36 | Tracker, prerequisite ticket, glossary, architecture/API batch | 10,038 | Truncated from a larger result. |
| C07:35 | Similar contract/context batch | 10,036 | Truncated. |
| C09 reviewer `01a16c2e-6336…`:32 | Broad implementation diff | 10,036 | Truncated despite a larger inner output allowance. |
| C03:123 | Bug skill, service/entities and another command batch | 10,031 | Combined output was truncated. |

First browser calls across the six parents return approximately **54.8k estimated tokens** combined. Browser use also includes snapshots and 20 image blocks with unmeasured tokens. Initial documentation is returned by the tool; bypassing required instructions is not an optimization. Reuse initialized state within a ticket and keep acceptance focused. Reducing custom server restarts is a directly actionable repository improvement.

Repeated-read candidates include `reconciliation_db.py` (20 literal `Get-Content` target occurrences), seller `api.ts` (15), `SellerWorkspace.tsx` (14), `reconciliation.py` (13), and architecture/API contracts (12 each). These are syntactic occurrences across parents/reviewers, not proof of redundant unchanged reads. Source changes and independent reviews can justify repetition. Exact whole-result hash duplication contributes only **298 excess readable characters**; changing wrappers/metadata makes that an incomplete duplicate-content measure.

The repository already offers `npm run context -- <path> "<path>#L10-L40"`. [Its implementation](../scripts/context.mjs) enforces **24,000 bytes of output**, preserves source line references, and rejects selected excluded paths. This is a byte budget, not a model-context budget. Begin with its bounded inventory, follow actual callers/tests, and retrieve smaller ranges. Concatenating more files into fewer calls can reduce call count while increasing context pressure and truncation risk.

## Command duration and failure costs

The 414 completion events report **5,944.8 seconds / 99.1 minutes** of summed duration and **90 nonzero exits (21.7%)**. Median duration is **0.242 seconds**. Durations overlap and include process lifetimes; their sum is neither end-to-end ticket time nor CPU time. CSV starts are inferred as completion timestamp minus recorded duration, not independently instrumented start times.

| Whole-command lexical category | Events | Summed seconds | Median seconds | Maximum seconds | Nonzero exits |
| --- | ---: | ---: | ---: | ---: | ---: |
| Browser/server-containing | 35 | 2,930.5 | 0.256 | 470.0 | 15 |
| Database-lifecycle-containing | 23 | 2,382.1 | 0.710 | 696.3 | 4 |
| Full-check-containing | 18 | 291.9 | 16.345 | 29.8 | 6 |
| Focused/stage-check-containing | 88 | 286.8 | 2.819 | 8.8 | 40 |
| Inspection-containing | 210 | 42.8 | 0.177 | 0.8 | 22 |
| Git-mutation-containing | 16 | 5.6 | 0.159 | 2.7 | 0 |
| Other | 19 | 4.0 | 0.135 | 1.1 | 3 |
| Edit-containing | 5 | 1.1 | 0.246 | 0.3 | 0 |

An invocation can write a file then run tests; precedence classifies it under checks. An unsuccessful mixed command can have a diagnostic belonging to another category. Investigate source lines, not category labels alone.

| Parent | Command events | Summed seconds | Nonzero exits |
| --- | ---: | ---: | ---: |
| C03 | 85 | 925.9 | 19 |
| C06 | 47 | 1,279.7 | 13 |
| C07 | 43 | 898.3 | 13 |
| C08 | 55 | 1,032.2 | 13 |
| C09 | 53 | 1,275.2 | 13 |
| C10 | 40 | 515.9 | 6 |
| Review children combined | 91 | 17.6 | 13 |

Long events C09:490 **696.3s**, C06:518 **635.6s**, and C08:562 **555.1s** contain PostgreSQL startup. C07:452 **480.9s** and C09:489 **470.0s** contain acceptance-server setup. Failed browser/demo invocations include C06:446 **390.7s**, C03:562 **378.4s**, and C08:555 **304.5s**. A long successful server event does not prove startup took that long. Some long failed events have empty aggregated output, so completion records alone cannot identify their root causes.

The 210 inspection-category events together take only **42.8s**, with none exceeding **0.8s**. A blanket 1.5–2 seconds of pure PowerShell startup per command is unsuitable for this Codex sample. These records do not isolate total shell launch overhead either; benchmark it directly before changing shells.

### Failures worth separating

Flags search aggregated output of nonzero events. They can overlap; unflagged exits remain unclassified. This is not a complete causal breakdown of all 90 exits.

| Diagnostic | Events | Evidence / interpretation |
| --- | ---: | --- |
| PowerShell parser errors | 9 | C03:53, C06:44, C07:32, C09:28 and C10:28 include brace-list syntax. Bash-style `{file1,file2}` expansion is invalid here. |
| PostgreSQL restricted-token startup | 3 | C03:166, C08:194 and C10:130 report `pg_ctl` restricted-token failures. |
| Python encoding errors | 2 | C03 includes encoding failures; C03:264 reports `UnicodeDecodeError`. Use explicit UTF-8 for source files. |
| Missing path/file diagnostics | 6 | Includes guessed paths and a literal `*.tsx` search operand. Discover paths; use `rg -g '*.tsx'` against a directory. |
| Git index lock permission | 1 | C03:707 reports permission denied creating `.git/index.lock`; do not assume a stale lock and delete it. |
| Connection refused | 1 | C08:194 also reports a refused database connection after startup failed. |
| Test/assertion failure markers | 31 | Includes useful red tests and real regressions, not automatically environment waste. |
| Lint/type diagnostics | 16 | Includes normal implementation feedback and mixed-command results. |

A nonzero `rg` exit may mean no matches; semicolon-separated batches can hide an earlier failure behind a later success. Neither “21.7% environment failure” nor “zero exit means every operation passed” is justified.

## Optimization priorities and trade-offs

| Priority | Proposed experiment | Evidence | Trade-off / quality guard |
| --- | --- | --- | --- |
| 1 | Bounded source ranges and per-file diffs; contract sections by acceptance case | Reads return 74.9% of result text; 60 results truncate | Narrow retrieval can miss invariants. Expand when evidence points to it and preserve the acceptance checklist. |
| 2 | Reusable disposable PostgreSQL + acceptance-server fixture | Startup failures, ad hoc scripts, restarts and long lifetimes recur | Fixtures need maintenance. Isolate schema/data, check readiness, retain ownership/logs, guarantee cleanup; keep browser assertions independent of fixture internals. |
| 3 | Standardize PowerShell syntax and UTF-8 file handling | Nine parser and two encoding failures | Avoid a large command DSL. Prefer explicit file arrays, known paths, `python -X utf8`, and `encoding='utf-8'`. Keep real credentials out of fixtures. |
| 4 | Reviewer handoff with fixed base, changed paths, acceptance IDs and test evidence | Children return 296k estimated tokens | Retain independent inspection of omitted callers; do not substitute the implementer's summary for review. |
| 5 | Focused checks during edits; required full gate after fixes | 18 full-check-containing events take 291.9s; 6 exit nonzero | Full checks find cross-feature regressions. Keep final `npm run check`; rerun when changes/failures justify it. |
| 6 | Reuse initialized browser state and focus on meaningful UI flows | 135.7k text tokens plus unmeasured images | Documentation is tool-controlled. Preserve required setup and success/loading/failure checks; HTTP smoke is insufficient. |
| 7 | Benchmark shell launch/parallelism after these changes | Inspection commands are already fast; no Codex polling spinlock appears | Parallelize independent work only. Setup, mutations and dependent checks need ordering; contention can erase savings. |

Bounded context reads, root test wrappers, and [per-run check summaries/logs](agents/verification.md) already exist in this checkout. Verify their use before building another layer. Full check evidence remains at the reported `.cache/checks/<run>/` path. Historical chats do not establish improvements caused by current facilities; that requires a controlled before/after run.

Do not introduce automatic compaction solely from these measurements. Request size, retained evidence, quality and retrieval/restart costs must be assessed together; a smaller request is not itself a better implementation. Model/plugin/permission changes or removing review are also unsupported by the established evidence.

## Benchmark plan before changing the environment

Use [the existing evaluation template](../tasks/agent-evaluation-template.md). Run both variants from the same base commit and ticket in clean separate checkouts. Keep model/reasoning, dependencies, credentials availability, permissions and review requirements constant. Cache warmth/run order can bias results; alternate order or repeat comparable runs and record conditions. One easy ticket cannot establish general improvement.

Record separately:

1. **Quality:** independent acceptance review, regression findings/severity, concurrency/idempotency/privacy behavior, meaningful assertions, full-gate result, and actual browser outcomes. A cheaper run missing an invariant fails the comparison.
2. **Context/model work:** first/peak/last request input, unique-response totals, cache ratio, compactions, parent/child usage and missing content. Historical processing totals are separate from peak occupancy.
3. **Tool volume:** outer/nested counts, argument/result bytes, truncations, repeated-read candidates, browser setup versus interaction, and full versus focused checks.
4. **Elapsed work:** active task intervals, user waiting, tool intervals, readiness latency, server lifetime and cleanup. Measure readiness directly rather than equating it with server lifespan.
5. **Recovery:** parser/encoding/startup failures, timeout causes, retries and manual intervention. Separate expected red tests from infrastructure failures.

Suggested targets, **not measured savings**: zero parser/encoding retries, zero fixture startup failures, no retrieval truncation hiding relevant evidence, and lower result volume/peak requests without worse independent quality findings. Treat the prior 100k preferred / 150k acceptable request budget as an observation target, not permission to discard necessary evidence.

## Validation and limits

Revalidated 18 immutable source hashes, canonical call counts, unique-response usage/totals, and 414 unique command event IDs. Original ledgers remain intact. No application code, environment configuration, database or global Codex setting was changed.

Application `npm run check`, browser acceptance and live-provider verification were **not run for this documentation-only change**. This report does not re-certify ticket implementations or hosted readiness. Remaining gaps: opaque content, image tokens, incomplete failure attribution, absent hardware telemetry, missing/outside-workspace histories, and lack of a controlled environment comparison.
