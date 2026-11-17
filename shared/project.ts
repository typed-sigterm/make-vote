import { z } from 'zod';

export const PROJECT_SCHEMA_ID = 'https://make-vote.by-ts.top/schemas/mvprj.v1.schema.json';
export const QR_PAYLOAD_SCHEMA_ID = 'https://make-vote.by-ts.top/schemas/ballot-qr.v1.schema.json';

const attrsSchema = z.object({
  level: z.number().int().min(1).max(6).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).nullable().optional(),
  align: z.enum(['left', 'center', 'right']).nullable().optional(),
  start: z.number().int().min(1).max(100000).optional(),
  type: z.string().max(30).nullable().optional(),
  language: z.string().max(40).nullable().optional(),
  colspan: z.number().int().min(1).max(20).optional(),
  rowspan: z.number().int().min(1).max(100).optional(),
  colwidth: z.array(z.number().int().min(1).max(2000)).max(20).nullable().optional(),
  style: z.enum(['fill']).optional(),
  kind: z.enum(['serial', 'unique']).optional(),
  // JSON Schema patterns cannot carry the case-insensitive regex flag.
  // eslint-disable-next-line regexp/use-ignore-case
  src: z.url().max(2000).regex(/^[hH][tT][tT][pP][sS]:/, '图片仅支持 HTTPS 地址').optional(),
  alt: z.string().max(500).optional(),
  title: z.string().max(500).nullable().optional(),
  width: z.number().int().positive().max(10000).nullable().optional(),
  height: z.number().int().positive().max(10000).nullable().optional(),
}).strict();

export interface DocumentNode {
  type: string
  text?: string
  attrs?: z.infer<typeof attrsSchema>
  marks?: { type: string, attrs?: { href?: string, title?: string | null, target?: string | null, rel?: string | null, class?: string | null, fontSize?: string | null } }[]
  content?: DocumentNode[]
}

const markSchema = z.object({
  type: z.enum([
    'bold',
    'italic',
    'strike',
    'code',
    'underline',
    'link',
    'textStyle',
  ]),
  attrs: z.object({
    // eslint-disable-next-line regexp/use-ignore-case -- Preserve case folding in generated JSON Schema patterns.
    href: z.string().max(2000).regex(/^(?:[hH][tT][tT][pP][sS]?:|[mM][aA][iI][lL][tT][oO]:)/, '链接仅支持 http、https 或 mailto').optional(),
    title: z.string().max(1000).nullable().optional(),
    target: z.enum(['_blank', '_self']).nullable().optional(),
    rel: z.string().max(200).nullable().optional(),
    class: z.null().optional(),
    fontSize: z.enum([
      '12px',
      '14px',
      '16px',
      '18px',
      '20px',
      '24px',
      '32px',
    ]).nullable().optional(),
  }).strict().optional(),
}).strict();

const documentNodeObject = z.object({
  type: z.enum([
    'doc',
    'paragraph',
    'heading',
    'text',
    'image',
    'hardBreak',
    'horizontalRule',
    'blockquote',
    'bulletList',
    'orderedList',
    'listItem',
    'codeBlock',
    'table',
    'tableRow',
    'tableCell',
    'tableHeader',
    'ballotOption',
    'ballotNumber',
    'ballotQr',
    'pageBreak',
  ]),
  text: z.string().max(100000).optional(),
  attrs: attrsSchema.optional(),
  marks: z.array(markSchema).max(8).optional(),
  content: z.array(z.lazy((): z.ZodType<DocumentNode> => documentNodeObject)).max(2000).optional(),
}).strict();
export const documentNodeSchema: z.ZodType<DocumentNode> = documentNodeObject;

export const paperSchema = z.object({
  size: z.enum(['A4', 'A5']),
  orientation: z.enum(['portrait', 'landscape']),
  margin: z.number().int().min(8).max(35),
}).strict();
export type Paper = z.infer<typeof paperSchema>;

export const ballotSchema = z.object({
  serial: z.number().int().min(1).max(999999999),
  unique: z.string().regex(/^\d{12}$/, '唯一编号须为 12 位数字'),
}).strict();
export type Ballot = z.infer<typeof ballotSchema>;
const documentSchema = documentNodeObject.extend({
  type: z.literal('doc'),
});

export const qrPayloadSchema = z.object({
  $schema: z.literal(QR_PAYLOAD_SCHEMA_ID),
  project: z.string().min(1).max(200).describe('发行此选票时的项目 GUID'),
  ...ballotSchema.shape,
}).strict().describe('Make Vote 选票二维码负载');
export type QrPayload = z.infer<typeof qrPayloadSchema>;

export const batchSchema = z.object({
  id: z.uuid(),
  guid: z.string().min(1).max(200),
  createdAt: z.iso.datetime(),
  title: z.string().trim().min(1).max(100),
  document: documentSchema,
  paper: paperSchema,
  ballots: z.array(ballotSchema).min(1).max(1000),
}).strict();
export type ExportBatch = z.infer<typeof batchSchema>;

export const projectSchema = z.object({
  $schema: z.literal(PROJECT_SCHEMA_ID),
  guid: z.string().min(1).max(200),
  title: z.string().trim().min(1, '请输入项目名称').max(100),
  document: documentSchema,
  paper: paperSchema,
  nextSerial: z.number().int().min(1).max(1000000000),
  exports: z.array(batchSchema).max(1000),
}).strict().superRefine((project, ctx) => {
  const serials = new Set<number>();
  const numbers = new Set<string>();
  const batchIds = new Set<string>();
  for (const batch of project.exports) {
    if (batchIds.has(batch.id))
      ctx.addIssue({ code: 'custom', message: '存在重复导出批次' });
    batchIds.add(batch.id);
    for (const ballot of batch.ballots) {
      if (serials.has(ballot.serial) || numbers.has(ballot.unique))
        ctx.addIssue({ code: 'custom', message: '导出记录中的序列号或唯一编号重复' });
      if (ballot.serial >= project.nextSerial)
        ctx.addIssue({ code: 'custom', message: '下一个序列号必须大于已发行序列号' });
      serials.add(ballot.serial);
      numbers.add(ballot.unique);
    }
  }
}).describe('Make Vote 项目');
export type VoteProject = z.infer<typeof projectSchema>;
export const exportRequestSchema = z.object({
  copies: z.number().int().min(1, '至少导出 1 份').max(1000, '每批最多 1000 份'),
});

const text = (value: string): DocumentNode => ({ type: 'text', text: value });
export function createProject(): VoteProject {
  return {
    $schema: PROJECT_SCHEMA_ID,
    guid: crypto.randomUUID(),
    title: '社区年度提案投票',
    paper: { size: 'A5', orientation: 'portrait', margin: 16 },
    nextSerial: 1,
    exports: [],
    document: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            text('2026 · COMMUNITY BALLOT'),
          ],
        },
        {
          type: 'heading',
          attrs: { level: 1, textAlign: 'center' },
          content: [
            text('让每一个想法，被看见。'),
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            text('社区年度提案投票'),
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            text('你希望优先实现哪一项提案？'),
          ],
        },
        {
          type: 'paragraph',
          content: [
            text('请在你支持的一个选项前打「✓」。每人一票，多选或未选视为无效票。'),
          ],
        },
        ...['打造一座社区共享花园', '增设公共阅读与自习空间', '举办每月邻里交流活动'].map(value => ({
          type: 'ballotOption',
          attrs: { style: 'fill' as const },
          content: [
            text(value),
          ],
        })),
        { type: 'paragraph' },
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [
            text('选票序列号  '),
            {
              type: 'ballotNumber',
              attrs: { kind: 'serial' },
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            text('唯一编号  '),
            {
              type: 'ballotNumber',
              attrs: { kind: 'unique' },
            },
            text('（请保密，勿向他人透露）'),
          ],
        },
        { type: 'ballotQr' },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            text('感谢参与，让改变从这里发生。'),
          ],
        },
      ],
    },
  };
}

export const MAX_PROJECT_BYTES = 10 * 1024 * 1024;
export function parseProject(source: string): VoteProject {
  if (new TextEncoder().encode(source).byteLength > MAX_PROJECT_BYTES)
    throw new Error('项目文件不能超过 10 MB');
  const value: unknown = JSON.parse(source);
  const queue: { value: unknown, depth: number }[] = [
    { value, depth: 0 },
  ];
  let count = 0;
  // Bound recursive validation before processing untrusted document trees.
  while (queue.length) {
    const item = queue.pop()!;
    if (++count > 200000 || item.depth > 40)
      throw new Error('项目内容过于复杂');
    if (item.value && typeof item.value === 'object') {
      for (const child of Object.values(item.value)) queue.push({ value: child, depth: item.depth + 1 });
    }
  }
  return projectSchema.parse(value);
}

export function serializeProject(project: VoteProject): string {
  const source = JSON.stringify(projectSchema.parse(project), null, 2);
  if (new TextEncoder().encode(source).byteLength > MAX_PROJECT_BYTES)
    throw new Error('项目记录已超过 10 MB，请先删除不再需要的导出记录');
  parseProject(source);
  return source;
}

export function randomNumber(): string {
  let result = '';
  while (result.length < 12) {
    for (const byte of crypto.getRandomValues(new Uint8Array(24))) {
      if (byte < 250)
        result += String(byte % 10);
      if (result.length === 12)
        break;
    }
  }
  return result;
}

export function createExportBatch(project: VoteProject, copies: number, generate = randomNumber): ExportBatch {
  projectSchema.parse(project);
  exportRequestSchema.parse({ copies });
  if (project.nextSerial + copies > 1000000000)
    throw new Error('序列号已超出上限');
  const used = new Set(project.exports.flatMap(batch => batch.ballots.map(ballot => ballot.unique)));
  const ballots: Ballot[] = [];
  for (let i = 0; i < copies; i++) {
    let unique = '';
    for (let attempt = 0; attempt < 100; attempt++) {
      unique = generate();
      if (!used.has(unique))
        break;
    }
    if (used.has(unique))
      throw new Error('无法生成不重复编号，请重试');
    ballotSchema.parse({ serial: project.nextSerial + i, unique });
    used.add(unique);
    ballots.push({ serial: project.nextSerial + i, unique });
  }
  return batchSchema.parse({
    id: crypto.randomUUID(),
    guid: project.guid,
    createdAt: new Date().toISOString(),
    title: project.title,
    document: structuredClone(project.document),
    paper: { ...project.paper },
    ballots,
  });
}

export function commitExport(project: VoteProject, batch: ExportBatch): VoteProject {
  const result = projectSchema.parse({
    ...project,
    nextSerial: project.nextSerial + batch.ballots.length,
    exports: [...project.exports, batch],
  });
  serializeProject(result);
  return result;
}

export function qrPayload(project: string, ballot: Ballot): string {
  return JSON.stringify(qrPayloadSchema.parse({
    $schema: QR_PAYLOAD_SCHEMA_ID,
    project,
    serial: ballot.serial,
    unique: ballot.unique,
  }));
}
export function formatSerial(serial: number): string {
  return String(serial).padStart(6, '0');
}
