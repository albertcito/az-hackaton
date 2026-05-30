<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const emit = defineEmits<{ submit: [flightId: string] }>()

const schema = z.object({
  flightId: z.string().min(1, 'Select a flight')
})

const state = reactive({ flightId: '' })
const searchTerm = ref('')
const { items, loading, search } = useFlightSearch()

watch(searchTerm, (q) => search(q))

async function onSubmit(event: FormSubmitEvent<z.infer<typeof schema>>) {
  emit('submit', event.data.flightId)
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="flex flex-wrap items-end gap-3" @submit="onSubmit">
    <UFormField name="flightId" label="Flight number" class="min-w-72 flex-1">
      <UInputMenu
        v-model="state.flightId"
        v-model:search-term="searchTerm"
        value-key="id"
        :items="items"
        ignore-filter
        :loading="loading"
        icon="i-lucide-plane"
        placeholder="Search flight number (e.g. UAL2367)"
        open-on-focus
      />
    </UFormField>
    <UButton type="submit" icon="i-lucide-search">
      Track flight
    </UButton>
  </UForm>
</template>
