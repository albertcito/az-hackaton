const DEFAULT_PLAYBACK_SPEED = 60

export function useFlightAnimation(
  startIso: Ref<string>,
  endIso: Ref<string>,
  currentTime: Ref<string>,
  speedMultiplier = DEFAULT_PLAYBACK_SPEED
) {
  const playing = ref(false)
  let frameId: number | null = null
  let lastTs: number | null = null

  function stop() {
    playing.value = false
    if (frameId !== null) cancelAnimationFrame(frameId)
    frameId = null
    lastTs = null
  }

  function tick(ts: number) {
    if (!playing.value) return
    if (lastTs === null) lastTs = ts

    const elapsed = ts - lastTs
    lastTs = ts
    const startMs = new Date(startIso.value).getTime()
    const endMs = new Date(endIso.value).getTime()
    const currentMs = new Date(currentTime.value).getTime()
    const nextMs = Math.min(currentMs + elapsed * speedMultiplier, endMs)

    currentTime.value = new Date(nextMs).toISOString()
    if (nextMs >= endMs) {
      stop()
      return
    }

    frameId = requestAnimationFrame(tick)
  }

  function play() {
    if (playing.value) return
    playing.value = true
    lastTs = null
    frameId = requestAnimationFrame(tick)
  }

  function pause() {
    stop()
  }

  onUnmounted(stop)

  return { playing, play, pause }
}
