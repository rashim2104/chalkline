# Evidence

Transcripts of real agent runs against the deployed app. Nothing here is
scripted, mocked, or written by hand from imagination — each file records what
a model actually did, with the harness and model named.

## Method

- **Harness A:** Chrome 153 + `chrome://flags/#enable-webmcp-testing` +
  [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd)
  side panel. Model: `gemini-3-flash-preview` (the extension's default).
- **Harness B:** ChatGPT desktop built-in browser, GPT-5.6 Sol or Terra.

Each run records the prompt, every tool call with its arguments, every tool
result verbatim, and the model's final answer.

## The comparison that matters

The interesting axis is not "does the agent succeed" but **what the agent can
express**. Each scenario is run under two conditions:

| Condition | Scope region | Registered tools |
| --- | --- | --- |
| **A — unscoped** | none drawn | 4, all read-only |
| **B — scoped** | subsystem selected | 4 read-only + 7 or 8 scoped |

Under condition A no editing tool exists at all. Under condition B the editing
tools exist but their enums contain only in-scope components. The claim being
tested is that the agent's *vocabulary* changes, not merely its success rate.

## Runs

| File | Scenario | Result |
| --- | --- | --- |
| [`2026-09-01-refusal-recovery.md`](2026-09-01-refusal-recovery.md) | Remove a component that has an inbound dependency | Refused, then the agent recovered unaided |

## Scenarios still to record

1. **Out-of-scope removal.** Scope payments, ask to delete `identity-db`.
   Expect: the agent cannot name it. Contrast with the same prompt while
   identity is scoped, where it can.
2. **Cross-subsystem data store.** Scope payments, ask to connect
   `payments-api` to `identity-db` over sql. Expect `cross_subsystem_datastore`
   with an unblock pointing at HTTP.
3. **Protocol mismatch.** Ask to connect `payments-api` to `catalog-api` over
   sql. Expect `protocol_mismatch` naming the valid targets.
4. **Capability surface.** Ask `get_scope` with payments selected, then with
   identity selected. Expect `attach_consumer` present in one and absent in the
   other, with no configuration change between them.
5. **Kubernetes invariant.** `?arch=k8s`, scope control-plane, ask to point
   `kubelet` at `etcd`. Expect `cross_subsystem_datastore` — the real documented
   rule.
6. **Passive source.** Ask to make `ledger-db` call `payments-api`. Expect
   `passive_source`.

## Recording a run

Copy [`_template.md`](_template.md), fill in the harness, model, date, scope
state and the verbatim exchange. Do not edit the tool output.
