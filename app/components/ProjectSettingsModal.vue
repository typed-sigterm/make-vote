<script setup lang="ts">
import type { VoteProject } from '~~/shared/project';

const open = defineModel<boolean>('open', { required: true });
const project = defineModel<VoteProject>('project', { required: true });
</script>

<template>
  <UModal v-model:open="open" title="项目设置" description="修改立即生效，关闭弹窗后请保存项目文件。">
    <template #body>
      <div class="grid gap-5">
        <UFormField label="项目名称" description="用于项目文件名，不影响选票画布标题">
          <UInput v-model="project.title" maxlength="100" class="w-full" />
        </UFormField>
        <UFormField label="项目 GUID" description="可使用任意非空标识文本，二维码和后续验证会使用此值">
          <UInput v-model="project.guid" maxlength="200" autocomplete="off" autocapitalize="none" spellcheck="false" class="w-full font-mono" />
        </UFormField>
        <UAlert title="修改 GUID 的影响" :description="project.exports.length ? '已发行选票及其重新下载仍保留旧 GUID；新导出会使用新 GUID。不同 GUID 的选票会被识别为不同项目，请确认验证工具读取正确标识。' : '后续二维码和验证将使用新 GUID。请确保其他验证工具使用相同标识。'" color="warning" icon="i-lucide-triangle-alert" />
        <UFormField label="纸张尺寸">
          <USelect v-model="project.paper.size" :items="[{ label: 'A5 · 148 × 210 mm', value: 'A5' }, { label: 'A4 · 210 × 297 mm', value: 'A4' }]" class="w-full" />
        </UFormField>
        <UFormField label="纸张方向">
          <USelect v-model="project.paper.orientation" :items="[{ label: '纵向', value: 'portrait' }, { label: '横向', value: 'landscape' }]" class="w-full" />
        </UFormField>
        <UFormField label="页边距（mm）">
          <UInputNumber v-model="project.paper.margin" :min="8" :max="35" :step="1" class="w-full" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <UButton label="完成" @click="open = false" />
    </template>
  </UModal>
</template>
