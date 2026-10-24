# Session token measurement: methodology and limitations

Investigated on 2026-10-24 (Asia/Dhaka). This note supports the repository session investigation. It distinguishes measured model usage, request size, and transcript attribution so that optimization work targets the right quantity.

## Three different quantities

| Quantity | Useful measurement | What it answers |
| --- | --- | --- |
| Repeated model processing | Sum of unique per-response input/output usage | How much model work did the task consume across calls? |
| Request/context pressure | First, last, and maximum per-response input tokens; compare with the recorded model window | How large were the measured requests? |
| Transcript contributors | Unique tool arguments, tool outputs, assistant messages, instructions, and tool definitions, measured separately where readable | Which material appears to make requests grow? |

A large sum of input tokens does not imply that all of those tokens occupied the context simultaneously. The same history can be processed in many successive requests. Cached input remains input; caching does not establish a smaller request. Tool definitions themselves also occupy context. [OpenAI token counting](https://developers.openai.com/api/docs/guides/token-counting), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

The last recorded input count is a request-size observation, not an exact reconstruction of the current composer indicator: outputs and tool results can arrive afterward; request assembly and compaction can also change the next request. Report maximum observed input separately from lifetime usage.

## OpenAI token categories must not be added twice

The public API defines cached tokens as a subset of input tokens and reasoning tokens as a subset of output tokens. Input includes instructions, definitions, history and tool results; output includes generated text, tool arguments and reasoning. Thus `input + output` gives the reported total; adding cached or reasoning tokens again inflates it. [OpenAI usage documentation](https://developers.openai.com/api/docs/guides/agents-api/observability).

The local logs inspected use flat names (`cached_input_tokens`, `reasoning_output_tokens`), whereas the API documentation shows nested detail objects. That mapping is supported by the local arithmetic below; the API page does not define the desktop JSONL schema.

These OpenAI definitions must not be applied automatically to Antigravity telemetry. In the inspected Antigravity CLI transcript `57f3c876-ecfa-4bf0-af6e-05ac95b70b02`, step 18 reports `input_tokens=2,442` and `cache_read_tokens=16,839`; step 31 reports 2,659 and 31,901 respectively. Cache therefore cannot be a subset of the recorded input field in that format. Preserve the two original fields separately. Their sum can be reported as a **conditional input-plus-cache proxy** if the input field excludes cache reads; that provider accounting interpretation was not verified from an owning schema. Planner records do not name the model in the inspected sample, and a scoped installed-extension source search did not establish the accounting semantics. Missing total or reasoning fields mean **not reported**, not zero.

`output_tokens - reasoning_output_tokens` is **non-reasoning output**, not necessarily visible prose. Formatting and tool-call structure can consume output tokens that do not appear in message content, even when recorded reasoning is zero. Visible text cannot account exactly for the full output ledger. [OpenAI output token accounting](https://developers.openai.com/api/docs/guides/token-counting#understand-output-token-counts).

## Local schema evidence

Read-only inspection of this completed repository session provides a concrete reference:

`C:/Users/Administrator/.codex/sessions/2026/10/23/rollout-2026-10-23T23-23-57-01a169ca-7337-7651-a90d-d67def5a7be5.jsonl`

Session metadata records `cwd=E:\middle_man`, `cli_version=0.163.0-alpha.11.2`, and `history_mode=paginated`. These observations establish this file's behavior, not a permanent contract for every Codex version.

| Record | Observed meaning and handling |
| --- | --- |
| Top-level `token_usage_record.payload.usage` | Usage for the identified response; 93 records with 93 distinct response IDs in this sample. Prefer these when available. |
| `turn_token_usage` | Running usage within the turn; do not sum successive snapshots. |
| `thread_token_usage` | Running thread usage; do not sum successive snapshots. |
| `event_msg` / `token_count` / `info.last_token_usage` | Matched the preceding response usage in inspected observations. It can be repeated without a new response. |
| `event_msg` / `token_count` / `info.total_token_usage` | Matched the latest thread cumulative usage throughout this sample; use as a reconciliation check. |
| `event_msg` / `task_started.model_context_window` | Numeric capacity: 475,000 in all three sample turns. |
| `session_meta.context_window` | An object containing `window_id`; it was not a numeric capacity. |

For the first three responses, per-response totals were 36,922, 41,675 and 44,803; cumulative totals were 36,922, 78,597 and 123,400. Summing the latter would count earlier responses repeatedly. The file contains 94 non-null token-count snapshots despite 93 usage records; a snapshot count alone therefore cannot establish model-call count.

The sample's sum of per-response input is **14,476,212**; its maximum single input is **222,334**. Those are compatible measurements of different quantities. Output sums to 53,285, including 16,421 recorded reasoning tokens; the final cumulative total is 14,529,497. The final ledger reconciles with the per-response sum.

| Sample turn, in file order | Calls with usage | First input | Last/max input | Recorded capacity |
| --- | ---: | ---: | ---: | ---: |
| 1 | 13 | 36,673 | 78,089 | 475,000 |
| 2 | 75 | 78,885 | 217,842 | 475,000 |
| 3 | 5 | 218,509 | 222,334 | 475,000 |

The first request already contains multiple categories of context. Its input count is a useful starting observation, but it cannot be attributed entirely to an environment baseline or entirely to the ticket prompt without the assembled request.

## Duplicate representations and tool counts

All 16 assistant `response_item` message IDs in the sample also appear as `event_msg.item_completed` items of type `AgentMessage`. Count one canonical representation when measuring assistant content. Older event names, including `event_msg.agent_message`, should be inspected before assuming either uniqueness or duplication.

Keep these counts separate:

- Model responses with usage.
- Outer tool invocation records, identified by tool name and `call_id` where available.
- Nested operations executed inside a programmatic tool wrapper.
- Tool result records, linked to invocation IDs.
- Assistant prose messages, separated by available phase/channel metadata.

One wrapper invocation can run several shell commands or connector calls. Its result may already include their output. Do not add a UI command-completion event's output to the wrapper's returned copy without verifying that both reached the model independently. Equally, identical command text at two different call IDs may represent a real retry and should not be deduplicated by text alone.

## Opaque content and incomplete attribution

Repository session inspection found text fields containing opaque `gAAAA...` strings at rest. Treat these as unreadable content, not as model text. Their lengths and local tokenization do **not** establish the lengths or tokens of the original prompts, arguments or responses. Preserve a separate count of unreadable records and report missing attribution explicitly.

Opaque `encrypted_content` on reasoning or compaction items also cannot be treated as visible text. Compaction can replace earlier context with an opaque state representation and can retain some older items. Summing the entire historical JSONL after compaction would not reconstruct the effective next context. [OpenAI compaction documentation](https://developers.openai.com/api/docs/guides/compaction).

For readable text, local tokenizer counts are estimates of that text only. Message framing, schemas and non-text input can make the actual request count differ. Exact API input counting requires the actual assembled request, including its tools. This investigation should not upload private session histories merely to obtain those counts. [OpenAI token counting](https://developers.openai.com/api/docs/guides/token-counting).

## Forks, subagents, and cross-session totals

A fork inherits the original chat history. Therefore a new chat identifier does not prove an empty context or fresh instruction baseline. This is explicitly documented for Codex Remote; exact local rollout persistence must still be checked against the files. [OpenAI Codex Remote guidance](https://developers.openai.com/blog/mastering-codex-remote-for-engineering).

When combining files, distinguish copied historical records from newly generated responses. Detect repeated response IDs across files and preserve provenance before calculating global totals. Do not assume a child starts from zero cumulative usage; reconcile its own per-response records with its final cumulative ledger and report inherited offsets or disagreements.

Measure delegated work separately from the root chat, then combine unique newly generated responses for task-wide processing. A child may consume substantial model tokens while only its summary is returned to the parent; those are different context effects. Usage for subordinate turns is an explicit part of the official accounting model, although its API schema does not establish desktop logging details. [OpenAI usage documentation](https://developers.openai.com/api/docs/guides/agents-api/observability#inspect-subagent-token-usage).

## Recommended evidence contract for the main report

1. State included roots, file count, repository selection rule, date range, active-session exclusion and parse failures. Include archives if inspected; do not imply Antigravity or other clients are covered unless their own records were measured.
2. Prefer unique per-response usage when available. Reconcile it with final cumulative usage. If only snapshots exist, use audited changes to cumulative totals; account for resets, inherited offsets and corrections. Do not sum every `last_token_usage` blindly.
3. Report first/last/max input, total processed input, cached input, output and reasoning separately. Flag missing model capacity instead of substituting a presumed default.
4. Attribute readable tool/message content with its counting method and an unreadable/unknown share. Do not present a precise per-tool token breakdown when ciphertext prevents it.
5. Keep model calls, tool calls, nested operations and duplicate event copies distinct. Preserve evidence IDs and file positions without publishing private prompts or raw reasoning.
6. Rank optimization candidates by measured contribution and repetition, but label causal explanations as hypotheses. A large request-size jump may combine new definitions, messages, tool outputs, retained reasoning or request-assembly changes.

No environment settings, session histories, credentials or existing optimization documents were changed for this methodology note. This is documentation-only work; no code or tooling change was made and root `npm run check` was not required for this note.
