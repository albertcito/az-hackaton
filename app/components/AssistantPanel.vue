<script setup lang="ts">
const store = useOpsStore()
const { messages, sending, send, reset } = useAssistant()

const open = ref(true)
const draft = ref('')
const threadRef = ref<HTMLElement | null>(null)

const suggestions = computed(() => {
  const top = store.hotspots.value[0]?.sector?.name
  const list: string[] = []
  if (top) list.push(`Why is ${top} over capacity right now?`)
  list.push('Which hotspots are weather-driven?')
  list.push('Summarize the network at the most stressed moment.')
  return list
})

async function submit(text?: string) {
  const msg = (text ?? draft.value).trim()
  if (!msg) return
  draft.value = ''
  await send(msg)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

watch(
  () => [messages.value.length, messages.value[messages.value.length - 1]?.text] as const,
  async () => {
    await nextTick()
    if (threadRef.value) threadRef.value.scrollTop = threadRef.value.scrollHeight
  },
)
</script>

<template>
  <div class="glass-panel-strong panel-rise flex flex-col overflow-hidden">
    <!-- header -->
    <button
      type="button"
      class="flex w-full cursor-pointer items-center justify-between border-b border-[var(--glass-border)] px-4 py-2.5 text-left"
      @click="open = !open"
    >
      <div class="flex items-center gap-2">
        <span class="relative flex size-2.5">
          <span class="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400/60" />
          <span class="relative inline-flex size-2.5 rounded-full bg-cyan-400" />
        </span>
        <h2 class="text-sm font-semibold text-zinc-100">Flow Assistant</h2>
        <span class="font-data text-[10px] text-zinc-500">Claude</span>
      </div>
      <div class="flex items-center gap-2">
        <UIcon
          v-if="messages.length"
          name="i-lucide-rotate-ccw"
          class="size-3.5 text-zinc-500 hover:text-zinc-200"
          @click.stop="reset"
        />
        <UIcon :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'" class="size-4 text-zinc-400" />
      </div>
    </button>

    <div v-if="open" class="flex min-h-0 flex-1 flex-col">
      <!-- thread -->
      <div ref="threadRef" class="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <div v-if="!messages.length" class="space-y-2">
          <p class="text-xs text-zinc-500">Ask about any sector, flight, or the weather driving congestion.</p>
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="transition-console block w-full cursor-pointer rounded-lg border border-[var(--glass-border)] px-3 py-2 text-left text-xs text-zinc-300 hover:border-cyan-400/40 hover:bg-cyan-500/5"
            @click="submit(s)"
          >
            {{ s }}
          </button>
        </div>

        <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
          <div class="max-w-[85%]">
            <div
              class="rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
              :class="m.role === 'user'
                ? 'bg-cyan-500/15 text-cyan-50'
                : m.error ? 'bg-red-500/10 text-red-200' : 'bg-white/[0.05] text-zinc-100'"
            >
              <span v-if="m.text">{{ m.text }}</span>
              <span v-else-if="m.role === 'assistant' && sending" class="inline-flex gap-1">
                <span class="size-1.5 animate-bounce rounded-full bg-zinc-400" style="animation-delay: 0ms" />
                <span class="size-1.5 animate-bounce rounded-full bg-zinc-400" style="animation-delay: 120ms" />
                <span class="size-1.5 animate-bounce rounded-full bg-zinc-400" style="animation-delay: 240ms" />
              </span>
            </div>
            <div v-if="m.tools.length" class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="(t, ti) in m.tools"
                :key="ti"
                class="font-data inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400"
              >
                <UIcon name="i-lucide-wrench" class="size-2.5" />{{ t.name }}<span v-if="t.input?.sector" class="text-cyan-300/80">{{ t.input.sector }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- input -->
      <div class="border-t border-[var(--glass-border)] p-2">
        <div class="flex items-end gap-2 rounded-xl border border-[var(--glass-border)] bg-black/30 px-2 py-1.5 focus-within:border-cyan-400/40">
          <textarea
            v-model="draft"
            rows="1"
            placeholder="Ask the flow assistant…"
            class="font-sans max-h-24 min-h-[20px] flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
            :disabled="sending"
            @keydown="onKey"
          />
          <button
            type="button"
            class="transition-console flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-40"
            :disabled="sending || !draft.trim()"
            @click="submit()"
          >
            <UIcon :name="sending ? 'i-lucide-loader-circle' : 'i-lucide-arrow-up'" class="size-4" :class="sending ? 'animate-spin' : ''" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
