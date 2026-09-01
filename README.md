# chalkline

**An architecture diagram where the agent's tool surface is a readout of the region you drew.**

Draw a box around your payments subsystem and the agent gains `attach_consumer`,
because there is a queue inside it. Move the box to identity and that tool
disappears, because there is no queue there. Nothing was configured. The
capability surface is derived from the architecture the operator pointed at.

Built for the [WebMCP Challenge](https://webmcp.devpost.com/).

- **Live app:** _(deploying)_
- **Demo video:** _(recording)_
- **Evidence:** [`docs/evidence/`](docs/evidence/) — transcripts of real runs

---

## The problem

Letting an agent edit your architecture is not a permissions problem, it is a
*blast radius* problem. "Can this agent call `delete`?" is the wrong question.
The right one is "what may it call `delete` **on**, right now, and who decided?"

Most answers to this bolt a validation layer onto the tool: the agent asks for
something out of bounds, the tool says no, a turn is wasted, and the agent may
try a variation. The boundary lives in an `if` statement the agent cannot see.

chalkline puts the boundary in the schema instead.

## How it works

The operator draws a region on the canvas. Every scoped tool then declares its
target as a JSON Schema `enum` built from the components inside that region:

```jsonc
// remove_component, with the payments region active
{
  "type": "object",
  "properties": {
    "component": { "type": "string", "enum": ["payments-api", "ledger-db", "payouts-queue", "payouts-worker"] }
  },
  "required": ["component"]
}
```

`identity-db` is not in that list. The agent is not refused when it asks to
delete the identity database — **it has no way to express the request.** The
component is absent from its vocabulary.

Redraw the region and the enum changes. A changed `inputSchema` re-registers
the tool, the browser fires `toolchange`, and the agent's next `getTools()`
sees a different world. This is the whole reason the project needs WebMCP:
tool *registration* is a live function of page state. A server-side MCP has no
idea what you have selected.

### The capability surface

Which tools exist is derived from what the region contains, not from a fixed list:

| The region contains… | …and these tools come into existence |
| --- | --- |
| anything at all | `annotate_component` |
| a service, worker, gateway or edge | `add_component`, `connect_components` |
| a service or worker | `attach_cache` |
| **a queue** | **`attach_consumer`** |
| an edge or gateway | `route_ingress` |
| two or more components | `detach_dependency` |
| anything that is not third-party | `remove_component` |

Select the payments band and `attach_consumer` appears. Select identity and it
is gone. The agent's abilities are a map of your system.

## Tools

Twelve tools. Four are always available; eight exist only while a region is drawn.

| Tool | Read-only | Exists when |
| --- | --- | --- |
| `list_components` | ✓ | always |
| `list_dependencies` | ✓ | always |
| `describe_component` | ✓ | always |
| `get_scope` | ✓ | always |
| `annotate_component` | | region is non-empty |
| `add_component` | | region holds something that can initiate a call |
| `connect_components` | | region holds something that can initiate a call |
| `attach_cache` | | region holds a service or worker |
| `attach_consumer` | | region holds a queue |
| `route_ingress` | | region holds an edge or gateway |
| `detach_dependency` | | region holds two or more components |
| `remove_component` | | region holds a non-external component |

Read tools work on the whole architecture regardless of the region. An agent
should always be able to *understand* the system; the region governs what it
may *change*. They carry `annotations.readOnlyHint`.

## Refusals carry a plan

Some things cannot be expressed. Others can be expressed but are wrong — those
get refused, and a refusal that only says "no" wastes a turn. Every refusal
carries a machine-readable code, the rule, **whose rule it is**, and the unblock:

```
REFUSED (has_dependents). payouts-worker still has 1 inbound dependency: payouts-queue.
Rule: A component with inbound dependencies cannot be removed.
Set by: this architecture
To proceed: Detach payouts-queue first, then remove payouts-worker.
```

The `Set by` line matters. `has_dependents` is set by the architecture, so
redrawing the region will not help. `out_of_scope` is set by the operator, and
its unblock says so.

In [a real run](docs/evidence/2026-09-01-refusal-recovery.md), the agent hit
that exact refusal, called `list_dependencies` on its own initiative, detached
the offending edge, and retried successfully. It never asked the operator what
to do. The refusal was enough.

The architecture rules are real infrastructure semantics, not invented
constraints: data stores do not initiate calls, `sql` may only target a
database, the edge tier must enter through a gateway, and one subsystem may not
reach into another's data store.

## The human is in the loop, not on the sidelines

`remove_component` returns a promise that **does not resolve until a human
clicks**. The agent's tool call is genuinely suspended; the activity row sits at
`awaiting` until someone answers.

This is the thing a server-side MCP structurally cannot do. It can compute the
change. It cannot wait for you.

## What makes this a WebMCP app and not a chatbot

- The agent and the operator call **the same functions**. Every tool routes
  through the same store the UI mutates. There is no agent-only API and no
  second copy of the state to drift.
- The tool list is read back out of the browser with
  `document.modelContext.getTools()` and refreshed on `toolchange`. The panel on
  screen is what an agent would actually discover, not our own bookkeeping.
- Tool registration is derived from live page state. That is the one thing this
  API does that an out-of-process MCP server cannot.

## Testing it

### ChatGPT's built-in browser — no setup

1. `Cmd+Shift+B` in the ChatGPT desktop app
2. Settings → Browser → Permissions → **Enable site tools**
3. Use **GPT-5.6 Sol** or **Terra**. Luna has WebMCP disabled.
4. Open the live URL, click **Site tools** in the address bar to see what it found

Not available in Enterprise or Edu workspaces.

### Chrome 149+

1. `chrome://flags/#enable-webmcp-testing` → **Enabled** → relaunch
2. Install the [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd)
3. Open the app, click the extension icon for a side panel with a chat

### DevTools, no agent

DevTools → **Application** → **WebMCP** → pick a tool → **Run tool**. Deterministic,
no model involved. Use this to confirm a tool works before blaming the model.

### Try this

Open `?scope=payments`, then ask:

1. *"What's in scope right now?"* — `get_scope` reports the region and the live tool list
2. *"Delete the identity database"* — it cannot. `identity-db` is not in any enum.
3. *"payouts-queue needs another consumer"* — works, because a queue is in scope
4. Click the **identity** chip — `attach_consumer` disappears from the rail
5. *"Remove payouts-worker"* — refused for dependents, then watch it recover

## Running locally

```bash
bun install
bun dev
```

WebMCP needs a secure context; `localhost` qualifies.

Deep links: `?scope=edge`, `?scope=identity`, `?scope=payments`, `?scope=catalog`.

## Built with

[React 19](https://react.dev) · [Vite](https://vite.dev) ·
[@xyflow/react](https://reactflow.dev) for the canvas ·
[`use-webmcp-tool`](https://github.com/GoogleChromeLabs/use-webmcp-tool),
Chrome's own hook, which ties registration to component lifecycle and handles
the StrictMode double-mount that otherwise leaves a tool silently unregistered.

Tools are registered imperatively on the top-level document. Not declaratively,
and not in an iframe — ChatGPT's browser supports neither.

## License

[MIT](LICENSE)
