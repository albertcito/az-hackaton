const MIN_VIEW_MS = 30 * 60 * 1000

export function useTimelineZoom(
  fullStartIso: Ref<string>,
  fullEndIso: Ref<string>,
  currentTime: Ref<string>
) {
  const viewStartMs = ref(0)
  const viewEndMs = ref(0)

  const fullStartMs = computed(() => new Date(fullStartIso.value).getTime())
  const fullEndMs = computed(() => new Date(fullEndIso.value).getTime())

  const viewStartIso = computed(() => new Date(viewStartMs.value).toISOString())
  const viewEndIso = computed(() => new Date(viewEndMs.value).toISOString())

  const isZoomed = computed(() =>
    viewStartMs.value !== fullStartMs.value || viewEndMs.value !== fullEndMs.value
  )

  function resetView() {
    if (!Number.isFinite(fullStartMs.value) || !Number.isFinite(fullEndMs.value)) {
      viewStartMs.value = 0
      viewEndMs.value = 0
      return
    }
    viewStartMs.value = fullStartMs.value
    viewEndMs.value = fullEndMs.value
  }

  function clampCurrentTime() {
    const ms = new Date(currentTime.value).getTime()
    if (!Number.isFinite(ms)) return
    const clamped = Math.min(Math.max(ms, viewStartMs.value), viewEndMs.value)
    if (clamped !== ms) {
      currentTime.value = new Date(clamped).toISOString()
    }
  }

  function setViewRange(startMs: number, endMs: number) {
    const fullSpan = fullEndMs.value - fullStartMs.value
    const span = Math.min(fullSpan, Math.max(MIN_VIEW_MS, endMs - startMs))
    let start = startMs
    let end = start + span

    if (start < fullStartMs.value) {
      start = fullStartMs.value
      end = start + span
    }
    if (end > fullEndMs.value) {
      end = fullEndMs.value
      start = end - span
    }

    viewStartMs.value = start
    viewEndMs.value = end
    clampCurrentTime()
  }

  function zoom(factor: number, anchorMs?: number) {
    if (!Number.isFinite(fullStartMs.value) || !Number.isFinite(fullEndMs.value)) return

    const anchor = anchorMs ?? new Date(currentTime.value).getTime()
    const safeAnchor = Number.isFinite(anchor) ? anchor : (viewStartMs.value + viewEndMs.value) / 2
    const span = viewEndMs.value - viewStartMs.value
    const ratio = span > 0 ? (safeAnchor - viewStartMs.value) / span : 0.5
    const newSpan = Math.min(
      fullEndMs.value - fullStartMs.value,
      Math.max(MIN_VIEW_MS, span * factor)
    )

    setViewRange(safeAnchor - newSpan * ratio, safeAnchor - newSpan * ratio + newSpan)
  }

  function zoomIn(anchorMs?: number) {
    zoom(0.5, anchorMs)
  }

  function zoomOut(anchorMs?: number) {
    zoom(2, anchorMs)
  }

  function resetZoom() {
    resetView()
    clampCurrentTime()
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    if (event.deltaY < 0) zoomIn()
    else zoomOut()
  }

  watch([fullStartMs, fullEndMs], resetView, { immediate: true })

  return {
    viewStartMs,
    viewEndMs,
    viewStartIso,
    viewEndIso,
    isZoomed,
    zoomIn,
    zoomOut,
    resetZoom,
    onWheel
  }
}
