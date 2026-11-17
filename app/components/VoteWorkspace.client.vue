<script setup lang="ts">
import type { ExportBatch } from '~~/shared/project';
import { commitExport, createExportBatch, exportRequestSchema, formatSerial } from '~~/shared/project';
import { downloadFile, renderPrintDocument, safeFilename } from '~/utils/print';

const { project, dirty, saving, editorSession, saveProject, report } = useVoteProject();
const editor = useTemplateRef('editor');
const toast = useToast();
const view = ref<'design' | 'records' | 'statistics'>('design');
const settingsOpen = ref(false);
const markdownOpen = ref(false);
const markdown = ref('');
const imageOpen = ref(false);
const imageState = reactive({ src: '', alt: '' });
const exportOpen = ref(false);
const exportState = reactive({ copies: 10 });
const exporting = ref(false);
const selectedBatch = ref<string>();
const selected = computed(() => project.value.exports.find(batch => batch.id === selectedBatch.value));
const issued = computed(() => project.value.exports.reduce((sum, batch) => sum + batch.ballots.length, 0));
const confirmation = ref<{ title: string, description: string, action: () => void }>();
const confirmationOpen = computed({
  get: () => !!confirmation.value,
  set: (value) => {
    if (!value)
      confirmation.value = undefined;
  },
});
function confirmAction() {
  const action = confirmation.value?.action;
  confirmation.value = undefined;
  action?.();
}
function focusCancel(event: Event) {
  if (event.target instanceof HTMLElement) {
    const cancel = event.target.querySelector<HTMLButtonElement>('[data-cancel]');
    if (cancel) {
      event.preventDefault();
      cancel.focus();
    }
  }
}
function insertMarkdown() {
  if (!markdown.value.trim())
    return;
  editor.value?.insertMarkdown(markdown.value);
  markdown.value = '';
  markdownOpen.value = false;
}
function insertImage() {
  try {
    if (new URL(imageState.src).protocol !== 'https:')
      throw new Error('图片仅支持 HTTPS 地址');
    editor.value?.insertImage(imageState.src, imageState.alt);
    imageOpen.value = false;
    imageState.src = '';
    imageState.alt = '';
  } catch (error) {
    report(error);
  }
}
async function exportBallots() {
  if (exporting.value)
    return;
  exporting.value = true;
  try {
    const snapshot = JSON.parse(JSON.stringify(project.value));
    const batch = createExportBatch(snapshot, exportState.copies);
    const html = await renderPrintDocument(batch);
    // Commit the batch before handing out printable ballots. Failures do not consume numbers.
    project.value = commitExport(project.value, batch);
    selectedBatch.value = batch.id;
    downloadFile(html, `${safeFilename(batch.title)}-${formatSerial(batch.ballots[0]!.serial)}.html`, 'text/html;charset=utf-8');
    exportOpen.value = false;
    toast.add({
      title: `已生成 ${batch.ballots.length} 份选票`,
      description: '打开下载的 HTML 即可打印或另存为 PDF。请保存项目以保留本批编号。',
      color: 'success',
      duration: 10000,
    });
  } catch (error) {
    report(error);
  } finally {
    exporting.value = false;
  }
}
async function redownload(batch: ExportBatch) {
  if (exporting.value)
    return;
  exporting.value = true;
  try {
    const html = await renderPrintDocument(batch);
    downloadFile(html, `${safeFilename(batch.title)}-${formatSerial(batch.ballots[0]!.serial)}.html`, 'text/html;charset=utf-8');
  } catch (error) {
    report(error);
  } finally {
    exporting.value = false;
  }
}
function removeBatch(batch: ExportBatch) {
  confirmation.value = {
    title: '删除这批导出记录？',
    description: `将移除 ${batch.ballots.length} 份选票的编号和排版快照，后续将无法通过此项目验证这些编号。序列号继续递增，不会回退。`,
    action: () => {
      project.value.exports = project.value.exports.filter(item => item.id !== batch.id);
      if (selectedBatch.value === batch.id)
        selectedBatch.value = undefined;
    },
  };
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function keydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !event.isComposing) {
    event.preventDefault();
    void saveProject(event.shiftKey);
  }
}
onMounted(() => window.addEventListener('keydown', keydown));
onBeforeUnmount(() => window.removeEventListener('keydown', keydown));
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <a href="#main-content" class="fixed -top-20 left-4 z-50 bg-white p-3 focus:top-3">跳转到编辑区</a>
    <header class="flex min-h-16 flex-wrap items-center gap-4 border-b border-default bg-default px-6 py-3 max-sm:px-4">
      <UButton to="/" label="返回首页" icon="i-lucide-arrow-left" color="neutral" variant="ghost" />
      <div class="flex min-w-0 flex-wrap items-center gap-2 text-sm max-lg:hidden">
        <span class="max-w-[25vw] truncate">{{ project.title || '未命名投票' }}</span><span class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted"><span class="size-1.5 rounded-full" :class="dirty ? 'bg-amber-500' : 'bg-primary'" />{{ dirty ? '未保存' : '已保存' }}</span>
      </div>
      <div class="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:justify-between max-sm:gap-1">
        <UButton label="项目设置" icon="i-lucide-settings-2" color="neutral" variant="ghost" @click="settingsOpen = true" />
        <UButton label="保存项目" icon="i-lucide-save" color="neutral" variant="outline" :loading="saving" title="保存 Ctrl+S · 另存为 Ctrl+Shift+S" @click="saveProject()" />
        <UButton label="导出选票" icon="i-lucide-arrow-up-right" :loading="exporting" @click="exportOpen = true" />
      </div>
    </header>
    <WorkspaceTabs v-model="view" :records="project.exports.length" />
    <main id="main-content" tabindex="-1" class="min-w-0 flex-1">
      <div v-show="view === 'design'" class="grid min-h-[calc(100dvh-120px)] grid-cols-1">
        <BallotEditor ref="editor" :key="editorSession" v-model="project.document" :paper="project.paper" @insert-option="editor?.insert('ballotOption', { style: 'fill' })" @insert-image="imageOpen = true" @insert-markdown="markdownOpen = true" />
      </div>
      <section v-if="view === 'records'" class="mx-auto max-w-6xl p-8 max-sm:p-4" aria-labelledby="records-title">
        <div class="mb-8 flex flex-wrap items-center justify-between gap-5">
          <div>
            <p class="font-mono text-xs text-primary">
              ISSUANCE HISTORY
            </p><h1 id="records-title" class="mt-3 text-2xl font-semibold">
              每一张选票，都有迹可循。
            </h1><p class="mt-3 text-sm text-muted">
              已保留 {{ project.exports.length }} 个批次，共 {{ issued }} 份选票。重新下载使用原编号与排版。
            </p>
          </div><UButton label="导出新批次" icon="i-lucide-plus" @click="exportOpen = true" />
        </div>
        <div v-if="!project.exports.length" class="grid justify-items-center gap-4 border border-dashed border-default bg-default px-5 py-20 text-center">
          <UIcon name="i-lucide-files" class="size-10 text-primary" /><h2 class="text-lg font-semibold">
            准备好发行第一批选票了吗？
          </h2><p class="mb-2 text-sm text-muted">
            导出后，序列号、唯一编号和版式会出现在这里。
          </p><UButton label="回到选票设计" variant="outline" @click="view = 'design'" />
        </div>
        <div v-else class="grid gap-3">
          <article v-for="batch in [...project.exports].reverse()" :key="batch.id" class="flex flex-wrap items-center justify-between gap-4 border border-default bg-default p-4">
            <div class="flex items-center gap-3">
              <span class="grid size-10 place-items-center bg-elevated text-primary"><UIcon name="i-lucide-file-check-2" /></span><div>
                <h2 class="text-sm font-semibold">
                  {{ batch.title }}
                </h2><p class="mt-1 text-xs text-muted">
                  {{ dateLabel(batch.createdAt) }} · {{ batch.ballots.length }} 份 · {{ formatSerial(batch.ballots[0]!.serial) }} — {{ formatSerial(batch.ballots.at(-1)!.serial) }}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton label="查看编号" variant="ghost" color="neutral" @click="selectedBatch = selectedBatch === batch.id ? undefined : batch.id" /><UButton label="重新下载" icon="i-lucide-download" variant="outline" color="neutral" :loading="exporting" @click="redownload(batch)" /><UButton aria-label="删除批次记录" icon="i-lucide-trash-2" variant="ghost" color="error" @click="removeBatch(batch)" />
            </div>
            <div v-if="selected?.id === batch.id" class="max-h-96 w-full overflow-auto border-t border-default">
              <table class="w-full table-auto text-left font-mono text-sm">
                <caption class="sr-only">
                  本批序列号与唯一编号
                </caption><thead class="bg-elevated">
                  <tr>
                    <th class="border-b border-default px-4 py-2 font-medium">
                      序列号
                    </th><th class="border-b border-default px-4 py-2 font-medium">
                      唯一编号
                    </th>
                  </tr>
                </thead><tbody>
                  <tr v-for="ballot in batch.ballots" :key="ballot.serial">
                    <td class="border-b border-default px-4 py-2">
                      {{ formatSerial(ballot.serial) }}
                    </td><td class="border-b border-default px-4 py-2">
                      {{ ballot.unique }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>
      <section v-if="view === 'statistics'" class="mx-auto max-w-5xl p-8" aria-labelledby="statistics-title">
        <h1 id="statistics-title" class="text-2xl font-semibold">
          结果统计
        </h1><p class="mt-3 text-muted">
          WIP
        </p>
      </section>
    </main>
    <UModal v-model:open="exportOpen" title="发行一批新的选票" description="每份选票使用不同的序列号、随机数字编号和对应二维码。" :dismissible="!exporting" :close="!exporting">
      <template #body>
        <UForm id="export-form" :schema="exportRequestSchema" :state="exportState" :validate-on="['blur']" @submit="exportBallots">
          <UFormField label="导出份数" name="copies" description="每批 1–1000 份；打印时每张选票仅需打印 1 份。" required>
            <UInputNumber v-model="exportState.copies" :min="1" :max="1000" class="w-full" :disabled="exporting" />
          </UFormField><div class="my-5 grid gap-2.5 rounded-md bg-elevated p-4 text-xs">
            <p>起始序列号 <strong>{{ formatSerial(project.nextSerial) }}</strong></p><p>打印格式 <strong>{{ project.paper.size }} · {{ project.paper.orientation === 'portrait' ? '纵向' : '横向' }} · HTML</strong></p>
          </div><UAlert title="导出后请保存项目" description="本次编号会加入项目记录，并标记为未保存。下载的 HTML 可离线打印，也可在打印对话框中另存为 PDF。" icon="i-lucide-info" color="neutral" variant="subtle" />
        </UForm>
      </template>
      <template #footer>
        <UButton type="submit" form="export-form" label="生成并下载选票" icon="i-lucide-download" :loading="exporting" />
        <UButton label="取消" color="neutral" variant="ghost" :disabled="exporting" @click="exportOpen = false" />
      </template>
    </UModal>
    <UModal v-model:open="markdownOpen" title="插入 Markdown 内容" description="在当前光标位置插入，并转换为可编辑的富文本。项目始终保存为 Tiptap JSON。">
      <template #body>
        <UFormField label="Markdown 文本">
          <UTextarea v-model="markdown" :rows="10" class="w-full font-mono" placeholder="# 投票标题" />
        </UFormField>
      </template>
      <template #footer>
        <UButton label="插入富文本" @click="insertMarkdown" />
        <UButton label="取消" variant="ghost" color="neutral" @click="markdownOpen = false" />
      </template>
    </UModal>
    <UModal v-model:open="imageOpen" title="插入网络图片" description="输入可公开访问的 HTTPS 图片地址。">
      <template #body>
        <div class="grid gap-4">
          <UFormField label="HTTPS 图片地址" required>
            <UInput v-model="imageState.src" type="url" inputmode="url" autocomplete="url" autocapitalize="none" spellcheck="false" placeholder="https://example.com/image.jpg" class="w-full" />
          </UFormField>
          <UFormField label="替代文本">
            <UInput v-model="imageState.alt" maxlength="500" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <UButton label="插入图片" icon="i-lucide-image-plus" @click="insertImage" />
        <UButton label="取消" color="neutral" variant="ghost" @click="imageOpen = false" />
      </template>
    </UModal>
    <ProjectSettingsModal v-model:open="settingsOpen" v-model:project="project" />
    <UModal v-model:open="confirmationOpen" :title="confirmation?.title" :description="confirmation?.description" :content="{ onOpenAutoFocus: focusCancel }">
      <template #footer>
        <UButton label="确认继续" color="error" @click="confirmAction" />
        <UButton data-cancel label="取消" color="neutral" variant="outline" @click="confirmation = undefined" />
      </template>
    </UModal>
  </div>
</template>
