<script setup lang="ts">
import type { SectorTraffic } from '~/types/sector'
import { formatAltitude } from '~/utils/formatFlight'

const props = defineProps<{
  traffic: SectorTraffic | null
  loading: boolean
}>()

defineEmits<{ select: [id: string] }>()

const sector = computed(() => props.traffic?.sector ?? null)
</script>

<template>
  <UCard
    class="absolute top-4 left-4 z-10 w-72 shadow-lg"
    :ui="{ body: 'space-y-2 text-sm' }"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <p class="font-semibold">
          Sector traffic
        </p>
        <UIcon
          v-if="loading"
          name="i-lucide-loader-circle"
          class="text-muted size-4 animate-spin"
        />
      </div>
    </template>

    <p v-if="!sector" class="text-muted">
      {{ traffic ? 'Outside sector coverage at this time.' : 'Scrub the timeline to see the flight\'s sector.' }}
    </p>

    <template v-else>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt class="text-muted">
          Sector
        </dt>
        <dd class="font-medium">
          {{ sector.name }}
          <UBadge color="neutral" variant="subtle" size="xs" class="ml-1">
            {{ sector.band }}
          </UBadge>
        </dd>
        <dt class="text-muted">
          Altitude
        </dt>
        <dd>{{ formatAltitude(sector.altitudeFromFt) }}–{{ formatAltitude(sector.altitudeToFt) }}</dd>
        <dt class="text-muted">
          Occupancy
        </dt>
        <dd class="font-medium tabular-nums">
          {{ traffic!.count }} / {{ sector.capacity }}
          <UBadge
            :color="traffic!.overDemand ? 'error' : 'success'"
            variant="subtle"
            size="xs"
            class="ml-1"
          >
            {{ traffic!.overDemand ? 'Over-demand' : 'OK' }}
          </UBadge>
        </dd>
      </dl>

      <div class="border-default border-t pt-2">
        <p class="text-muted mb-1 font-medium">
          Other flights here ({{ traffic!.others.length }})
        </p>
        <p v-if="traffic!.others.length === 0" class="text-muted">
          No other flights in this sector right now.
        </p>
        <ul v-else class="max-h-48 space-y-0.5 overflow-y-auto">
          <li v-for="other in traffic!.others" :key="other.id">
            <button
              type="button"
              class="hover:bg-elevated flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left"
              @click="$emit('select', other.id)"
            >
              <span class="font-medium">{{ other.flightNumber }}</span>
              <span class="text-muted text-xs">{{ other.origin }} → {{ other.destination }}</span>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </UCard>
</template>
