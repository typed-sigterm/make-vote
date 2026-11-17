<script setup lang="ts">
const props = defineProps<{ records: number }>();
const view = defineModel<'design' | 'records' | 'statistics'>({ required: true });
const tabs = [
  { id: 'design', label: '选票设计', icon: 'i-lucide-panels-top-left' },
  { id: 'records', label: '导出记录', icon: 'i-lucide-history' },
  { id: 'statistics', label: '结果统计', icon: 'i-lucide-chart-no-axes-column-increasing' },
] as const;
</script>

<template>
  <div class="flex min-h-14 items-stretch justify-between gap-4 border-b border-default bg-default px-7 max-sm:px-4">
    <nav aria-label="工作台" class="flex gap-7 max-sm:gap-4">
      <button v-for="tab in tabs" :key="tab.id" type="button" class="flex items-center gap-2 border-b-2 px-0.5 text-sm text-muted transition-colors" :class="view === tab.id ? 'border-primary text-primary font-semibold' : 'border-transparent hover:text-default'" :aria-current="view === tab.id ? 'page' : undefined" @click="view = tab.id">
        <UIcon :name="tab.icon" />{{ tab.label }}<span v-if="tab.id === 'records'" class="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs">{{ props.records }}</span>
      </button>
    </nav>
    <span class="flex items-center gap-2 text-xs text-muted max-sm:hidden"><UIcon name="i-lucide-hard-drive" />数据只留在你的设备</span>
  </div>
</template>
