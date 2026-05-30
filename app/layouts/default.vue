<script setup lang="ts">
const route = useRoute()

const navItems = [
  { label: 'Route', to: '/', icon: 'i-lucide-map' },
  { label: 'Timeline', to: '/timeline', icon: 'i-lucide-list' },
  { label: 'Ops', to: '/ops', icon: 'i-lucide-radar' }
]

function isActive(to: string) {
  return route.path === to
}
</script>

<template>
  <div class="bg-default text-default flex h-screen flex-col">
    <header class="border-default bg-default z-20 shrink-0 border-b px-4 py-3">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/"
            class="text-highlighted text-lg font-semibold hover:opacity-80"
          >
            4D Flight Visualization
          </NuxtLink>
          <nav class="flex items-center gap-1">
            <UButton
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              color="neutral"
              :variant="isActive(item.to) ? 'soft' : 'ghost'"
              size="sm"
              :icon="item.icon"
            >
              {{ item.label }}
            </UButton>
          </nav>
        </div>
        <UColorModeButton />
      </div>
    </header>

    <slot />
  </div>
</template>
