# Antigravity Context and Telemetry Validation

Investigated on **24 October 2026 (Asia/Dhaka)**. This document resolves the remaining Antigravity-specific uncertainties identified in [session-context-investigation.md](session-context-investigation.md) and [session-analysis-methodology.md](session-analysis-methodology.md), based strictly on installed binaries, official documentation, and local session transcripts.

Your target context budget is **100,000 tokens per ticket**, with **150,000 tokens acceptable**.

---

## 1. Executive Summary & Verification Matrix

| Area | Uncertainty from Prior Report | Verified Fact | Confidence | Key Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Token Accounting** | Whether `input + cache` is an inflated proxy or real request size; what exported fields mean | `input_tokens` is strictly **uncached** prompt tokens; `cache_read_tokens` is **cached** prefix tokens. They are disjoint. `input + cache` **equals exact request prompt size**. | **High (Verified)** | `agy.exe` Go protobuf `ModelUsageStats` (pos 70231984); Gemini API `UsageMetadata` schema; Ticket 03 progression. |
| **Reasoning & Tool Counting** | How reasoning and tool content are counted in exported fields | `output_tokens` combines `response_output_tokens` (assistant text + tool calls/arguments) and `thinking_output_tokens`. Tool results enter as `input_tokens` on turn 1, then become `cache_read_tokens`. Reasoning is not fed back into subsequent prompt cache. | **High (Verified)** | `agy.exe` proto fields; Ticket 03 steps 27 vs 79–81; step 39 output text logs. |
| **Subagent Coordination** | Whether Antigravity requires polling or resumes parents automatically; why Ticket 03 had 45 wait calls | Antigravity features **native reactive wakeup**. Subagents automatically deliver results via high-priority messages and resume the parent. Ticket 03's 45 polling calls were **agent-introduced error**, violating platform instructions. | **High (Verified)** | Ticket 03 transcript lines 263, 342, 375; Antigravity platform instructions under `<messaging>` & `<subagents>`. |
| **Tool Schemas & Browser Docs** | Whether Antigravity repeats tool schemas or browser docs across turns | Antigravity uses **progressive disclosure** (skills load on demand; MCP tools support lazy schemas). Prompt caching reuses tool definitions across turns. Browser documentation overhead (~12k) occurred **exclusively in Codex**, not Antigravity. | **High (Verified)** | `agy.exe` changelog (pos 70001803); `tool-calls.csv` (0 browser calls in Antigravity); MCP architecture. |
| **Context Controls & Compaction** | Whether Codex settings (`model_auto_compact_token_limit`, `tool_output_token_limit`) work in Antigravity | Those settings **do not exist** in Antigravity (`agy.exe`). Antigravity provides `/compact` (manual) and background `windowMemory` compaction. Tool output is automatically truncated at ~10–14 KB to disk files. | **High (Verified)** | `agy.exe` string analysis; `read_file` parameter schema; step output capture files. |

---

## 2. Token Accounting Verification

### 2.1 The Meaning of Exported Fields

In `transcript_full.jsonl`, Antigravity logs three counters on every `PLANNER_RESPONSE` step: `input_tokens`, `cache_read_tokens`, and `output_tokens`.

Inspection of the installed binary (`C:\Users\Administrator\AppData\Local\agy\bin\agy.exe`, offset 70231984) reveals the underlying schema (`exa.codeium_common_pb.ModelUsageStats`):

```protobuf
message ModelUsageStats {
  Model model = 1;
  int64 input_tokens = 2;            // json: inputTokens
  int64 output_tokens = 3;           // json: outputTokens
  int64 thinking_output_tokens = 4;  // json: thinkingOutputTokens
  int64 response_output_tokens = 5;  // json: responseOutputTokens
  int64 cache_write_tokens = 6;      // json: cacheWriteTokens
  int64 cache_read_tokens = 7;       // json: cacheReadTokens
  APIProvider api_provider = 8;
  string message_id = 9;
}
```

In Google Gemini API (`UsageMetadata` in `gemini-api-reference/generate-content.md#usagemetadata`):
- `promptTokenCount`: Total tokens in the prompt (including cached content).
- `cachedContentTokenCount`: Number of tokens in the cached part of the prompt.
- `candidatesTokenCount`: Total tokens across generated response candidates (including thoughts/reasoning).
- `thoughtsTokenCount`: Tokens consumed by reasoning/thinking models.

In Antigravity's JSONL export:
- `cache_read_tokens`: Number of prompt tokens served from the prompt cache (`cachedContentTokenCount`).
- `input_tokens`: The **uncached** delta processed on that call (`promptTokenCount - cachedContentTokenCount`).
- `output_tokens`: Total output generated on that call (`response_output_tokens + thinking_output_tokens`).

### 2.2 Proof that `input + cache` Measures Exact Request Size

In OpenAI Codex telemetry, cached input is reported as a nested subset of input. In Antigravity, **input and cache are disjoint partitions**.

Empirical proof from Ticket 03 (`01455f39-7ef7-4ed9-9e3b-2a1105ed2d0d`):
- **Step 1 (Line 2)**: `input_tokens=12,162`, `cache_read_tokens=0`, `output_tokens=543`. Total prompt = **12,162**.
- **Step 6 (Line 13)**: `input_tokens=17,692`, `cache_read_tokens=0`, `output_tokens=64`. Total prompt = **17,692**.
- **Step 7 (Line 15)**: Prompt caching activates. `input_tokens=2,318`, `cache_read_tokens=15,651`. Sum = **17,969** (reconciles with step 6's 17,692 + 64 output + tool response).
- **Step 13 (Line 27)**: `input_tokens=2,627`, `cache_read_tokens=28,090`. Sum = **30,717**.
- **Step 14 (Line 29)**: `input_tokens=2,514`, `cache_read_tokens=30,723`. Sum = **33,237**. Notice `cache_read_tokens` at step 14 matches the total request size from step 13!

**Correction to Existing Report**: [session-context-investigation.md](session-context-investigation.md#L23) and [session-analysis-methodology.md](session-analysis-methodology.md#L23) treated `input + cache` as an unverified "conditional proxy". It is now confirmed that `input_tokens + cache_read_tokens` is the **exact total request prompt size** sent to the model.

### 2.3 How Reasoning and Tool Content are Counted

1. **Tool Arguments & Text Output**: Counted in `output_tokens` (under `response_output_tokens`). For example, in Ticket 03 step 40 (lines 79–81), the model wrote a 9,150-character file with zero thinking; `output_tokens` was recorded as 2,981 and 2,921 respectively.
2. **Reasoning / Thinking Tokens**: Also counted in `output_tokens` (under `thinking_output_tokens`). In Ticket 03 step 13 (line 27), the model generated 2,399 characters of thinking and an 80-character tool call; `output_tokens` was 1,426.
3. **Reasoning Persistence**: Model thinking blocks are **not** re-injected into the prompt on subsequent turns. They do not inflate `cache_read_tokens` or `input_tokens` on later turns.
4. **Tool Results**: Injected into the conversation as environment input. On their first turn, they appear in `input_tokens`. On all subsequent turns, they become part of the cached prefix in `cache_read_tokens`.

---

## 3. Subagent Lifecycle & Coordination Verification

### 3.1 Ticket 03 Session `01455f39-7ef7-4ed9-9e3b-2a1105ed2d0d` Analysis

The investigation examined lines 260–385 of Ticket 03 to determine why 45 polling calls occurred:

1. **Step 132 (Line 263)**: The parent agent launched two subagents concurrently using `invoke_subagent`:
   - Subagent A: `98dff25e-7a26-4d2d-b18d-851b174db301` (Standards Reviewer)
   - Subagent B: `7e287a63-8d8b-4a3e-9d03-2c2fe2ce992f` (Spec Reviewer)
2. **Steps 133–177 (Lines 266–374)**: Instead of yielding execution, the parent entered a tight loop:
   - Called `schedule` with a 5–10 second one-shot timer.
   - Called `manage_subagents` with `Action="list"`.
   - Each timer triggered a `<SYSTEM_MESSAGE>` with `priority=MESSAGE_PRIORITY_HIGH` (e.g. lines 286, 289, 294, 297, 300, 301).
   - This high-priority timer message woke the parent up, causing it to call `manage_subagents` and schedule another timer.
3. **Step 161 (Line 342)**: Subagent A completed. The system automatically injected:
   `<SYSTEM_MESSAGE> [Message] sender=98dff25e-... priority=MESSAGE_PRIORITY_HIGH content=# Standards Review: Ticket 03...`
4. **Step 177 (Line 375)**: Subagent B completed. The system automatically injected:
   `<SYSTEM_MESSAGE> [Message] sender=7e287a63-... priority=MESSAGE_PRIORITY_HIGH content=# Review Report: Ticket 03...`
5. **Step 178 (Line 376)**: Once both reports were in context, the parent immediately proceeded to run verification commands.

### 3.2 The Supported Way to Wait Without Polling

Antigravity uses an **event-driven, reactive wakeup model**:
- Under `<messaging>`:
  > *"Reactive Wakeup (No Polling Needed): The system automatically resumes your execution when: A message arrives from a subagent or peer agent; A background task completes or sends you a notification... After launching anything that performs work asynchronously, you may continue other work or simply stop by calling no more tools. The system will notify you when there is something to process."*
- Under `<subagents>`:
  > *"After launching a subagent, you do NOT need to poll or check your inbox in a loop. The system will automatically notify you when the subagent sends a message. Simply proceed with other work or stop calling tools, and you will be notified when there is a message to process."*

**Conclusion**: The 45 polling calls in Ticket 03 (22 `schedule` + 23 `manage_subagents`) were completely unnecessary and contrary to system design. Subagents deliver their final report automatically upon completion, which triggers an immediate, reactive resumption of the parent agent. Eliminating this loop in Ticket 03 would have eliminated 45 turns and ~7.8M cached token passes.

---

## 4. Tool Schemas & Browser Documentation Verification

### 4.1 Schema Repetition & Prompt Cache Reuse

- **Native Tool Schemas**: Antigravity registers native tools (`run_command`, `read_file`, `write_file`, etc.) in the system prompt. Because Antigravity reuses the cached prompt prefix, these schemas are cached once at turn 1 (`cache_read_tokens`) and cost zero new input tokens on subsequent turns.
- **MCP Tool Architecture**: Antigravity supports both eager and lazy MCP tools (`<appDataDir>/mcp/<serverName>`). Eager tools expose schemas directly; lazy tools list only tool names and schemas are read on demand (`call_mcp_tool`), preventing catalog bloat.
- **Progressive Skill Disclosure**: In `agy-customizations` ([SKILL.md](file:///C:/Users/Administrator/.gemini/antigravity-cli/builtin/skills/agy-customizations/SKILL.md#L80-L90)), only skill names and descriptions are loaded into the initial prompt. Full runbooks and reference markdown files are loaded only when a skill is explicitly activated.

### 4.2 Browser Documentation: Codex vs. Antigravity

- **Evidence from Ledgers**: In `docs/session-analysis/tool-calls.csv`, the 95 calls to `mcp__cua_repl.js` (which repeatedly dumped ~12k tokens of browser documentation via `createBrowserTab` and ~8k tokens via `getState`) were **100% Codex sessions**.
- **Antigravity Ticket Calls**: In Tickets 01–05, Antigravity made **0 browser tool calls**. The tools used were strictly `run_command`, `read_file`, `view_file`, `write_file`, `edit_file`, and coordination tools.
- **Setup Overhead Separation**:
  - Baseline Setup: Antigravity starts at **11,052–12,166 tokens** (Tickets 01–05), compared to Codex's **35,269–36,673 tokens** (~3× smaller initial context).
  - Browser Overhead: Browser setup overhead was an artifact of the Codex MCP Puppeteer REPL integration, not Antigravity's core runtime.
  - Media & Images: Images and screen captures in Antigravity are handled via URI pointers stored under `.system_generated/` rather than base64 inline strings, preventing multi-thousand token image bloating in text history.

---

## 5. Context Budget, Compaction & Tool-Output Controls

### 5.1 Codex vs. Antigravity Controls

| Feature | OpenAI Codex Setting | Supported in Antigravity (`agy`)? | Antigravity Mechanism |
| :--- | :--- | :--- | :--- |
| **History Compaction Threshold** | `model_auto_compact_token_limit` | **No** (setting does not exist) | Manual `/compact` command, or automatic background compaction via `pack.windowMemory`. |
| **Tool Output Cap** | `tool_output_token_limit` | **No** (setting does not exist) | Built-in output truncation: `run_command` middle-truncates at ~10–14 KB to disk files; `read_file` caps at 800 lines / 46 KB. |
| **Context Window Override** | `model_context_window` | **No** | Controlled by model selection (e.g. Gemini 3.8 Flash default context window). |

### 5.2 Antigravity Compaction Mechanics (`/compact`)

Official binary changelog (`agy.exe` offset 70019225):
> *"Added the `/compact` command to compact the conversation on demand and free up the context window: `/compact` on its own summarizes the conversation and ends the turn, and `/compact <message>` summarizes it and then answers your message... shows how many steps were summarized and how much smaller the context became."*

Binary strings confirm that compaction replaces earlier messages with:
`</COMPACTED_HISTORY>INITIAL_USER_REQUEST ... Session summary: %s ...`
Importantly (offset 70001803):
> *"Improved `/compact` and automatic compaction to retain tool declarations on summarization requests so the model API reuses its cached prompt prefix."*

### 5.3 Compaction Trade-offs & Reread Pressure

While compaction reduces total context occupancy, aggressive or premature compaction causes **context loss**:
1. Active variable names, specific test failure lines, and domain constraints are compressed into a high-level prose summary.
2. The agent is forced to execute follow-up `read_file` calls to recover lost code context.
3. In Tickets 01–05, file reads totaled **446,403 estimated tokens** (e.g., `order_service.py` read 14 times in Ticket 03, contracts read repeatedly across tickets).
4. If compaction occurs mid-debugging, subsequent reads immediately push request context back up.
5. **Optimal timing**: Compaction is best triggered at **logical stage boundaries** (e.g. immediately after implementation passes local unit checks, before launching review subagents).

---

## 6. Corrections to Prior Reports

1. **Proxy vs. Exact Request Size**:
   - *Prior Report*: Called `input + cache` a "conditional proxy" with unresolved provider semantics ([session-context-investigation.md#L47](session-context-investigation.md#L47)).
   - *Correction*: Verified from `ModelUsageStats` protobuf in `agy.exe` and Gemini API `UsageMetadata` that `cache_read_tokens` and `input_tokens` are disjoint counters. `input + cache` is the **exact, authoritative request size**.
2. **Subagent Waiting Mechanism**:
   - *Prior Report*: Noted that Ticket 03 ran 45 coordination calls and stated "Simply ending the parent turn is not a verified cross-client completion strategy" ([session-context-investigation.md#L175](session-context-investigation.md#L175)).
   - *Correction*: Verified that ending the parent turn (calling no tools) **is the explicitly documented and implemented mechanism** in Antigravity. Subagents deliver reports via high-priority messages that reactively wake the parent. The polling loop was an agent bug, not a platform requirement.
3. **Applicability of Configuration Keys**:
   - *Prior Report*: Suggested evaluating `model_auto_compact_token_limit` at 90k and `tool_output_token_limit` at 2k–3k for future tickets ([session-context-investigation.md#L201](session-context-investigation.md#L201)).
   - *Correction*: Those configuration options belong solely to OpenAI Codex. They are not recognized by `agy.exe`. Context management in Antigravity must rely on proactive `/compact`, bounded file reads, and native truncation.
4. **Browser Documentation Attribution**:
   - *Prior Report*: Grouped browser documentation returns (~8k–12k tokens) as a general candidate for reduction across tickets.
   - *Correction*: Browser documentation overhead occurred exclusively in Codex via `mcp__cua_repl.js`. Antigravity sessions in the sample had zero browser tool invocations.

---

## 7. Practical Experiments with Success Criteria

### Experiment 1: Zero-Polling Subagent Delegation
- **Hypothesis**: Calling `invoke_subagent` and immediately ending the turn (calling no tools) will result in automatic parent resumption upon subagent completion, eliminating 100% of timer/coordination calls.
- **Method**: In a pilot ticket, spawn review subagents via `invoke_subagent` and conclude the turn. Measure whether the subagent's message arrives as a reactive wakeup.
- **Success Criteria**:
  - Zero `schedule` calls and zero `manage_subagents` status polling calls.
  - Subagent completion report received in parent context.
  - Reduction of 30–50 model responses and ~5M–8M cached token passes per review-heavy ticket.

### Experiment 2: Bounded File Reads vs. Full-File Ingestion
- **Hypothesis**: Enforcing `StartLine` and `EndLine` on `read_file` calls for files over 150 lines will prevent context jumps without increasing reread frequency.
- **Method**: For large files like `order_service.py` (which was read 14 times in Ticket 03), require targeted reads based on prior grep/ripgrep searches rather than full 800-line reads.
- **Success Criteria**:
  - Total returned `read_file` tokens per ticket reduced by >40% (target <20k tokens per ticket).
  - Number of repeat reads of the same file does not increase.
  - All acceptance criteria pass on the first verification run.

### Experiment 3: Stage-Gated Manual Compaction at 85k Tokens
- **Hypothesis**: Running `/compact` with an explicit status summary when request size (`input + cache`) crosses 85,000 tokens will keep peak context below the 100k preferred budget (and well below 150k acceptable) without triggering context amnesia.
- **Method**: Track cumulative request size. At the completion of the implementation phase (before test review), run `/compact "Implementation complete for Ticket X. Core changes in <paths>. Running test review."`.
- **Success Criteria**:
  - Peak request size remains ≤ 100,000 tokens throughout the entire ticket lifecycle.
  - No repeat reads of unchanged specification documents (`domain-contract.md`, `api-contract.md`).

---

## 8. The Three Highest-Priority Evidence-Supported Actions

### Action 1: Eliminate Subagent Polling Loops
**Action**: Never use `schedule` or `manage_subagents` in a loop to wait for subagents. After issuing `invoke_subagent`, immediately stop calling tools.
**Evidence**: Verified that Antigravity provides automatic reactive wakeup upon subagent message delivery (Ticket 03 lines 342 & 375). Polling consumed 45 calls (25% of the entire ticket) and 7.8M cached token passes with zero functional benefit.

### Action 2: Enforce Bounded Excerpt Reads
**Action**: Restrict `read_file` to specific line ranges (`StartLine`, `EndLine`) guided by search results, especially for files >150 lines (`order_service.py`, `SellerWorkspace.tsx`).
**Evidence**: File reads contributed 446k tokens across Antigravity development sessions, with `order_service.py` read 14 times in a single session. Native tool schema overhead is small (~12k), so reading volume is the primary driver pushing requests over 150k.

### Action 3: Trigger Proactive `/compact` at Implementation Milestones
**Action**: Use the supported `/compact <message>` command at logical boundaries (specifically after code edits pass focused unit tests, prior to launching subagents or integration tests) when request size approaches 80k–90k tokens.
**Evidence**: Codex-style auto-compact settings do not exist in Antigravity (`agy.exe`). Without proactive compaction, long tickets (140+ responses) inevitably accumulate 150k–230k tokens. `/compact` preserves tool definitions, attached files, and prompt cache prefix reuse while resetting history volume.
