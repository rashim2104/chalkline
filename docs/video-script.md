# Demo video script

Constraints: under 3 minutes, public on YouTube, audio required.
Target: 2:40. Judges may score on this alone, so every claim must be shown.

Record in Chrome 153 with the WebMCP flag on and the Model Context Tool
Inspector side panel open, so tool calls are visible next to the canvas.

---

## 0:00-0:18 — The problem, stated once

> "Letting an agent edit your architecture isn't a permissions problem. It's a
> blast radius problem. The question isn't whether it can call delete. It's
> what it's allowed to call delete *on* — right now."

**On screen:** the payments SaaS architecture, no scope region. Right rail shows
four read-only tools and nothing else.

---

## 0:18-0:50 — The mechanism

Click the **payments** chip. The region snaps around five components. Out-of-scope
components dim.

> "I draw a region. Seven editing tools appear."

**Hold on the right rail for two full seconds** as the chips animate in. This is
the shot the whole video is built around.

> "These tools didn't get *enabled*. They got *registered*. Their input schemas
> declare the target as an enum built from what's inside this region."

**On screen:** the inspector's schema view for `remove_component`, showing the
four-value enum.

---

## 0:50-1:20 — The boundary is in the schema

Ask the agent: *"Delete the identity database."*

> "identity-db is a real component. It's right there. But it isn't in any enum,
> so the agent has no way to name it. It isn't refused after asking — it can't
> form the request."

**On screen:** the agent's reply explaining it cannot reach outside the region.

---

## 1:20-1:50 — The surface is a map of the system

Ask: *"payouts-queue needs another consumer."* It works; a worker appears wired
to the queue.

Now click the **identity** chip.

> "attach_consumer just disappeared. There's no queue in identity. Nothing was
> configured — the tool list is derived from what the region contains. The
> agent's abilities are a readout of the architecture you pointed it at."

**On screen:** the rail before and after, `attach_consumer` gone.

---

## 1:50-2:20 — Refusals carry a plan

Back to payments. Ask: *"Remove payouts-worker."*

Refused: `has_dependents`, with the unblock naming `payouts-queue`.

> "A refusal that just says no wastes a turn. This one carries the rule, who set
> it, and what would unblock it."

The agent then calls `list_dependencies`, detaches the edge, and retries — **without
being told**. Let this play out; don't narrate over it.

> "That recovery is the model's own. The refusal was enough."

On the retry, the approval dialog appears and the call hangs.

> "And this call hasn't returned. It's suspended until a human answers. A
> server-side MCP can compute this change. It cannot wait for you."

Click **Approve**.

---

## 2:20-2:40 — It generalises

Switch to **Kubernetes control plane**.

> "Same twelve tools. Same rule engine. Nothing rewritten."

**On screen:** header reads six editing tools, not seven.

> "Six, not seven — Kubernetes has no queue, so attach_consumer doesn't exist
> here."

Ask the agent to point `kubelet` at `etcd`. Refused, `cross_subsystem_datastore`.

> "And that refusal is a real Kubernetes invariant: etcd is reached through the
> API server, never directly. That rule was written for a payments system. It
> turns out to be the same rule."

**Close on:** the chalkline mark and the URL.

---

## Shot list to capture before recording

1. Rail with four read-only tools, no region
2. Rail with seven tools, payments region active
3. `remove_component` schema showing the narrowed enum
4. Agent failing to name `identity-db`
5. `attach_consumer` present, then absent after switching to identity
6. Full refusal → `list_dependencies` → `detach` → retry sequence
7. Approval dialog with the activity row at `awaiting`
8. K8s view, header reading six tools
9. `kubelet` → `etcd` refusal

## Things to avoid

- Do not say Gemini in Chrome calls the tools. It does not; this is the
  inspector extension.
- Do not call it ChatGPT Atlas. Atlas was retired 2026-08-09; it is ChatGPT's
  built-in browser.
- Do not claim the app has no backend as a selling point. It does not have one,
  but that is not the argument — dynamic registration is.
