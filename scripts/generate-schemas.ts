import path from 'node:path';
import process from 'node:process';
import { z } from 'zod';
import { PROJECT_SCHEMA_ID, projectSchema, QR_PAYLOAD_SCHEMA_ID, qrPayloadSchema } from '../shared/project';

const check = process.argv.includes('--check');
const definitions = [
  { id: PROJECT_SCHEMA_ID, schema: projectSchema },
  { id: QR_PAYLOAD_SCHEMA_ID, schema: qrPayloadSchema },
];

for (const { id, schema } of definitions) {
  const jsonSchema = {
    $id: id,
    ...z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input', reused: 'ref' }),
  };
  const source = `${JSON.stringify(jsonSchema, null, 2)}\n`;
  const filePath = path.join(import.meta.dirname, '../public', new URL(id).pathname);
  const file = Bun.file(filePath);
  if (check) {
    if (!await file.exists() || await file.text() !== source)
      throw new Error(`${id} 未生成或已过期，请运行 bun run schema:generate`);
  } else {
    await Bun.write(file, source);
  }
}
