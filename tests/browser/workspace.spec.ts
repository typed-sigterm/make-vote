import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PROJECT_SCHEMA_ID } from '../../shared/project';

test('welcome page opens a new project', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make Vote' })).toBeVisible();
  await page.getByRole('link', { name: /创建新项目/ }).click();
  await expect(page).toHaveURL(/workspace/);
  await expect(page.getByRole('textbox', { name: '选票富文本编辑器' })).toBeVisible();
});

test('rich text, issuance, project round trip and printable output', async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
  });
  await page.goto('/workspace/');
  await expect(page.getByRole('textbox', { name: '选票富文本编辑器' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('workspace.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: '导出选票', exact: true }).click();
  await page.getByRole('spinbutton').fill('2');
  const printDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '生成并下载选票' }).click();
  const htmlPath = await (await printDownload).path();
  const html = await readFile(htmlPath!, 'utf8');
  expect(html.match(/data-serial=/g)).toHaveLength(2);
  expect(html.match(/<svg/g)).toHaveLength(2);
  expect(html).toContain('000001');
  expect(html).toContain('000002');
  expect(html).toContain('请保密，勿向他人透露');
  expect(html).not.toContain('@apply');
  const printed = await context.newPage();
  await printed.setContent(html);
  await expect(printed.locator('.ballot-option').first()).toHaveCSS('display', 'flex');
  await expect(printed.locator('.ballot-qr svg').first()).toHaveCSS('width', '96px');
  await expect(printed.locator('.ballot-qr svg').first()).toHaveCSS('height', '96px');
  const pdf = await printed.pdf({
    path: testInfo.outputPath('ballots.pdf'),
    preferCSSPageSize: true,
  });
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
  await printed.close();
  const savedDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const projectPath = await (await savedDownload).path();
  const projectText = await readFile(projectPath!, 'utf8');
  const project = JSON.parse(projectText);
  expect(project.$schema).toBe(PROJECT_SCHEMA_ID);
  expect(project).not.toHaveProperty('format');
  expect(project).not.toHaveProperty('version');
  expect(project.nextSerial).toBe(3);
  expect(project.exports).toHaveLength(1);
  expect(new Set(project.exports[0].ballots.map((ballot: { unique: string }) => ballot.unique)).size).toBe(2);
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回首页' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: '打开项目' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'test.mvprj',
    mimeType: 'application/json',
    buffer: Buffer.from(projectText),
  });
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /导出记录/ }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('button', { name: '查看编号' }).click();
  await expect(page.locator('table tbody tr')).toHaveCount(2);
  const redownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '重新下载' }).click();
  expect(await readFile((await (await redownload).path())!, 'utf8')).toBe(html);
  await page.getByRole('button', { name: '删除批次记录' }).click();
  await expect(page.getByRole('button', { name: '取消', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog').locator('[data-slot="footer"] button')).toHaveText(['确认继续', '取消']);
  await page.getByRole('button', { name: '确认继续' }).click();
  await expect(page.locator('article')).toHaveCount(0);
  await expect(page.getByText('未保存', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '选票设计', exact: true }).click();
  await page.getByRole('button', { name: '插入富文本', exact: true }).click();
  await page.getByRole('textbox', { name: 'Markdown 文本' }).fill('## 新标题\n\n**测试富文本**');
  await page.getByRole('button', { name: '插入富文本' }).click();
  await expect(page.locator('.tiptap')).toContainText('新标题');
  await expect(page.locator('.tiptap strong')).toContainText('测试富文本');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('mobile.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('custom nodes, table and formatted text survive saving', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await page.goto('/workspace/');
  const editor = page.getByRole('textbox', { name: '选票富文本编辑器' });
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: '项目设置' }).click();
  await page.getByRole('textbox', { name: '项目 GUID' }).fill('community / vote 2026');
  await expect(page.getByText(/后续二维码和验证将使用新 GUID/)).toBeVisible();
  await page.getByRole('button', { name: '完成', exact: true }).click();
  for (const name of [
    '插入填写框',
    '插入序列号',
    '插入唯一编号',
    '插入二维码',
    '插入分页符',
    '插入表格',
  ]) {
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.getByRole('button', {
      name: new RegExp(name),
    }).first().click();
  }
  await page.getByRole('button', { name: '插入富文本', exact: true }).click();
  await page.getByRole('textbox', { name: 'Markdown 文本' }).fill('- 选项一\n- 选项二\n\n[项目说明](https://example.com)');
  await page.getByRole('button', { name: '插入富文本' }).click();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.getByRole('button', { name: '插入图片', exact: true }).click();
  await page.getByRole('textbox', { name: 'HTTPS 图片地址' }).fill('https://example.com/ballot.png');
  await page.getByRole('textbox', { name: '替代文本' }).fill('选票图片');
  await page.getByRole('button', { name: '插入图片', exact: true }).last().click();
  const saved = page.waitForEvent('download');
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('字号测试');
  await page.keyboard.press('Shift+Home');
  await page.getByRole('combobox', { name: '字号', exact: true }).selectOption('24px');
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 5000 });
  const contents = JSON.parse(await readFile((await (await saved).path())!, 'utf8'));
  const doc = JSON.stringify(contents.document);
  for (const type of [
    'ballotOption',
    'ballotNumber',
    'ballotQr',
    'pageBreak',
    'table',
    'link',
    'bulletList',
  ])
    expect(doc).toContain(type);
  expect(doc).toContain('fill');
  expect(doc).toContain('https://example.com/ballot.png');
  expect(contents.guid).toBe('community / vote 2026');
  expect(doc).toContain('24px');
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
});

test('native file handles save in place and cancelled saves stay dirty', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { contents: '', saves: 0, cancel: false };
    Object.defineProperty(window, '__fileTest', { value: state });
    const handle = {
      name: 'native.mvprj',
      getFile: async () => new File([state.contents], 'native.mvprj', { type: 'application/json' }),
      createWritable: async () => ({
        write: async (source: string) => {
          state.contents = source;
          state.saves++;
        },
        close: async () => {},
        abort: async () => {},
      }),
    };
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: async () => {
        if (state.cancel)
          throw new DOMException('Cancelled', 'AbortError');
        return handle;
      },
    });
    Object.defineProperty(window, 'showOpenFilePicker', {
      value: async () => [handle],
    });
  });
  await page.goto('/workspace/');
  await expect(page.getByRole('textbox', { name: '选票富文本编辑器' })).toBeVisible();
  const beforeUnloadBlocked = () => page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(await beforeUnloadBlocked()).toBe(true);
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  expect(await beforeUnloadBlocked()).toBe(false);
  await page.getByRole('button', { name: '项目设置' }).click();
  await page.getByRole('textbox', { name: '项目名称' }).fill('原位保存测试');
  await expect(page.locator('header')).toContainText('原位保存测试');
  await expect(page.locator('header')).toContainText('未保存');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Control+s');
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  const result = await page.evaluate(() => Reflect.get(window, '__fileTest'));
  expect(result.saves).toBe(2);
  expect(JSON.parse(result.contents).title).toBe('原位保存测试');
  const editor = page.getByRole('textbox', { name: '选票富文本编辑器' });
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('保存后重新打开');
  await page.getByRole('link', { name: '返回首页' }).click();
  await expect(page).toHaveURL(/workspace/);
  await expect(page.getByText('请先保存项目，再离开工作台。', { exact: true })).toBeVisible();
  await expect(page.getByText('未保存', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回首页' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: '打开项目' }).click();
  await expect(editor).toContainText('保存后重新打开');
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '项目设置' }).click();
  await expect(page.getByRole('textbox', { name: '项目名称' })).toHaveValue('原位保存测试');
  await page.getByRole('textbox', { name: '项目名称' }).fill('取消后保留修改');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.evaluate(() => {
    Reflect.get(window, '__fileTest').cancel = true;
  });
  await page.keyboard.press('Control+Shift+s');
  await expect(page.getByText('未保存', { exact: true })).toBeVisible();
  expect(await beforeUnloadBlocked()).toBe(true);
  await page.getByRole('link', { name: '返回首页' }).click();
  await expect(page).toHaveURL(/workspace/);
  await page.getByRole('button', { name: '项目设置' }).click();
  await expect(page.getByRole('textbox', { name: '项目名称' })).toHaveValue('取消后保留修改');
});

test('workspace navigation creates fresh projects and modal actions precede cancel', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await page.goto('/workspace/');
  const header = page.locator('header');
  await expect(header.getByRole('button', { name: '打开项目' })).toHaveCount(0);
  await expect(header.getByRole('button', { name: '新建投票项目' })).toHaveCount(0);
  await page.getByRole('button', { name: '项目设置' }).click();
  const originalGuid = await page.getByRole('textbox', { name: '项目 GUID' }).inputValue();
  await expect(page.getByText('修改 GUID 的影响', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '项目名称' }).fill('即时设置');
  await page.getByRole('spinbutton', { name: '页边距（mm）' }).fill('20');
  await page.getByRole('spinbutton', { name: '页边距（mm）' }).press('Tab');
  await expect(header).toContainText('即时设置');
  const canvas = page.locator('[style*="padding:"]').filter({
    has: page.getByRole('textbox', { name: '选票富文本编辑器', includeHidden: true }),
  });
  await expect(canvas).toHaveCSS('padding-top', '75.5906px');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '项目设置' }).click();
  await expect(page.getByRole('textbox', { name: '项目名称' })).toHaveValue('即时设置');
  await expect(page.getByRole('spinbutton', { name: '页边距（mm）' })).toHaveValue('20');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  for (const [opener, confirm] of [
    ['导出选票', '生成并下载选票'],
    ['插入富文本', '插入富文本'],
    ['插入图片', '插入图片'],
  ]) {
    await page.getByRole('button', { name: opener, exact: true }).click();
    await expect(page.getByRole('dialog').locator('[data-slot="footer"] button')).toHaveText([confirm!, '取消']);
    await page.getByRole('button', { name: '取消', exact: true }).click();
  }
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const contents = JSON.parse(await readFile((await (await saved).path())!, 'utf8'));
  expect(contents.title).toBe('即时设置');
  expect(contents.paper.margin).toBe(20);
  await page.getByRole('link', { name: '返回首页' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: /创建新项目/ }).click();
  await expect(page.getByText('未保存', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '项目设置' }).click();
  await expect(page.getByRole('textbox', { name: '项目名称' })).toHaveValue('社区年度提案投票');
  await expect(page.getByRole('textbox', { name: '项目 GUID' })).not.toHaveValue(originalGuid);
});
