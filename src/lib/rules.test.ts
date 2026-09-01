import { describe, expect, it } from 'vitest'
import { seedEdges, seedNodes } from './seed'
import { checkConnect, checkDelete, dependentsOf, orphanedQueues } from './rules'
import { ARCHITECTURES } from './architectures'
import { deriveScope, subsystemRect } from './scope'
import type { Refusal } from './rules'

const byId = (id: string) => seedNodes.find((n) => n.id === id)!
const asRefusal = (o: { ok: boolean }) => o as Refusal

describe('checkConnect', () => {
  it('allows a service to call its own subsystem database over sql', () => {
    expect(checkConnect(byId('payments-api'), byId('ledger-db'), 'sql').ok).toBe(true)
  })

  it('refuses a data store as the source of a call', () => {
    const r = asRefusal(checkConnect(byId('ledger-db'), byId('payments-api'), 'http'))
    expect(r.ok).toBe(false)
    expect(r.code).toBe('passive_source')
    expect(r.ruleOwner).toBe('architecture')
  })

  it('refuses a protocol that the target cannot speak', () => {
    const r = asRefusal(checkConnect(byId('payments-api'), byId('catalog-api'), 'sql'))
    expect(r.code).toBe('protocol_mismatch')
    expect(r.unblock).toMatch(/service/)
  })

  it('refuses the edge tier reaching past the gateway', () => {
    const r = asRefusal(checkConnect(byId('cdn'), byId('payments-api'), 'http'))
    expect(r.code).toBe('edge_bypasses_gateway')
  })

  it('refuses one subsystem reaching into another subsystem store', () => {
    const r = asRefusal(checkConnect(byId('payments-api'), byId('identity-db'), 'sql'))
    expect(r.code).toBe('cross_subsystem_datastore')
    expect(r.unblock).toMatch(/identity/)
  })

  it('allows calling another subsystem service over http', () => {
    expect(checkConnect(byId('payments-api'), byId('catalog-api'), 'http').ok).toBe(true)
  })

  it('refuses a self edge', () => {
    const r = asRefusal(checkConnect(byId('payments-api'), byId('payments-api'), 'http'))
    expect(r.code).toBe('self_edge')
  })

  it('always supplies an unblock hint', () => {
    const r = asRefusal(checkConnect(byId('ledger-db'), byId('payments-api'), 'http'))
    expect(r.unblock.length).toBeGreaterThan(0)
  })
})

describe('checkDelete', () => {
  it('refuses to delete a third-party provider', () => {
    const r = asRefusal(checkDelete(byId('stripe'), seedEdges))
    expect(r.code).toBe('external_not_owned')
  })

  it('refuses to delete something with inbound dependencies, and names them', () => {
    const r = asRefusal(checkDelete(byId('ledger-db'), seedEdges))
    expect(r.code).toBe('has_dependents')
    expect(r.message).toMatch(/payments-api/)
    expect(r.unblock).toMatch(/payments-api/)
  })

  it('allows deleting a leaf', () => {
    const leafEdges = seedEdges.filter((e) => e.target !== 'search')
    expect(checkDelete(byId('search'), leafEdges).ok).toBe(true)
  })

  it('attributes architecture rules to the architecture, not the operator', () => {
    const r = asRefusal(checkDelete(byId('ledger-db'), seedEdges))
    expect(r.ruleOwner).toBe('architecture')
  })
})

describe('graph helpers', () => {
  it('finds inbound dependents', () => {
    expect(dependentsOf('ledger-db', seedEdges)).toEqual(['payments-api'])
  })

  it('reports no orphaned queues in the seed architecture', () => {
    expect(orphanedQueues(seedNodes, seedEdges)).toEqual([])
  })

  it('detects a queue left without a consumer', () => {
    const starved = seedEdges.filter((e) => e.id !== 'payouts-queue->payouts-worker')
    expect(orphanedQueues(seedNodes, starved).map((n) => n.id)).toEqual(['payouts-queue'])
  })
})

describe('the same rules applied to the Kubernetes control plane', () => {
  const k8s = ARCHITECTURES.k8s
  const k = (id: string) => k8s.nodes.find((n) => n.id === id)!

  it('permits the API server to reach etcd', () => {
    expect(checkConnect(k('apiserver'), k('etcd'), 'sql').ok).toBe(true)
  })

  it('refuses any other component reaching etcd directly', () => {
    // Real Kubernetes invariant: etcd is reached through kube-apiserver only.
    const r = asRefusal(checkConnect(k('kubelet'), k('etcd'), 'sql'))
    expect(r.ok).toBe(false)
    expect(r.code).toBe('cross_subsystem_datastore')
  })

  it('refuses etcd initiating a call', () => {
    expect(asRefusal(checkConnect(k('etcd'), k('apiserver'), 'http')).code).toBe('passive_source')
  })

  it('refuses deleting etcd while the API server depends on it', () => {
    const r = asRefusal(checkDelete(k('etcd'), k8s.edges))
    expect(r.code).toBe('has_dependents')
    expect(r.message).toMatch(/apiserver/)
  })

  it('offers no queue-shaped tools, because there is no queue', () => {
    const scope = deriveScope(k8s.nodes, subsystemRect(k8s.nodes, 'control-plane'))
    expect(scope.capabilities).not.toContain('attach_consumer')
    expect(scope.capabilities).toContain('attach_cache')
  })
})
