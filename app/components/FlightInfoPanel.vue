<script setup lang="ts">
import type { FlightWithSnapshot } from '~/types/flight'
import {
  formatAltitude,
  formatSpeed,
  formatUtcDateTime
} from '~/utils/formatFlight'

defineProps<{ flight: FlightWithSnapshot }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <UCard
    class="absolute top-4 right-4 z-10 w-80 shadow-lg"
    :ui="{ body: 'space-y-2 text-sm' }"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="font-semibold">
            {{ flight.flight_number }}
          </p>
          <p class="text-muted text-xs">
            {{ flight.origin_airport_icao }} → {{ flight.destination_airport_icao }}
          </p>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Close"
          @click="$emit('close')"
        />
      </div>
    </template>

    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt class="text-muted">
        Takeoff
      </dt>
      <dd>{{ formatUtcDateTime(flight.take_off_time) }}</dd>
      <dt class="text-muted">
        Landing
      </dt>
      <dd>{{ formatUtcDateTime(flight.scheduled_landing_time) }}</dd>
      <dt class="text-muted">
        Cruise alt
      </dt>
      <dd>{{ formatAltitude(flight.cruise_altitude_ft) }}</dd>
      <dt class="text-muted">
        Cruise speed
      </dt>
      <dd>{{ formatSpeed(flight.cruise_speed_kt) }}</dd>
      <dt class="text-muted">
        Status
      </dt>
      <dd>
        <UBadge :color="flight.is_airborne ? 'success' : 'warning'" variant="subtle">
          {{ flight.is_airborne ? 'Airborne' : 'On ground' }}
        </UBadge>
      </dd>
      <dt class="text-muted">
        Taken at:
      </dt>
      <dd>{{ formatUtcDateTime(flight.asked_at) }}</dd>
    </dl>
  </UCard>
</template>
