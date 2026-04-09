<!--
  3D graph visualization using 3d-force-graph (Three.js + d3-force-3d).
  Reads settings from the shared store and reacts to changes.
-->
<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import {
    archSettings,
    nodeFilters,
    edgeFilters,
    getVisibleTypes,
    getVisibleEdgeTypes,
  } from '$lib/stores/architecture-settings.svelte'
  import { TYPE_COLORS, TYPE_LABELS, EDGE_COLORS, type ArchGraphData, type SelectedNodeInfo, type ConnectedNode } from './constants'

  let {
    graphData,
    onselect,
    ondeselect,
  }: {
    graphData: ArchGraphData
    onselect: (node: SelectedNodeInfo, connections: ConnectedNode[]) => void
    ondeselect: () => void
  } = $props()

  let container: HTMLDivElement
  let graph3d: any = null
  let _THREE: any = null
  let cleanup: (() => void) | null = null

  // ── Build 3D data ─────────────────────────────────────────────

  function build3dData() {
    const visibleTypes = getVisibleTypes()
    const visibleEdgeTypes = getVisibleEdgeTypes()

    const filteredNodes = graphData.nodes
      .filter((n) => !n.id.startsWith('group:') && visibleTypes.includes(n.type))
      .map((n) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        color: TYPE_COLORS[n.type] || '#888',
        val: n.type === 'shared' ? (archSettings.nodeSize / 30) * 3 : archSettings.nodeSize / 30,
        ...n.meta,
      }))

    const nodeIds = new Set(filteredNodes.map((n) => n.id))

    const filteredLinks = graphData.edges
      .filter(
        (e) =>
          nodeIds.has(e.source) &&
          nodeIds.has(e.target) &&
          visibleEdgeTypes.includes(e.type),
      )
      .map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        color: EDGE_COLORS[e.type] || '#888',
      }))

    return { nodes: filteredNodes, links: filteredLinks }
  }

  // ── Text texture for labels ───────────────────────────────────

  function makeTextTexture(text: string): any {
    if (!_THREE) return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = 256
    canvas.height = 128
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = 'bold 28px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(text.length > 20 ? text.slice(0, 18) + '...' : text, 128, 64)
    const tex = new _THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }

  // ── Style updates ─────────────────────────────────────────────

  function updateStyle() {
    if (!graph3d) return
    const s = archSettings
    graph3d
      .backgroundColor(s.bgColor)
      .linkOpacity(s.edgeOpacity)
      .linkWidth(s.edgeWidth * 0.5)
      .linkDirectionalArrowLength(s.showArrows ? 4 : 0)
      .linkCurvature(s.linkCurvature)
      .linkDirectionalParticles(s.showParticles ? s.particleDensity : 0)
      .linkDirectionalParticleSpeed(s.particleSpeed)
      .nodeResolution(s.nodeResolution)
  }

  function updateData() {
    if (!graph3d) return
    graph3d.graphData(build3dData())
  }

  // ── Public API ────────────────────────────────────────────────

  export function fit() {
    graph3d?.zoomToFit(600, 60)
  }

  // ── Init ──────────────────────────────────────────────────────

  async function init() {
    if (!container) return

    _THREE = await import('three')
    const ForceGraph3DModule = await import('3d-force-graph')
    const ForceGraph3DFn = ForceGraph3DModule.default as any
    const s = archSettings
    const graphDataObj = build3dData()

    graph3d = ForceGraph3DFn()(container)
      .graphData(graphDataObj)
      .backgroundColor(s.bgColor)
      .nodeLabel((node: any) => `${TYPE_LABELS[node.type] || node.type}: ${node.label}`)
      .nodeColor((node: any) => node.color)
      .nodeVal((node: any) => node.val)
      .nodeResolution(s.nodeResolution)
      .nodeOpacity(0.9)
      .linkColor((link: any) => link.color)
      .linkOpacity(s.edgeOpacity)
      .linkWidth(s.edgeWidth * 0.5)
      .linkDirectionalArrowLength(s.showArrows ? 4 : 0)
      .linkDirectionalArrowRelPos(1)
      .linkCurvature(s.linkCurvature)
      .linkDirectionalParticles(s.showParticles ? s.particleDensity : 0)
      .linkDirectionalParticleSpeed(s.particleSpeed)
      .linkDirectionalParticleWidth(1.5)
      .linkDirectionalParticleColor((link: any) => link.color)
      .d3Force('charge', null)
      .showNavInfo(false)
      .onNodeClick((node: any) => {
        const nodeInfo: SelectedNodeInfo = {
          id: node.id,
          label: node.label,
          type: node.type,
          path: node.path,
          route: node.route,
          lines: node.lines,
          methods: node.methods,
          exports: node.exports,
          columns: node.columns,
          description: node.description,
          tags: node.tags,
        }
        const connections: ConnectedNode[] = graphData.edges
          .filter((e) => e.source === node.id || e.target === node.id)
          .map((e) => {
            const otherId = e.source === node.id ? e.target : e.source
            const other = graphData.nodes.find((n) => n.id === otherId)
            return other ? { id: other.id, label: other.label, type: other.type } : null
          })
          .filter(Boolean)
          .filter((v: any, i: number, a: any[]) => a.findIndex((x: any) => x.id === v.id) === i) as ConnectedNode[]

        onselect(nodeInfo, connections)

        const distance = 200
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
        graph3d.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          node,
          1000,
        )
      })
      .onBackgroundClick(() => ondeselect())

    // Charge force
    const d3 = await import('d3-force-3d' as any)
    graph3d.d3Force('charge', d3.forceManyBody().strength(-s.repulsion * 0.02))
    graph3d.d3Force('link')?.distance(80 * s.spacing)

    // Ambient light
    const scene = graph3d.scene()
    if (_THREE) {
      const ambient = new _THREE.AmbientLight(0xffffff, s.ambientLight)
      ambient.name = 'settings-ambient'
      scene.add(ambient)
    }

    // Custom node objects
    graph3d.nodeThreeObject((node: any) => {
      if (!_THREE) return undefined
      const group = new _THREE.Group()
      const geo = new _THREE.SphereGeometry(
        Math.cbrt(node.val) * 4,
        s.nodeResolution,
        s.nodeResolution,
      )
      const mat = new _THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: s.glowStrength,
        roughness: 0.4,
        metalness: 0.1,
      })
      group.add(new _THREE.Mesh(geo, mat))

      if (s.showLabels) {
        const sprite = new _THREE.Sprite(
          new _THREE.SpriteMaterial({
            map: makeTextTexture(node.label),
            transparent: true,
            depthWrite: false,
          }),
        )
        sprite.scale.set(s.labelSize * 3, s.labelSize * 1.5, 1)
        sprite.position.set(0, Math.cbrt(node.val) * 5 + 4, 0)
        group.add(sprite)
      }

      return group
    })

    // Resize observer
    const resizeObs = new ResizeObserver(() => {
      if (graph3d && container) {
        graph3d.width(container.clientWidth).height(container.clientHeight)
      }
    })
    resizeObs.observe(container)

    cleanup = () => resizeObs.disconnect()
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  let mounted = false

  onMount(async () => {
    mounted = true
    await tick()
    if (mounted) await init()
  })

  onDestroy(() => {
    mounted = false
    if (graph3d) { graph3d._destructor?.(); graph3d = null }
    if (cleanup) cleanup()
  })

  // ── Reactive watchers ─────────────────────────────────────────

  // Structural changes → rebuild data
  let prevFiltersKey = ''
  $effect(() => {
    const key = JSON.stringify({ nf: nodeFilters, ef: edgeFilters })
    if (key !== prevFiltersKey && prevFiltersKey !== '') {
      updateData()
    }
    prevFiltersKey = key
  })

  // Style changes
  let prevStyleKey = ''
  $effect(() => {
    const key = JSON.stringify({
      eo: archSettings.edgeOpacity, ew: archSettings.edgeWidth,
      sa: archSettings.showArrows, sp2: archSettings.showParticles,
      ps: archSettings.particleSpeed, pd: archSettings.particleDensity,
      lc: archSettings.linkCurvature, bg: archSettings.bgColor,
      nr: archSettings.nodeResolution, gs: archSettings.glowStrength,
    })
    if (key !== prevStyleKey && prevStyleKey !== '') {
      updateStyle()
    }
    prevStyleKey = key
  })

  // Layout param changes → reheat
  let prevLayoutKey = ''
  $effect(() => {
    const key = JSON.stringify({
      sp: archSettings.spacing, rp: archSettings.repulsion,
    })
    if (key !== prevLayoutKey && prevLayoutKey !== '') {
      if (graph3d) {
        import('d3-force-3d' as any).then((d3: any) => {
          graph3d.d3Force('charge', d3.forceManyBody().strength(-archSettings.repulsion * 0.02))
          graph3d.d3Force('link')?.distance(80 * archSettings.spacing)
          graph3d.d3ReheatSimulation()
        })
      }
    }
    prevLayoutKey = key
  })
</script>

<div class="three-container" bind:this={container}></div>

<style>
  .three-container {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
    background: #0a0a0f;
  }
</style>
