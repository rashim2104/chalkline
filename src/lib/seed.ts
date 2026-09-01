import type { Edge, Node } from '@xyflow/react'
import type { InfraEdgeData, InfraNodeData } from './types'

export type InfraNode = Node<InfraNodeData, 'infra'>
export type InfraEdge = Edge<InfraEdgeData>

export const NODE_SIZE = { width: 224, height: 78 } as const

const n = (
  id: string,
  x: number,
  y: number,
  data: InfraNodeData,
): InfraNode => ({
  id,
  type: 'infra',
  position: { x, y },
  data,
  ...NODE_SIZE,
})

export const SUBSYSTEMS = ['edge', 'identity', 'payments', 'catalog'] as const

export const seedNodes: InfraNode[] = [
  n('cdn', 0, 300, {
    label: 'Cloudflare CDN',
    kind: 'edge',
    subsystem: 'edge',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Global edge cache, 312 PoPs',
  }),
  n('lb', 240, 300, {
    label: 'Load Balancer',
    kind: 'gateway',
    subsystem: 'edge',
    env: 'prod',
    criticality: 'tier0',
    detail: 'HAProxy, 3 AZs',
  }),

  n('auth-api', 540, 60, {
    label: 'auth-api',
    kind: 'service',
    subsystem: 'identity',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Go 1.24, 6 replicas',
  }),
  n('sessions', 820, 20, {
    label: 'sessions',
    kind: 'cache',
    subsystem: 'identity',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Redis 7, 4 GB',
  }),
  n('identity-db', 820, 140, {
    label: 'identity-db',
    kind: 'database',
    subsystem: 'identity',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Postgres 17, primary + 2 replicas',
  }),

  n('payments-api', 540, 320, {
    label: 'payments-api',
    kind: 'service',
    subsystem: 'payments',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Go 1.24, 8 replicas',
  }),
  n('ledger-db', 820, 260, {
    label: 'ledger-db',
    kind: 'database',
    subsystem: 'payments',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Postgres 17, append-only ledger',
  }),
  n('payouts-queue', 820, 380, {
    label: 'payouts-queue',
    kind: 'queue',
    subsystem: 'payments',
    env: 'prod',
    criticality: 'tier1',
    detail: 'RabbitMQ, quorum queues',
  }),
  n('payouts-worker', 1100, 380, {
    label: 'payouts-worker',
    kind: 'worker',
    subsystem: 'payments',
    env: 'prod',
    criticality: 'tier1',
    detail: 'BullMQ, 12 concurrency',
  }),
  n('stripe', 1100, 260, {
    label: 'Stripe',
    kind: 'external',
    subsystem: 'payments',
    env: 'prod',
    criticality: 'tier0',
    detail: 'External PSP, webhooks in',
  }),

  n('catalog-api', 540, 600, {
    label: 'catalog-api',
    kind: 'service',
    subsystem: 'catalog',
    env: 'prod',
    criticality: 'tier1',
    detail: 'Node 22, 4 replicas',
  }),
  n('catalog-db', 820, 540, {
    label: 'catalog-db',
    kind: 'database',
    subsystem: 'catalog',
    env: 'prod',
    criticality: 'tier1',
    detail: 'Postgres 17',
  }),
  n('search', 820, 660, {
    label: 'search-index',
    kind: 'cache',
    subsystem: 'catalog',
    env: 'prod',
    criticality: 'tier2',
    detail: 'Typesense, 2 nodes',
  }),
  n('assets', 1100, 600, {
    label: 'asset-store',
    kind: 'storage',
    subsystem: 'catalog',
    env: 'prod',
    criticality: 'tier2',
    detail: 'Cloudflare R2, 1.4 TB',
  }),
]

const e = (
  source: string,
  target: string,
  protocol: InfraEdgeData['protocol'],
): InfraEdge => ({
  id: `${source}->${target}`,
  source,
  target,
  type: 'infra',
  data: { protocol },
})

export const seedEdges: InfraEdge[] = [
  e('cdn', 'lb', 'http'),
  e('lb', 'auth-api', 'http'),
  e('lb', 'payments-api', 'http'),
  e('lb', 'catalog-api', 'http'),
  e('auth-api', 'sessions', 'redis'),
  e('auth-api', 'identity-db', 'sql'),
  e('payments-api', 'ledger-db', 'sql'),
  e('payments-api', 'payouts-queue', 'amqp'),
  e('payments-api', 'stripe', 'http'),
  e('payouts-queue', 'payouts-worker', 'amqp'),
  e('payouts-worker', 'stripe', 'http'),
  e('catalog-api', 'catalog-db', 'sql'),
  e('catalog-api', 'search', 'http'),
  e('catalog-api', 'assets', 's3'),
]
