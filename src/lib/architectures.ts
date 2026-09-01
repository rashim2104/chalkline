import type { InfraEdge, InfraNode } from './seed'
import { seedEdges, seedNodes, SUBSYSTEMS } from './seed'
import type { InfraEdgeData, InfraNodeData } from './types'

export type Architecture = {
  id: string
  name: string
  blurb: string
  subsystems: readonly string[]
  nodes: InfraNode[]
  edges: InfraEdge[]
}

const n = (id: string, x: number, y: number, data: InfraNodeData): InfraNode => ({
  id,
  type: 'infra',
  position: { x, y },
  width: 224,
  height: 78,
  data,
})

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

/**
 * The Kubernetes control plane, as documented. Included to show the same
 * twelve tools and the same rule engine working on an architecture nobody
 * invented for this demo.
 *
 * The rule that only kube-apiserver may reach etcd is real:
 * https://kubernetes.io/docs/concepts/architecture/ - etcd is reached through
 * the API server, never directly by other components.
 */
const k8sNodes: InfraNode[] = [
  n('kubectl', 0, 300, {
    label: 'kubectl',
    kind: 'edge',
    subsystem: 'clients',
    env: 'prod',
    criticality: 'tier2',
    detail: 'Operator CLI, TLS client certs',
  }),
  n('lb', 280, 300, {
    label: 'control-plane-lb',
    kind: 'gateway',
    subsystem: 'clients',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Fronts 3 API server replicas',
  }),

  n('apiserver', 600, 60, {
    label: 'kube-apiserver',
    kind: 'service',
    subsystem: 'control-plane',
    env: 'prod',
    criticality: 'tier0',
    detail: 'The only component that talks to etcd',
  }),
  n('scheduler', 600, 180, {
    label: 'kube-scheduler',
    kind: 'service',
    subsystem: 'control-plane',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Binds pods to nodes',
  }),
  n('controller-manager', 600, 300, {
    label: 'controller-manager',
    kind: 'service',
    subsystem: 'control-plane',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Reconciliation loops',
  }),
  n('etcd', 940, 60, {
    label: 'etcd',
    kind: 'database',
    subsystem: 'control-plane',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Raft quorum, 3 members, cluster state of record',
  }),

  n('kubelet', 600, 520, {
    label: 'kubelet',
    kind: 'worker',
    subsystem: 'node',
    env: 'prod',
    criticality: 'tier0',
    detail: 'Node agent, one per machine',
  }),
  n('kube-proxy', 600, 640, {
    label: 'kube-proxy',
    kind: 'worker',
    subsystem: 'node',
    env: 'prod',
    criticality: 'tier1',
    detail: 'Service routing, iptables mode',
  }),
  n('containerd', 940, 520, {
    label: 'containerd',
    kind: 'service',
    subsystem: 'node',
    env: 'prod',
    criticality: 'tier0',
    detail: 'CRI runtime',
  }),
  n('registry', 1260, 520, {
    label: 'image-registry',
    kind: 'external',
    subsystem: 'node',
    env: 'prod',
    criticality: 'tier1',
    detail: 'External OCI registry',
  }),
]

const k8sEdges: InfraEdge[] = [
  e('kubectl', 'lb', 'http'),
  e('lb', 'apiserver', 'http'),
  e('apiserver', 'etcd', 'sql'),
  e('scheduler', 'apiserver', 'http'),
  e('controller-manager', 'apiserver', 'http'),
  e('kubelet', 'apiserver', 'http'),
  e('kube-proxy', 'apiserver', 'http'),
  e('kubelet', 'containerd', 'grpc'),
  e('containerd', 'registry', 'http'),
]

export const ARCHITECTURES: Record<string, Architecture> = {
  saas: {
    id: 'saas',
    name: 'Payments SaaS',
    blurb: 'A four-subsystem production system with an append-only ledger.',
    subsystems: SUBSYSTEMS,
    nodes: seedNodes,
    edges: seedEdges,
  },
  k8s: {
    id: 'k8s',
    name: 'Kubernetes control plane',
    blurb:
      'The documented control plane. Only kube-apiserver may reach etcd - a real invariant, not one invented for this demo.',
    subsystems: ['clients', 'control-plane', 'node'],
    nodes: k8sNodes,
    edges: k8sEdges,
  },
}

export const DEFAULT_ARCHITECTURE = 'saas'
