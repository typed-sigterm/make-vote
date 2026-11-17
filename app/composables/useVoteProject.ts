import type { VoteProject } from '~~/shared/project';
import { z } from 'zod';
import { createProject, MAX_PROJECT_BYTES, parseProject, serializeProject } from '~~/shared/project';
import { downloadFile, safeFilename, validateDocument } from '~/utils/print';

interface ProjectFileHandle {
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (contents: string) => Promise<void>, close: () => Promise<void>, abort: () => Promise<void> }>
}
interface FileWindow extends Window {
  showOpenFilePicker?: (options: object) => Promise<ProjectFileHandle[]>
  showSaveFilePicker?: (options: object) => Promise<ProjectFileHandle>
}
const pickerTypes = [
  {
    description: 'Make Vote 项目',
    accept: {
      'application/json': ['.mvprj'],
    },
  },
];
const fileHandle = shallowRef<ProjectFileHandle>();

export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues[0]?.message || '数据格式不正确';
  if (error instanceof SyntaxError)
    return '文件不是有效的 JSON 项目';
  return error instanceof Error
    ? error.message
    : '操作失败，请重试';
}

export function useVoteProject() {
  const project = useState<VoteProject>('vote-project', createProject);
  const saved = useState('vote-project-saved', () => '');
  const filename = useState('vote-project-filename', () => '未保存的项目.mvprj');
  const saving = useState('vote-project-saving', () => false);
  const editorSession = useState('vote-project-session', () => 0);
  const route = useRoute();
  const isWorkspacePath = (path: string) => path.replace(/\/+$/, '') === '/workspace';
  const fingerprint = computed(() => JSON.stringify(project.value));
  const dirty = computed(() => fingerprint.value !== saved.value);
  const toast = useToast();

  function report(error: unknown) {
    toast.add({
      title: '操作未完成',
      description: errorMessage(error),
      color: 'error',
    });
  }

  function replace(contents: string, name: string, handle?: ProjectFileHandle) {
    const parsed = parseProject(contents);
    validateDocument(parsed.document);
    for (const batch of parsed.exports) validateDocument(batch.document);
    project.value = parsed;
    saved.value = JSON.stringify(parsed);
    filename.value = name;
    fileHandle.value = handle;
    editorSession.value++;
  }

  async function readFile(file: File, handle?: ProjectFileHandle) {
    if (!file.name.toLowerCase().endsWith('.mvprj'))
      throw new Error('请选择 .mvprj 项目文件');
    if (file.size > MAX_PROJECT_BYTES)
      throw new Error('项目文件不能超过 10 MB');
    replace(await file.text(), file.name, handle);
  }

  async function openProject(fallback: () => void) {
    const picker = (window as FileWindow).showOpenFilePicker;
    if (!picker) {
      fallback();
      return;
    }
    try {
      const [handle] = await picker.call(window, { types: pickerTypes, multiple: false });
      if (handle)
        await readFile(await handle.getFile(), handle);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        report(error);
    }
  }

  async function saveProject(saveAs = false): Promise<boolean> {
    if (saving.value)
      return false;
    saving.value = true;
    try {
      const contents = serializeProject(project.value);
      validateDocument(project.value.document);
      const snapshot = JSON.stringify(project.value);
      let handle = saveAs ? undefined : fileHandle.value;
      const picker = (window as FileWindow).showSaveFilePicker;
      if (!handle && picker)
        handle = await picker.call(window, { suggestedName: `${safeFilename(project.value.title)}.mvprj`, types: pickerTypes });
      if (handle) {
        const writable = await handle.createWritable();
        try {
          await writable.write(contents);
          await writable.close();
        } catch (error) {
          await writable.abort().catch(() => {});
          throw error;
        }
        fileHandle.value = handle;
        filename.value = handle.name;
      } else {
        filename.value = `${safeFilename(project.value.title)}.mvprj`;
        downloadFile(contents, filename.value);
      }
      saved.value = snapshot;
      toast.add({
        title: handle ? '项目已保存' : '项目已下载',
        description: handle ? filename.value : '请保留下载的 .mvprj 文件，下次打开即可继续编辑。',
        color: 'success',
      });
      return true;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        report(error);
      return false;
    } finally {
      saving.value = false;
    }
  }

  function newProject() {
    project.value = createProject();
    saved.value = '';
    fileHandle.value = undefined;
    filename.value = '未保存的项目.mvprj';
    editorSession.value++;
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    if (isWorkspacePath(route.path) && dirty.value) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  watch([
    dirty,
    () => route.path,
  ], ([value, path]) => {
    if (!import.meta.client)
      return;
    if (value && isWorkspacePath(path))
      window.addEventListener('beforeunload', beforeUnload);
    else window.removeEventListener('beforeunload', beforeUnload);
  }, { immediate: true });
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
  onBeforeRouteLeave((_to, from) => {
    if (!isWorkspacePath(from.path) || !dirty.value)
      return true;
    toast.add({ title: '项目尚未保存', description: '请先保存项目，再离开工作台。', color: 'warning' });
    return false;
  });

  function establishCleanBaseline() {
    saved.value = JSON.stringify(project.value);
  }
  function markUnsaved() {
    saved.value = '';
  }

  return {
    project,
    dirty,
    filename,
    saving,
    editorSession,
    saveProject,
    openProject,
    readFile,
    newProject,
    report,
    establishCleanBaseline,
    markUnsaved,
  };
}
