import React, { useRef, useEffect } from 'react'
import type { NavResult } from '@/services/api'
import { Badge } from './ui/Badge'
import { Navigation } from 'lucide-react'

interface Node {
  id: number
  name: string
  x_pct: number
  y_pct: number
}

interface Edge {
  source: number
  target: number
  distance_meters: number
  step_hint?: string
}

interface MapOverlayProps {
  activeRoute?: NavResult | null
  navResult?: NavResult | null
  onClose?: () => void
}

/**
 * MapOverlay — Apple Maps-inspired campus vector plot with dynamic path animation
 */
export default function MapOverlay({ activeRoute, navResult, onClose }: MapOverlayProps) {
  const [nodes, setNodes] = React.useState<Node[]>([])
  const [edges, setEdges] = React.useState<Edge[]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  const effectiveRoute = activeRoute || navResult || null

  useEffect(() => {
    fetch('/campus_overview.json')
      .then((r) => r.json())
      .then((data) => {
        setNodes(data.nodes ?? [])
        setEdges(data.edges ?? [])
      })
      .catch(() => {})
  }, [])

  const routeStops = effectiveRoute?.route_stops ?? []
  const routeNodeNames = new Set(routeStops)
  const nodeMap = new Map<number, Node>(nodes.map((n) => [n.id, n]))
  const routeNodes = routeStops
    .map((name) => nodes.find((n) => n.name === name))
    .filter(Boolean) as Node[]

  return (
    <div style={styles.container}>
      <img
        src="/campus_map.jpg"
        alt="IARE Campus Map"
        style={styles.mapImg}
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />

      <svg ref={svgRef} style={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id="campus-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="0.5" />
          </pattern>
          <filter id="apple-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <rect width="100" height="100" fill="url(#campus-grid)" />

        {/* Pathways */}
        {edges.map((e, idx) => {
          const src = nodeMap.get(e.source)
          const tgt = nodeMap.get(e.target)
          if (!src || !tgt) return null
          return (
            <line
              key={`edge-${idx}`}
              x1={src.x_pct}
              y1={src.y_pct}
              x2={tgt.x_pct}
              y2={tgt.y_pct}
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="0.8"
              strokeDasharray="1.5 1.5"
            />
          )
        })}

        {/* Active Route Path */}
        {routeNodes && routeNodes.length > 1 && (
          <>
            <polyline
              points={routeNodes.map((n) => `${n.x_pct},${n.y_pct}`).join(' ')}
              stroke="rgba(10, 132, 255, 0.3)"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={routeNodes.map((n) => `${n.x_pct},${n.y_pct}`).join(' ')}
              stroke="#0A84FF"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="300"
              strokeDashoffset="300"
              filter="url(#apple-glow)"
              style={{ animation: 'drawPath 1.2s ease forwards' }}
            />
          </>
        )}

        {/* Nodes */}
        {nodes.map((node) => {
          const inRoute = routeNodeNames.has(node.name)
          const isStart = routeStops.length > 0 && routeStops[0] === node.name
          const isEnd = routeStops.length > 0 && routeStops[routeStops.length - 1] === node.name

          return (
            <g key={node.id}>
              {(isStart || isEnd) && (
                <circle
                  cx={node.x_pct}
                  cy={node.y_pct}
                  r="4.5"
                  fill={isEnd ? 'rgba(52, 199, 89, 0.25)' : 'rgba(10, 132, 255, 0.25)'}
                  style={{ animation: 'applePulse 2s infinite' }}
                />
              )}

              <circle
                cx={node.x_pct}
                cy={node.y_pct}
                r={inRoute ? (isStart || isEnd ? 3.4 : 2.8) : 1.8}
                fill={isEnd ? '#34C759' : isStart ? '#0A84FF' : inRoute ? '#0A84FF' : 'rgba(142, 142, 147, 0.7)'}
                stroke={inRoute ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)'}
                strokeWidth="0.8"
                style={{ transition: 'all 0.3s ease' }}
              />

              <text
                x={node.x_pct}
                y={node.y_pct - 3.4}
                textAnchor="middle"
                fontSize="2.4"
                fontWeight={inRoute ? '700' : '500'}
                fill={inRoute ? 'var(--text-primary)' : 'var(--text-secondary)'}
                style={{ fontFamily: 'var(--font-family)', pointerEvents: 'none' }}
              >
                {node.name.replace('Entrance', '').replace('Department', 'Dept').trim()}
              </text>
            </g>
          )
        })}
      </svg>

      {effectiveRoute?.success && routeStops.length > 0 && (
        <div style={styles.legend}>
          <Badge variant="primary" size="sm" icon={<Navigation size={10} />}>
            {routeStops.length} stops • {Math.round(effectiveRoute.total_distance_meters || 0)}m
          </Badge>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    paddingBottom: '68%',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    background: 'var(--bg-sunken)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-subtle)',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
  },
  mapImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.45,
  },
  svg: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  legend: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    zIndex: 2,
  },
}
