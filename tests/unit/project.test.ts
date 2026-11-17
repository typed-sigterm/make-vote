import { describe, expect, test } from 'bun:test';
import { commitExport, createExportBatch, createProject, parseProject, PROJECT_SCHEMA_ID, QR_PAYLOAD_SCHEMA_ID, qrPayload, qrPayloadSchema, randomNumber, serializeProject } from '../../shared/project';

describe('mvprj project format', () => {
  test('round trips rich text and issuance snapshots through JSON', () => {
    const original = createProject();
    const batch = createExportBatch(original, 3);
    const issued = commitExport(original, batch);
    const reopened = parseProject(serializeProject(issued));
    expect(reopened).toEqual(issued);
    expect(reopened.$schema).toBe(PROJECT_SCHEMA_ID);
    expect(reopened).not.toHaveProperty('format');
    expect(reopened).not.toHaveProperty('version');
    expect(reopened.document.type).toBe('doc');
    expect(reopened.nextSerial).toBe(4);
    expect(original.exports).toHaveLength(0);
    issued.document.content = [
      { type: 'paragraph' },
    ];
    expect(batch.document).toEqual(original.document);
  });
  test('rejects unsupported schemas, unsafe links, malformed and deeply nested files', () => {
    const original = createProject();
    expect(() => parseProject('{')).toThrow();
    expect(() => parseProject(JSON.stringify({ ...original, $schema: '/schemas/mvprj-v2.schema.json' }))).toThrow();
    const { $schema, ...withoutSchema } = original;
    expect(() => parseProject(JSON.stringify(withoutSchema))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...withoutSchema, format: 'make-vote', version: 1 }))).toThrow();
    expect($schema).toBe(PROJECT_SCHEMA_ID);
    original.document.content = [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'link',
            marks: [
              {
                type: 'link',
                attrs: { href: 'javascript:alert(1)' },
              },
            ],
          },
        ],
      },
    ];
    expect(() => parseProject(JSON.stringify(original))).toThrow();
    let nested: unknown = {};
    for (let i = 0; i < 45; i++) {
      nested = {
        content: [nested],
      };
    }
    expect(() => parseProject(JSON.stringify(nested))).toThrow('过于复杂');
  });
});

describe('ballot issuance', () => {
  test('generates 1000 distinct numeric IDs, including collision retries across batches', () => {
    const original = createProject();
    const batch = createExportBatch(original, 1000);
    expect(new Set(batch.ballots.map(ballot => ballot.unique)).size).toBe(1000);
    expect(batch.ballots.every(ballot => /^\d{12}$/.test(ballot.unique))).toBe(true);
    expect(batch.ballots[999]?.serial).toBe(1000);
    const issued = commitExport(original, batch);
    let attempts = 0;
    const next = createExportBatch(issued, 1, () => ++attempts === 1
      ? batch.ballots[0]!.unique
      : '000000000001');
    expect(attempts).toBe(2);
    expect(next.ballots[0]).toEqual({ serial: 1001, unique: '000000000001' });
    expect(() => createExportBatch(issued, 1, () => batch.ballots[0]!.unique)).toThrow('不重复');
  });
  test('validates counts and preserves the next serial when records are deleted', () => {
    const original = createProject();
    for (const count of [0, -1, 1.1, 1001, Number.NaN]) expect(() => createExportBatch(original, count)).toThrow();
    const issued = commitExport(original, createExportBatch(original, 2));
    issued.exports = [];
    const reopened = parseProject(serializeProject(issued));
    expect(createExportBatch(reopened, 1).ballots[0]?.serial).toBe(3);
  });
  test('rejects duplicate serials and unique IDs on import', () => {
    const original = createProject();
    const issued = commitExport(original, createExportBatch(original, 2));
    issued.exports[0]!.ballots[1] = { ...issued.exports[0]!.ballots[0]! };
    expect(() => parseProject(JSON.stringify(issued))).toThrow('重复');
  });
  test('QR payload identifies project and both ballot numbers', () => {
    const project = createProject();
    const ballot = { serial: 2, unique: '000000000002' };
    expect(JSON.parse(qrPayload(project.guid, ballot))).toEqual({
      $schema: QR_PAYLOAD_SCHEMA_ID,
      project: project.guid,
      ...ballot,
    });
    expect(randomNumber()).toMatch(/^\d{12}$/);
  });
  test('standalone QR schema validates identifiers and ballot numbers', () => {
    const payload = {
      $schema: QR_PAYLOAD_SCHEMA_ID,
      project: '社区投票 / 2026',
      serial: 1,
      unique: '000000000001',
    } as const;
    expect(qrPayloadSchema.parse(payload)).toEqual(payload);
    for (const invalid of [
      { ...payload, $schema: PROJECT_SCHEMA_ID },
      { ...payload, project: '' },
      { ...payload, guid: payload.project },
      { ...payload, serial: 0 },
      { ...payload, unique: 1 },
      { ...payload, unique: '123' },
    ]) expect(qrPayloadSchema.safeParse(invalid).success).toBe(false);
    expect(() => qrPayload('', { serial: 1, unique: '000000000001' })).toThrow();
    expect(() => qrPayload('project', { serial: 0, unique: '000000000001' })).toThrow();
  });
  test('GUID is unrestricted, frozen into each export, and HTTPS images are validated', () => {
    const project = createProject();
    project.guid = 'community ballot / 2026';
    project.document.content = [
      {
        type: 'image',
        attrs: { src: 'https://example.com/ballot.png', alt: '图示' },
      },
    ];
    const batch = createExportBatch(project, 1, () => '123456789012');
    expect(batch.guid).toBe(project.guid);
    project.guid = 'changed-guid';
    expect(batch.guid).toBe('community ballot / 2026');
    expect(() => parseProject(JSON.stringify({
      ...project,
      document: {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: { src: 'http://example.com/a.png' },
          },
        ],
      },
    }))).toThrow();
  });
});
