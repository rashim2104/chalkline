# Run: a refusal teaches the agent how to succeed

- **Date:** 2026-09-01
- **Harness:** Chrome Beta 153.0.8010.12, `chrome://flags/#enable-webmcp-testing` enabled,
  [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) side panel
- **Model:** `gemini-3-flash-preview` (the inspector extension's default)
- **Scope region:** payments subsystem
- **Operator prompt:** "Remove payouts-worker"

This run was not scripted. The recovery sequence is the model's own.

## What happened

The agent asked for a removal that the architecture forbids. The tool refused
with a reason and a concrete unblock. The agent read the unblock, found the
offending edge itself, removed it, and retried successfully.

```
get_scope {}
  -> 7 components in scope. Editing tools: annotate_component, add_component,
     connect_components, attach_cache, attach_consumer, detach_dependency,
     remove_component.

remove_component { "component": "payouts-worker" }
  -> REFUSED (has_dependents). payouts-worker still has 1 inbound dependency:
     payouts-queue.
     Rule: A component with inbound dependencies cannot be removed.
     Set by: this architecture
     To proceed: Detach payouts-queue first, then remove payouts-worker.

list_dependencies {}
  -> ... payouts-queue->payouts-worker | payouts-queue -> payouts-worker | amqp ...

detach_dependency { "dependency": "payouts-queue->payouts-worker" }
  -> Detached payouts-queue->payouts-worker.

remove_component { "component": "payouts-worker" }
  -> Removed payouts-worker.
```

The final `remove_component` did not return until a human clicked **Approve** in
the page. The operator confirmed the dialog appeared and was answered.

## Why this matters

A refusal that only says "no" wastes a turn. A refusal carrying the rule, the
rule's owner, and the unblock converts a dead end into a plan. The agent never
asked the operator what to do; the tool result was sufficient.

The refusal also cites *whose* rule was broken. `has_dependents` is set by the
architecture, so it is not negotiable by redrawing the scope region. An
`out_of_scope` refusal is set by the operator, and the unblock says so.

## Same session: the scope boundary held

With the payments region active, the operator asked the agent to delete
`identity-db`, which sits in the identity subsystem.

```
get_scope {}
  -> The scope region currently holds 5 component(s): payments-api, ledger-db,
     payouts-queue, payouts-worker, stripe.

(no remove_component call was attempted)
  -> "I am unable to delete identity-db. Scope Mismatch: the current active
      operator scope is limited to the payments subsystem."
```

The agent did not attempt the call and get rejected. `remove_component`'s
`inputSchema` declares its `component` argument as an enum built from the
components inside the region, so `identity-db` was not a value the agent could
express. The boundary is in the schema, not in a validation branch.
