import { describe, expect, it } from 'vitest'
import { seedNodes } from './seed'
import { capabilitiesFor, deriveScope, nodesInScope, subsystemRect } from './scope'

const byId = (id: string) => seedNodes.find((n) => n.id === id)!

describe('subsystemRect', () => {
  it('wraps exactly the members of a subsystem', () => {
    const rect = subsystemRect(seedNodes, 'payments')!
    const scoped = nodesInScope(seedNodes, rect).map((n) => n.id).sort()
    expect(scoped).toEqual(
      ['ledger-db', 'payments-api', 'payouts-queue', 'payouts-worker', 'stripe'].sort(),
    )
  })

  it('does not catch a neighbouring subsystem', () => {
    const rect = subsystemRect(seedNodes, 'payments')!
    const scoped = nodesInScope(seedNodes, rect).map((n) => n.id)
    // Regression: the payments band sits above catalog and below identity.
    expect(scoped).not.toContain('catalog-db')
    expect(scoped).not.toContain('identity-db')
  })

  it('returns null for a subsystem that does not exist', () => {
    expect(subsystemRect(seedNodes, 'nope')).toBeNull()
  })
})

describe('nodesInScope', () => {
  it('is empty when no region is drawn', () => {
    expect(nodesInScope(seedNodes, null)).toEqual([])
  })

  it('includes a node that only partially overlaps the region', () => {
    const n = byId('payments-api')
    const rect = { x: n.position.x + 200, y: n.position.y + 60, width: 120, height: 120 }
    expect(nodesInScope(seedNodes, rect).map((x) => x.id)).toContain('payments-api')
  })

  it('excludes a node that merely touches the edge', () => {
    const n = byId('payments-api')
    const rect = { x: n.position.x - 100, y: n.position.y, width: 100, height: 78 }
    expect(nodesInScope(seedNodes, rect).map((x) => x.id)).not.toContain('payments-api')
  })
})

describe('capabilitiesFor', () => {
  it('grants nothing for an empty region', () => {
    expect(capabilitiesFor([])).toEqual([])
  })

  it('grants attach_consumer only when a queue is in the region', () => {
    const payments = deriveScope(seedNodes, subsystemRect(seedNodes, 'payments'))
    const identity = deriveScope(seedNodes, subsystemRect(seedNodes, 'identity'))

    expect(payments.capabilities).toContain('attach_consumer')
    // identity has no queue, so the tool must not exist there
    expect(identity.capabilities).not.toContain('attach_consumer')
  })

  it('grants attach_cache wherever a service or worker sits', () => {
    const identity = deriveScope(seedNodes, subsystemRect(seedNodes, 'identity'))
    expect(identity.capabilities).toContain('attach_cache')
  })

  it('grants route_ingress only where the region owns an entrypoint', () => {
    const edge = deriveScope(seedNodes, subsystemRect(seedNodes, 'edge'))
    const catalog = deriveScope(seedNodes, subsystemRect(seedNodes, 'catalog'))
    expect(edge.capabilities).toContain('route_ingress')
    expect(catalog.capabilities).not.toContain('route_ingress')
  })

  it('withholds connect_components when nothing in the region can initiate a call', () => {
    const passiveOnly = [byId('ledger-db'), byId('payouts-queue')]
    const caps = capabilitiesFor(passiveOnly)
    expect(caps).not.toContain('connect_components')
    expect(caps).not.toContain('add_component')
  })

  it('names only tools that are actually registered', () => {
    // Regression: get_scope once advertised five tools that did not exist.
    const registered = new Set([
      'add_component', 'connect_components', 'detach_dependency', 'remove_component',
      'attach_cache', 'attach_consumer', 'route_ingress', 'annotate_component',
    ])
    for (const s of ['edge', 'identity', 'payments', 'catalog']) {
      for (const cap of deriveScope(seedNodes, subsystemRect(seedNodes, s)).capabilities) {
        expect(registered.has(cap)).toBe(true)
      }
    }
  })
})
