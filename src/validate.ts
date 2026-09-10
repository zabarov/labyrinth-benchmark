import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import { fail, digest } from './core.js';
const ajv = new Ajv({ allErrors: true, strict: false });
const names = ['TaskPacket','ParticipantManifest','TrialConfig','TrialResult','UsageReceipt','EvaluationReport','PublicMetadata'];
const validators = new Map(names.map(name => [name, ajv.compile(JSON.parse(readFileSync(new URL(`../schemas/${name}.json`, import.meta.url),'utf8')))]));
export function validate(name: string, value: unknown): void {
  const validator = validators.get(name);
  if (!validator || !validator(value)) fail('invalid_' + name);
  if (name === 'TaskPacket') {
    const p = value as any;
    if (digest(p.source_text) !== p.source_digest || (p.access === 'revoked' && p.source_text !== '')) fail('invalid_packet_binding');
  }
}
