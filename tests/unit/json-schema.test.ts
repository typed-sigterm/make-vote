import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, test } from 'bun:test';
import { commitExport, createExportBatch, createProject, PROJECT_SCHEMA_ID, QR_PAYLOAD_SCHEMA_ID, qrPayload } from '../../shared/project';

const ajv = new Ajv2020();
addFormats(ajv);
const validateProject = ajv.compile(await Bun.file(new URL(`../../public${new URL(PROJECT_SCHEMA_ID).pathname}`, import.meta.url)).json());
const validateQr = ajv.compile(await Bun.file(new URL(`../../public${new URL(QR_PAYLOAD_SCHEMA_ID).pathname}`, import.meta.url)).json());

describe('generated JSON Schema contracts', () => {
  test('an independent validator accepts saved issuance snapshots and QR payloads', () => {
    const project = createProject();
    project.guid = '社区 / 项目';
    const batch = createExportBatch(project, 2);
    const issued = commitExport(project, batch);
    expect(validateProject(issued)).toBe(true);
    project.guid = 'changed-project';
    for (const ballot of batch.ballots) {
      const payload = JSON.parse(qrPayload(batch.guid, ballot));
      expect(validateQr(payload)).toBe(true);
      expect(payload.project).toBe('社区 / 项目');
    }
  });

  test('project schema checks its identity, recursive nodes, images and links', () => {
    const project = createProject();
    expect(validateProject({ ...project, $schema: QR_PAYLOAD_SCHEMA_ID })).toBe(false);
    expect(validateProject({ ...project, version: 1 })).toBe(false);
    expect(validateProject({
      ...project,
      document: { type: 'paragraph' },
    })).toBe(false);
    for (const [node, valid] of [
      [
        {
          type: 'image',
          attrs: { src: 'https://example.com/ballot.png' },
        },
        true,
      ],
      [
        {
          type: 'image',
          attrs: { src: 'http://example.com/ballot.png' },
        },
        false,
      ],
      [
        {
          type: 'image',
          attrs: { src: 'javascript:alert(1)' },
        },
        false,
      ],
      [
        {
          type: 'text',
          text: 'link',
          marks: [
            {
              type: 'link',
              attrs: { href: 'HTTPS://example.com' },
            },
          ],
        },
        true,
      ],
      [
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
        false,
      ],
      [
        { type: 'unknownNode' },
        false,
      ],
    ] as const) {
      expect(validateProject({
        ...project,
        document: {
          type: 'doc',
          content: [
            {
              type: 'blockquote',
              content: [
                {
                  type: 'paragraph',
                  content: [node],
                },
              ],
            },
          ],
        },
      })).toBe(valid);
    }
  });

  test('QR schema rejects missing fields, old GUID fields and invalid numbers', () => {
    const payload = JSON.parse(qrPayload('project', { serial: 1, unique: '000000000001' }));
    for (const field of [
      '$schema',
      'project',
      'serial',
      'unique',
    ]) {
      const incomplete = { ...payload };
      delete incomplete[field];
      expect(validateQr(incomplete)).toBe(false);
    }
    for (const invalid of [
      { ...payload, $schema: PROJECT_SCHEMA_ID },
      { ...payload, project: '' },
      { ...payload, guid: payload.project },
      { ...payload, serial: 1.5 },
      { ...payload, unique: '123' },
      { ...payload, unique: 123456789012 },
    ]) expect(validateQr(invalid)).toBe(false);
  });
});
