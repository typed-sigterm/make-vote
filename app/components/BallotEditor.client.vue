<script setup lang="ts">
import type { JSONContent } from '@tiptap/core';
import type { DocumentNode, Paper } from '~~/shared/project';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { ballotExtensions } from '~/utils/ballot-extensions';
import { paperDimensions } from '~/utils/print';

const props = defineProps<{ modelValue: DocumentNode, paper: Paper }>();
const emit = defineEmits<{ 'update:modelValue': [value: DocumentNode], 'insertOption': [], 'insertImage': [], 'insertMarkdown': [] }>();
const revision = ref(0);
const zoom = ref('100');
const editor = useEditor({
  extensions: ballotExtensions(),
  content: props.modelValue as JSONContent,
  editorProps: {
    attributes: {
      'class': 'ballot-content',
      'role': 'textbox',
      'aria-multiline': 'true',
      'aria-label': '选票富文本编辑器',
      'spellcheck': 'false',
    },
  },
  onUpdate: ({ editor: instance }) => emit('update:modelValue', instance.getJSON() as DocumentNode),
  onTransaction: () => revision.value++,
});
const dimensions = computed(() => paperDimensions(props.paper));
const sheetStyle = computed(() => ({
  width: `${dimensions.value[0]}mm`,
  minHeight: `${dimensions.value[1]}mm`,
  padding: `${props.paper.margin}mm`,
  zoom: Number(zoom.value) / 100,
}));
function active(name: string, attrs?: Record<string, unknown>) {
  void revision.value;
  return editor.value?.isActive(name, attrs)
    ? 'primary'
    : 'neutral';
}
watch(() => props.modelValue, (value) => {
  if (editor.value && JSON.stringify(editor.value.getJSON()) !== JSON.stringify(value)) {
    editor.value.commands.setContent(value as JSONContent, { emitUpdate: false, errorOnInvalidContent: true });
  }
});
function insert(type: string, attrs?: Record<string, unknown>) {
  const node: JSONContent = { type, attrs };
  if (type === 'ballotOption') {
    node.content = [
      { type: 'text', text: '新的投票选项' },
    ];
  }
  editor.value?.chain().focus().insertContent(node).run();
}
function insertMarkdown(source: string) {
  editor.value?.chain().focus().insertContent(source, { contentType: 'markdown' }).run();
}
function insertTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
}
function insertImage(src: string, alt: string) {
  editor.value?.chain().focus().insertContent({
    type: 'image',
    attrs: { src, alt },
  }).run();
}
function changeFontSize(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (value)
    editor.value?.chain().focus().setFontSize(value).run();
  else editor.value?.chain().focus().unsetFontSize().run();
}
defineExpose({
  insert,
  insertMarkdown,
  insertTable,
  insertImage,
});
</script>

<template>
  <section class="relative flex min-w-0 flex-col bg-[#f1f4f3]" aria-label="选票设计">
    <div v-if="editor" class="flex min-h-14 flex-wrap items-center justify-center gap-px border-b border-default bg-default px-3 py-2 max-md:justify-start" role="toolbar" aria-label="文本格式" @mousedown.prevent>
      <UButton aria-label="撤销" title="撤销 Ctrl+Z" icon="i-lucide-undo-2" color="neutral" variant="ghost" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()" />
      <UButton aria-label="重做" title="重做 Ctrl+Shift+Z" icon="i-lucide-redo-2" color="neutral" variant="ghost" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()" />
      <span class="mx-1 h-4 w-px bg-default" />
      <UButton aria-label="插入填写框" icon="i-lucide-square" color="neutral" variant="ghost" @click="emit('insertOption')" />
      <UButton aria-label="插入序列号" icon="i-lucide-hash" color="neutral" variant="ghost" @click="insert('ballotNumber', { kind: 'serial' })" />
      <UButton aria-label="插入唯一编号" icon="i-lucide-fingerprint" color="neutral" variant="ghost" @click="insert('ballotNumber', { kind: 'unique' })" />
      <UButton aria-label="插入二维码" icon="i-lucide-qr-code" color="neutral" variant="ghost" @click="insert('ballotQr')" />
      <UButton aria-label="插入表格" icon="i-lucide-table-2" color="neutral" variant="ghost" @click="insertTable" />
      <UButton aria-label="插入分隔线" icon="i-lucide-minus" color="neutral" variant="ghost" @click="insert('horizontalRule')" />
      <UButton aria-label="插入分页符" icon="i-lucide-file-plus-2" color="neutral" variant="ghost" @click="insert('pageBreak')" />
      <UButton aria-label="插入图片" icon="i-lucide-image-plus" color="neutral" variant="ghost" @click="emit('insertImage')" />
      <UButton aria-label="插入富文本" icon="i-lucide-text" color="neutral" variant="ghost" @click="emit('insertMarkdown')" />
      <span class="mx-1 h-4 w-px bg-default" />
      <UButton label="正文" color="neutral" variant="ghost" @click="editor.chain().focus().setParagraph().run()" />
      <UButton label="H1" :color="active('heading', { level: 1 })" variant="ghost" aria-label="一级标题" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" />
      <UButton label="H2" :color="active('heading', { level: 2 })" variant="ghost" aria-label="二级标题" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" />
      <select aria-label="字号" class="max-w-24 rounded border border-default bg-default px-2 py-1 text-xs text-muted focus-visible:outline-2 focus-visible:outline-primary" :value="editor.getAttributes('textStyle').fontSize || ''" @mousedown.stop @change="changeFontSize">
        <option value="">
          默认字号
        </option>
        <option v-for="size in ['12px', '14px', '16px', '18px', '20px', '24px', '32px']" :key="size" :value="size">
          {{ size }}
        </option>
      </select>
      <span class="mx-1 h-4 w-px bg-default" />
      <UButton icon="i-lucide-bold" :color="active('bold')" variant="ghost" aria-label="加粗" title="加粗 Ctrl+B" @click="editor.chain().focus().toggleBold().run()" />
      <UButton icon="i-lucide-italic" :color="active('italic')" variant="ghost" aria-label="斜体" @click="editor.chain().focus().toggleItalic().run()" />
      <UButton icon="i-lucide-underline" :color="active('underline')" variant="ghost" aria-label="下划线" @click="editor.chain().focus().toggleUnderline().run()" />
      <span class="mx-1 h-4 w-px bg-default" />
      <UButton v-for="alignment in (['left', 'center', 'right'] as const)" :key="alignment" :icon="`i-lucide-align-${alignment}`" color="neutral" variant="ghost" :aria-label="{ left: '左对齐', center: '居中', right: '右对齐' }[alignment]" @click="editor.chain().focus().setTextAlign(alignment).run()" />
      <UButton icon="i-lucide-list" color="neutral" variant="ghost" aria-label="无序列表" @click="editor.chain().focus().toggleBulletList().run()" />
      <UButton icon="i-lucide-list-ordered" color="neutral" variant="ghost" aria-label="有序列表" @click="editor.chain().focus().toggleOrderedList().run()" />
      <UButton icon="i-lucide-remove-formatting" color="neutral" variant="ghost" aria-label="清除格式" @click="editor.chain().focus().unsetAllMarks().clearNodes().run()" />
    </div>
    <div class="flex items-center justify-between gap-3 px-6 py-4 text-xs text-muted max-sm:px-4">
      <span><span class="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />选票画布 <span class="ml-2">点击内容即可编辑</span></span>
      <div class="flex items-center gap-3">
        <span>{{ paper.size }} · {{ dimensions[0] }} × {{ dimensions[1] }} mm</span>
        <select v-model="zoom" aria-label="画布缩放" class="rounded border border-default bg-default px-2 py-1 text-xs text-muted focus-visible:outline-2 focus-visible:outline-primary">
          <option value="60">
            60%
          </option><option value="80">
            80%
          </option><option value="100">
            100%
          </option><option value="120">
            120%
          </option>
        </select>
      </div>
    </div>
    <div class="flex-1 overflow-auto px-7 pb-6 max-sm:px-3">
      <div class="mx-auto box-border border border-gray-200 bg-white shadow-sm" :style="sheetStyle">
        <EditorContent :editor="editor" />
      </div>
    </div>
    <div v-if="editor?.isActive('table')" class="flex flex-wrap items-center gap-2 border-t border-default bg-default px-4 py-2 text-xs">
      <span>表格</span>
      <UButton size="xs" variant="ghost" label="添加行" @click="editor?.chain().focus().addRowAfter().run()" />
      <UButton size="xs" variant="ghost" label="添加列" @click="editor?.chain().focus().addColumnAfter().run()" />
      <UButton size="xs" variant="ghost" label="删除行" @click="editor?.chain().focus().deleteRow().run()" />
      <UButton size="xs" variant="ghost" label="删除列" @click="editor?.chain().focus().deleteColumn().run()" />
      <UButton size="xs" variant="ghost" label="删除表格" color="error" @click="editor?.chain().focus().deleteTable().run()" />
    </div>
  </section>
</template>
