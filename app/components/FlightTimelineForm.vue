<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { toAirportMenuItems } from '~/utils/airports'

const emit = defineEmits<{ submit: [airport: string] }>()

const schema = z.object({
  airport: z.string().min(1, 'Select a city')
})

const state = reactive({
  airport: ''
})

const loading = ref(false)
const airports = ref<string[]>([])

const airportItems = computed(() => toAirportMenuItems(airports.value))
const canSubmit = computed(() => Boolean(state.airport))

onMounted(async () => {
  loading.value = true
  try {
    const data = await $fetch<{ airports: string[] }>('/api/flights/timeline', {
      query: { options: '1' }
    })
    airports.value = data.airports
  } finally {
    loading.value = false
  }
})

async function onSubmit(event: FormSubmitEvent<z.infer<typeof schema>>) {
  emit('submit', event.data.airport)
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="flex flex-wrap items-end gap-3" @submit="onSubmit">
    <UFormField name="airport" label="City" class="min-w-72 flex-1">
      <UInputMenu
        v-model="state.airport"
        value-key="icao"
        :items="airportItems"
        :filter-fields="['label', 'icao', 'description']"
        placeholder="Select a city"
        icon="i-lucide-map-pin"
        :loading="loading && !airportItems.length"
        open-on-focus
      />
    </UFormField>

    <UButton type="submit" icon="i-lucide-list" :disabled="!canSubmit">
      Show timeline
    </UButton>
  </UForm>
</template>
