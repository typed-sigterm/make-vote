<script setup lang="ts">
const { editorSession, readFile, report, openProject, newProject } = useVoteProject();
const input = useTemplateRef<HTMLInputElement>('fileInput');
const opening = ref(false);
async function openFile(event: Event) {
  const fileInput = event.target as HTMLInputElement;
  const file = fileInput.files?.[0];
  if (!file)
    return;
  opening.value = true;
  try {
    await readFile(file);
    await navigateTo('/workspace');
  } catch (error) {
    report(error);
  } finally {
    opening.value = false;
    fileInput.value = '';
  }
}
function open() {
  const before = editorSession.value;
  void (async () => {
    await openProject(() => input.value?.click());
    if (editorSession.value !== before)
      await navigateTo('/workspace');
  })();
}
</script>

<template>
  <main class="min-h-dvh bg-[#eef1ef] text-gray-900">
    <header class="flex h-16 items-center border-b border-gray-200 bg-white px-6">
      <NuxtLink to="/" class="flex items-center gap-2 text-xl font-semibold" aria-label="Make Vote">
        <UIcon name="i-lucide-vote" class="text-emerald-700" />make vote
      </NuxtLink>
    </header>
    <div class="mx-auto max-w-6xl px-6 py-16">
      <h1 class="text-3xl font-semibold">
        欢迎来到 Make Vote
      </h1>
      <p class="mt-2 text-gray-600">
        创建或打开一个投票项目
      </p>
      <div class="mt-10 grid gap-5 sm:grid-cols-2">
        <NuxtLink to="/workspace" class="flex min-h-44 flex-col items-start justify-between border border-gray-300 bg-white p-6 text-left hover:border-emerald-700" @click="newProject">
          <UIcon name="i-lucide-file-plus-2" class="size-7 text-emerald-700" />
          <span><strong class="block text-lg">创建新项目</strong><span class="mt-1 block text-sm text-gray-600">从选票模板开始编辑</span></span>
        </NuxtLink>
        <button type="button" class="flex min-h-44 flex-col items-start justify-between border border-gray-300 bg-white p-6 text-left hover:border-emerald-700" :disabled="opening" @click="open">
          <UIcon name="i-lucide-folder-open" class="size-7 text-emerald-700" />
          <span><strong class="block text-lg">打开项目</strong><span class="mt-1 block text-sm text-gray-600">继续编辑 .mvprj 文件</span></span>
        </button>
      </div>
      <input ref="fileInput" type="file" accept=".mvprj" class="sr-only" aria-label="打开 mvprj 项目" @change="openFile">
    </div>
  </main>
</template>
