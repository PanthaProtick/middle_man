# Repository session context and token investigation

Investigated on **24 October 2026 (Asia/Dhaka)**. Your preferred request/context budget is **100,000 tokens**, with **150,000 acceptable**. This is an investigation and a set of experiments for later optimization; no environment settings or development workflows were changed.

## Findings

Your observation is supported by the recorded usage. **All six Codex ticket chats exceeded 150k input tokens in a single request**, reaching 160,583–222,334. Opening a separate chat for each ticket did not keep that chat below your budget. Their first requests already contained 35,269–36,673 tokens, leaving roughly 64k of growth before the preferred limit.

The largest readable contributors were **tool results, followed by tool arguments and generated code**. Across these six parent ticket chats, readable tool-result bodies total approximately **621k tokens**, arguments approximately **144k**, and assistant prose approximately **7k**. These are historical totals across six chats, estimated from characters; they are not simultaneous occupancy. Agent replies need to be separated into prose, tool calls, and recorded reasoning before deciding what to reduce.

The strongest specific candidates are large batches of source/spec reads, browser setup documentation and snapshots, generated patches, and an Antigravity timer/status loop. Prompt caching was already high in Codex; it did not prevent large requests. The recorded 475k model window also does not express your personal 100k–150k preference.

## Scope and evidence

The snapshot excludes this investigation and its research child, using **2026-10-24 05:14:37.677 UTC / 11:14:37.677 Dhaka** as the cutoff. It covers local records associated with `E:\middle_man`, not every session on this computer.

| Source | Included development/design records | Coverage |
| --- | ---: | --- |
| Codex `sessions/` and `archived_sessions/` | 27 | 7 parents: phase-1 planning, Ticket 03 review/completion, Tickets 06–10; 14 children, including 12 ticket reviewers and 2 planning/research children; 6 guardian sessions |
| Antigravity CLI summary index and full transcripts | 15 | Tickets 01–05 and 10 review children |
| Previous Antigravity investigation | 1, separately labeled | Retained in supporting data, excluded from development totals |
| Additional Antigravity index entry | 1, unavailable | No full transcript; excluded from all usage totals |

Thus the development sample is **42 sessions, 1,655 outer tool calls, and 1,753 model response records**. Supporting data contains 44 indexed sessions, 1,705 calls and 1,804 responses when the previous investigation is included. Codex contributed 574 calls/658 responses; Antigravity development contributed 1,081 calls/1,095 responses. These counts measure different things: one response can issue multiple calls, and a programmatic wrapper can execute multiple operations.

Codex selection used exact normalized `session_meta.cwd == E:/middle_man`, rather than searching unrelated conversations for repository mentions. Across 106 JSONL metadata files scanned, metadata parsing failed zero times and selected full-file parsing failed zero times. The Antigravity CLI index selected 17 repository entries; 16 had full transcripts. The Antigravity desktop index had no matching workspace rows. Sessions started elsewhere that merely mention this repository, deleted logs, and undiscovered exports remain outside coverage.

The inspected Codex records identify `gpt-6.1-sol`, CLI version `0.163.0-alpha.11.2`, and a 475,000-token window. Antigravity transcripts do not establish an equivalent model/window contract. Different clients, tickets, models, and task phases make this an observational sample, not a controlled client comparison.

Supporting files:

- [Measurements and source manifest](session-analysis/measurements.json): full session IDs, source paths, SHA-256 hashes, roles, usage sums, first/last/peak measurements and threshold crossings.
- [Tool-call ledger](session-analysis/tool-calls.csv): one matched outer invocation/result pair per row, source/output line numbers, tool namespace, readable sizes, estimates, image counts and truncation flags. No raw prompts, code bodies or reasoning are copied into it.
- [Model-response ledger](session-analysis/model-responses.csv): per-response recorded usage and source line numbers, preserving provider-specific fields and unknown values.
- [Detailed accounting methodology](session-analysis-methodology.md): duplicate events, forks, opacity and telemetry semantics.

## What the token figures mean

| Measurement | Meaning | Confidence |
| --- | --- | --- |
| Codex per-response `usage.input_tokens` | Recorded input for one model request; includes cached input | Recorded telemetry |
| Codex `output_tokens` / `reasoning_output_tokens` | Total generated output / its reasoning subset | Recorded telemetry |
| Sum of unique response usage | Repeated processing throughout a session; earlier history is processed again | Recorded telemetry, reconciled |
| First/maximum/last request input | Observed request pressure, compared with your 100k/150k thresholds | Recorded telemetry; not an exact UI-indicator reconstruction |
| Readable tool/message token estimate | Readable body characters divided by four | Rough proxy, not a model tokenizer count |
| Antigravity `input_tokens`, `cache_read_tokens`, `output_tokens` | Raw exported counters; cache frequently exceeds the input field | Recorded fields; provider semantics unresolved |
| Antigravity input + cache | Conditional request-size proxy if input and cache are disjoint counters | Conditional; not interchangeable with Codex input |

For Codex, **cached input is part of input**, and **reasoning is part of output**. Neither gets added again. A high cache ratio describes reuse, not a smaller context window. Public API accounting supports those distinctions; it does not independently specify this desktop log format. [OpenAI usage accounting](https://developers.openai.com/api/docs/guides/agents-api/observability), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

For example, Codex Ticket 03 processed **14,476,212 cumulative input tokens**, but its largest individual input was **222,334**. Its 93 response records reconcile with the final cumulative ledger. Adding every cumulative snapshot would substantially overcount. Tool arguments are model output when generated, and can become input history afterward; they are not a separate additive category on top of recorded input/output.

Character estimates exclude image blocks and opaque `gAAAA...` strings. Twenty Codex image blocks are counted separately, and 53 opaque spans in call arguments/results remain unattributed. Encrypted reasoning bodies are also excluded. Base64 image size and ciphertext length are not token measurements. Exact per-tool token accounting would require the assembled model request or richer tracing; the available logs do not provide that mapping. [OpenAI token counting](https://developers.openai.com/api/docs/guides/token-counting).

The tool ledger rounds per-row estimates; summary tables divide summed characters by four before rounding, so small rounding differences are expected. Tool outputs include returned wrappers and metadata where present. Transcript totals cannot be added to request peaks to reconstruct live occupancy, especially after compaction or history trimming.

## Codex: request pressure per ticket

The aliases below identify parent sessions; full source filenames and hashes are in the manifest. Threshold positions are **model-response numbers within that parent**, not tool-call counts. A threshold means the first recorded input **above** the specified number.

| Alias / work | Parent session ID | Calls / responses | First input | Peak = last input | First >100k / >150k response |
| --- | --- | ---: | ---: | ---: | ---: |
| C03: Ticket 03 review and completion | `01a169ca-7337-7651-a90d-d67def5a7be5` | 90 / 93 | 36,673 | **222,334** | 17 / 38 |
| C06: SMS import | `01a16a34-7b8b-79e0-9935-3f91a3454073` | 73 / 76 | 35,289 | **170,792** | 20 / 47 |
| C07: Evidence conflicts | `01a16a47-4d75-7fb1-9bc6-ec87806e63ff` | 58 / 59 | 35,288 | **175,137** | 15 / 35 |
| C08: Pending-buyer corrections | `01a16a55-a6d2-72c0-bb9e-06c0df7fac26` | 71 / 72 | 35,295 | **160,583** | 22 / 62 |
| C09: Unallocated receipt corrections | `01a16c25-897a-7361-b40b-2de37670fedc` | 60 / 63 | 35,269 | **172,434** | 18 / 47 |
| C10: Manual payment exceptions | `01a16c38-c9a2-7a00-a516-d535ea93fd23` | 63 / 65 | 36,002 | **183,379** | 16 / 33 |

All six crossed 100k by response 15–22. Their peaks exceeded your acceptable 150k by approximately **11k–72k**. This happened before reaching the recorded model capacity, so capacity alone is an unsuitable budget guardrail.

The separate phase-1 planning parent (`01a16927-275e-7f30-97d3-06d15974aef3`) had 53 calls/73 responses, started at 35,979, peaked at 139,934 and ended at 81,778. It contains one `compacted` record. The six ticket parents contain none. This shows that a lower end value can reflect a changed retained context; it does not erase earlier processing or prove a particular automatic threshold.

### Assistant output and readable contributors

The following estimates are historical body totals for each parent chat. Recorded output is exact telemetry; the remaining columns use characters/4. Recorded reasoning is already included in recorded output. Agent reports are messages received from children, separate from the parent's own prose.

| Parent | Recorded output | Included reasoning | Est. tool arguments | Est. tool results | Est. assistant prose | Est. child reports |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| C03 | 53,285 | 16,421 | 32,350 | 122,831 | 2,006 | 1,135 |
| C06 | 26,090 | 4,007 | 19,058 | 96,997 | 1,428 | 867 |
| C07 | 28,005 | 3,555 | 22,513 | 106,867 | 800 | 929 |
| C08 | 26,598 | 2,878 | 20,786 | 91,414 | 1,080 | 478 |
| C09 | 33,992 | 4,502 | 26,927 | 97,924 | 822 | 925 |
| C10 | 28,815 | 4,265 | 22,661 | 105,361 | 825 | 969 |

Across the six: **144,295 estimated argument tokens**, **621,394 result tokens**, **6,961 prose tokens**, **5,303 incoming report tokens**, and **35,628 recorded reasoning output tokens**. Estimator error and missing content mean these columns are not an exact partition of model output or retained history. The evidence nevertheless makes cutting ordinary progress prose a lower-priority experiment than reducing result volume and oversized edits.

### Complete Codex outer-tool inventory

These totals include planning and children/guardians. Nested shell commands or patches executed inside `exec` are not counted again.

| Outer tool | Calls | Est. readable argument tokens | Est. readable result tokens |
| --- | ---: | ---: | ---: |
| `exec` | 430 | 186,399 | 898,860 |
| `mcp__cua_repl.js` | 95 | 5,355 | 135,680 |
| `collaboration.spawn_agent` | 14 | 157* | 123 |
| `collaboration.send_message` | 15 | 116* | 0* |
| `collaboration.followup_task` | 9 | 88* | 0* |
| `collaboration.list_agents` | 2 | 1 | 1,654 |
| `request_user_input_async` | 7 | 638 | 30 |
| `wait` | 1 | 8 | 7,356 |
| `clock.sleep` | 1 | 5 | 11 |

`*` Opaque spans heavily limit delegation attribution. Zero readable result characters does not mean zero model cost or zero communication. Incoming child reports are measured separately. Browser results exclude the 20 image blocks.

## The most taxing identifiable instances

Source references below are JSONL **1-based physical line numbers** under the session alias's manifest path. Arguments/results also have their own line references in the CSV ledger. Sizes are readable result-body estimates, not exact API tokens.

| Instance | Evidence | Est. result tokens | Why it matters |
| --- | --- | ---: | --- |
| C08 browser initialization | `C08:L332`, `mcp__cua_repl.js`, `createBrowserTab` | 11,999 | Initial browser documentation/state consumes a substantial portion of the remaining 100k budget |
| C09 browser initialization | `C09:L241`, same API | 11,999 | Similar documentation cost in a fresh ticket chat |
| C06 browser initialization | `C06:L209`, same API | 11,972 | Repeated across sessions even though each ticket starts fresh |
| C07 browser initialization | `C07:L270`, same API | 11,969 | Necessary browser setup can have a large text payload independently of screenshots |
| C03 source/test batch | `C03:L123`, `exec` | 10,031 | Reads bug-diagnosis guidance, services, models, idempotency and route tests in one returned batch |
| C03 contracts/source batch | `C03:L133`, `exec` | 10,030 | Returns contracts, acceptance cases, source/tests and environment guidance together |
| C08 contracts/discovery batch | `C08:L36`, `exec` | 10,038 | Loads tracker guidance, prior ticket, architecture/API docs, domain/API contract and acceptance material |
| C07 contracts/discovery batch | `C07:L35`, `exec` | 10,036 | Similar broad preload before implementation |
| C09 contracts/source batch | `C09:L52`, `exec` | 10,026 | Domain/API contracts plus receipt/reconciliation implementation |

For C10, the initial browser response (`L203`) is approximately 8,455 estimated text tokens; C03's `getState` response (`L317`) is approximately 7,715. These are observed responses, not a claim that every browser tool invocation repeats its complete documentation.

The full Codex sample contains **61 result bodies with truncation markers**, 55 in ticket parents. This is a heuristic flag that can describe an inner result; it is not a measurement of lost tokens. Several large returns sit near 40k characters and contain multiple file reads. Lowering a blanket output cap without narrowing the read can increase follow-up calls. The useful target is the amount of relevant material returned, not merely fewer tool invocations.

Generated code also matters: C08's `exec` at `L167` contains approximately 2,380 estimated argument tokens, and C03's mixed patch/command batch at `L260` approximately 2,548. These are necessary work products in many cases. Large new test fixtures, rewritten files and embedded browser/setup scripts should be distinguished from avoidable explanatory prose before optimizing.

## Antigravity: earlier tickets

Antigravity's exported cache field often exceeds its input field, so the OpenAI subset formula cannot be applied to this export. The peak below is **conditional input + cache**, presented to make the uncertainty visible. First input has zero cache in these parent starts. The data does not justify interpreting the small late raw input values as small complete contexts.

| Ticket / parent | Calls / responses | First input | Peak input + cache, conditional | Recorded output |
| --- | ---: | ---: | ---: | ---: |
| 01 / `57f3c876-ecfa-4bf0-af6e-05ac95b70b02` | 147 / 148 | 11,052 | 154,655 | 69,246 |
| 02 / `35c8a50e-1b96-47cc-b581-79d08089523f` | 120 / 114 | 12,166 | 160,227 | 81,833 |
| 03 / `01455f39-7ef7-4ed9-9e3b-2a1105ed2d0d` | 182 / 182 | 12,162 | 193,042 | 82,559 |
| 04 / `229eac0d-47fe-4eb6-b38e-f8fb54a6fb40` | 176 / 179 | 12,158 | 196,394 | 91,914 |
| 05 / `e88d99f6-e21d-4bea-bd46-53fc81ea2459` | 214 / 220 | 12,163 | 237,248 | 100,214 |

These five parents contain 839 calls; their review children add 242. Across the 15 development transcripts, the raw input field sums to 4,410,577, the raw cache-read field to 104,026,562, and recorded output to 549,022. No unified provider total or reasoning-token count is reported. The files retain approximately 56,206 estimated tokens of readable thinking text and 9,106 of prose; thinking text size is not an authoritative reasoning-token counter.

### Tool inventory and repeated reading

| Tool | Development calls | Est. readable argument tokens | Est. readable result tokens |
| --- | ---: | ---: | ---: |
| `run_command` | 319 | 14,706 | 142,465 |
| `read_file` | 259 | 6,461 | 216,749 |
| `view_file` | 162 | 7,622 | 229,653 |
| `edit_file` | 162 | 60,396 | 7,705 |
| `write_file` | 103 | 163,664 | 2,462 |
| `manage_subagents` | 27 | 122 | 5,238 |
| `schedule` | 22 | 334 | 3,370 |
| `invoke_subagent` | 10 | 3,663 | 1,300 |
| `send_message` | 10 | 11,422 | 332 |
| `manage_task` | 7 | 106 | 774 |

The 421 `read_file`/`view_file` calls returned approximately **446,403 estimated tokens**. Among them:

| Read target | Calls across sample | Est. returned tokens | Maximum reads in one session |
| --- | ---: | ---: | ---: |
| `domain-contract.md` | 12 | 32,878 | 2 |
| `api-contract.md` | 11 | 35,323 | 2 |
| `acceptance.md` | 9 | 28,348 | 1 |
| `backend/app/services/order_service.py` | 26 | 22,898 | 14 |
| `frontend/src/features/seller/SellerWorkspace.tsx` | 16 | 16,187 | 5 |

Cross-session reads are not automatically waste: independent reviewers need evidence, and later tickets start fresh. The 14 reads of `order_service.py` in one session deserve inspection against intervening edits and bounded ranges. This report does not assume they were all unchanged or unnecessary. The three specification/acceptance files together account for approximately **96,549 estimated returned tokens across sessions**.

### Ticket 03 timer/status loop

The full transcript records **22 `schedule` calls and 23 `manage_subagents` calls** in the parent, at transcript lines 266–376. They account for 45 of 182 tool calls, or approximately **24.7%**. Their readable arguments/results add approximately **8,259 estimated tokens**.

The 45 planner responses issuing these calls have 112,886 raw input-field tokens, 7,779,070 cache-read-field tokens and 1,297 output tokens in aggregate. Those figures describe repeated processing at already-large contexts, not 7.8 million new context tokens caused by polling. This is a clear investigation target, but a counterfactual saving requires an experiment with a supported wait/event mechanism. Simply ending the parent turn is not a verified cross-client completion strategy.

## Delegation, startup context and verification

Codex children consumed 6,627,049 input / 17,627 output tokens; guardians consumed 1,109,115 input / 3,986 output. They are separate model work, not that many tokens inserted into the parent. Across ticket parents, readable incoming child reports total only about 5,303 estimated tokens. Replacing every review with inline review might lower parallel processing while increasing parent context or weakening independent scrutiny. Measure parent pressure and task-wide processing separately.

The first Codex ticket requests use about **35%–37% of your preferred budget** before the first returned tool result. That starting input includes the task, instructions, available tools and other assembled context. The local `additional_tools` record is about 133k serialized characters, but it does not establish that every declaration was rendered into the first request. Likewise, developer messages recorded again on later turns are historical records, not proof that all copies remained simultaneously. Exact allocation among instructions, skills, tools and memory remains unresolved.

The current root Codex configuration explicitly sets `model=gpt-6.1-sol` and reasoning effort `high`; it has no top-level override for `model_auto_compact_token_limit`, `model_context_window` or `tool_output_token_limit`. This read is a current root-file observation, not proof of historical effective settings or the absence of profile/runtime overrides. No credential or environment files were read for this investigation.

The existing repository wrappers already separate focused tests from full checks and save detailed logs under `.cache/checks/`. In the Antigravity development transcripts, 38 `run_command` calls contain `npm run check`. Their returned bodies total approximately 14,705 estimated tokens, substantially below source reads. This does not establish that those checks were unnecessary: failures and post-review edits may require reruns. Elapsed shell time was not benchmarked here, so shell-spawn latency and minute-saving claims are outside this report's evidence.

## Changes worth testing later

Priorities follow observed size and specificity. These are experiments, not implemented changes or guaranteed savings.

| Priority | Experiment | Evidence/target | Trade-off and acceptance check |
| --- | --- | --- | --- |
| 1 | Set a deliberate context policy: aim below 100k; begin a compact/handoff decision around 80k–90k; investigate every >150k request | All six Codex ticket peaks exceed 150k | Compaction can lose details and trigger rereads. Preserve ticket decisions, changed paths and exact verification evidence; compare acceptance results |
| 1 | Return bounded excerpts selected by search/callers instead of broad multi-document preloads | Repeated ~10k result batches; 100k crossed by responses 15–22 | Excessive narrowing can miss invariants. Keep relevant contracts and failure paths, with larger reads when justified |
| 1 | Inspect browser setup output and use the smallest supported DOM/snapshot scope | Setup responses of ~8k–12k estimated text tokens | Preserve actual browser acceptance. Do not replace browser tests with HTTP smoke or strip documentation required to operate the tool |
| 2 | Replace the Antigravity timer/status loop using a supported wait/event facility | 45 coordination calls in one ticket | Confirm the chosen client actually resumes/returns completion; avoid a policy that silently abandons active work |
| 2 | Avoid unnecessary whole-file rewrites and duplicated fixture payloads | Large `write_file`/patch arguments | Prefer cohesive fixtures and small patches, while preserving test clarity and assertions; code generation remains legitimate output |
| 2 | Audit the initial instruction/tool/skill catalog composition | Starting input ~35k–37k for Codex tickets | Disable only demonstrably unused capabilities. Deferred tools may already limit rendering; do not infer savings from catalog bytes alone |
| 3 | Keep review scope and returned findings concise | Child work and parent report sizes differ substantially | Preserve independent spec/standards evidence; distinguish reviewer processing savings from parent-context savings |
| 3 | Continue focused checks during iteration, full root gate at completion and after material fixes | Verification output smaller than read output | Fewer checks is not automatically better. Keep required coverage and disclose unrun gates |

Current official configuration documents `model_auto_compact_token_limit` as the history-compaction threshold and `tool_output_token_limit` as the history budget for individual tool results. A later experiment could evaluate a **90k compaction trigger** and **roughly 2k–3k tool-result budgets**, with bounded reads first. These are starting hypotheses, not hard 100k guarantees: one batch can cross a threshold, settings may have client-specific application, and over-truncation can force rereads. Changing the declared model capacity to pretend it is 100k is unnecessary when a separate compaction setting exists. [Official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

For the next comparable tickets, capture first input, peak input, first >100k/>150k response, result-volume distribution, truncation/retrieval follow-ups, tool argument volume, model output/reasoning, child work and verification outcomes. Change one major variable at a time. A reasonable success criterion is **peak normally below 100k, no unexplained >150k request, and unchanged acceptance/verification rigor**. Do not use cache-hit percentage or total processed tokens as a substitute for this context objective.

## Relationship to the existing report

[The pre-existing tool-call report](tool-call-analysis-and-environment-optimization.md) was untracked when this investigation began and has been preserved. Its narrow earlier snapshot is not the same sample as this report. Its headline 109.8M tokens describes aggregated processing fields, not simultaneous context size. The earlier analysis transcript now contains 50 calls rather than the document's 28, so a live historical log and a previously written summary can diverge.

This investigation independently confirms substantial reading and the Ticket 03 coordination loop. It does **not** establish that differing `read_file`/`view_file` names caused cache failure, that shell startup accounts for a particular percentage of latency, or that the proposed changes save 30%–45% overall. Those claims require provider/cache tracing, controlled timing or before/after experiments. Reducing tool schemas is also a separate question from consolidating names used in independent client sessions.

## Validation and reproduction boundaries

Canonical Codex usage was selected from top-level `token_usage_record.payload.usage`, deduplicated by response ID within a session and filtered by owning thread. An independent audit found **658 unique response IDs globally**, no foreign-thread usage and no pre-session copied usage records in this sample. All 27 session sums reconcile with their final thread cumulative ledgers; each Codex response total equals input plus output. Event/UI copies of messages and cumulative `token_count` snapshots were excluded from sums.

Antigravity selection used the summary index's repository workspace association and parent IDs. Only `.system_generated/logs/transcript_full.jsonl` was counted; shortened transcripts, chunk copies, message copies and database steps were not added again. Tool calls/results were paired in order; an audit found no unmatched result or unfinished call queue before another planner response. Missing total/reasoning fields remain null, not zero.

For reproduction, use the manifest paths and verify source SHA-256 hashes first. Parse each selected canonical stream once; keep the ownership and cutoff rules above; join Codex results by `call_id` and Antigravity results by ordered tool queue; count readable body characters after excluding opaque spans and media; then recompute per-response sums, maxima and first threshold crossings. The retained ledgers provide every included response/call's source position without requiring another full transcript dump into an agent context.

Validation performed for this report: source parsing, call/result pairing, provider-aware accounting, global response-ID uniqueness, cumulative-ledger reconciliation, threshold recomputation, media/ciphertext exclusions, and artifact/reference checks. **Root `npm run check` was not run: delivered changes are documentation and measurement data; application code, configuration and executable repository tooling were not changed.** No browser/provider/deployment acceptance is claimed by this investigation. The one-off analyzer used during investigation remains in ignored `.cache/session-analysis/`, outside the delivered repository tooling.
