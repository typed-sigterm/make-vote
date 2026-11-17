<template>
  <ClientOnly>
    <VoteWorkspace />
    <template #fallback>
      <main class="grid min-h-dvh place-items-center text-gray-600" role="status">
        正在打开 Make Vote 工作台…
      </main>
    </template>
  </ClientOnly>
</template>
