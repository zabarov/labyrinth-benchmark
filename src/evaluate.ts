import type { TaskPacket, Result } from './types.js';
import { oracle, independentOracle } from './corpus.js';
import { digest, fail } from './core.js';
import { validate } from './validate.js';

export async function score(packet: TaskPacket, output: unknown) {
  validate('TaskPacket', packet);
  const expected = oracle(packet), independent = await independentOracle(packet);
  if (digest(expected) !== digest(independent)) fail('oracle_disagreement');
  let valid = true;
  try { validate('TrialResult', output); } catch { valid = false; }
  const value = output as Result | null;
  const trace = valid ? value!.trace : [];
  const correct = expected.trace.filter((step,i) => digest(step) === digest(trace[i] ?? null)).length;
  const first = expected.trace.findIndex((step,i) => digest(step) !== digest(trace[i] ?? null));
  const exact = valid && digest(output) === digest(expected);
  return { exact_outcome: exact, correct_transitions: correct, required_transitions: expected.trace.length,
    first_wrong_transition: first === -1 ? null : first + 1,
    false_completion: value?.status === 'completed' && !exact,
    unauthorized_disclosure: packet.access === 'revoked' && !!value && (value.value !== null || (Array.isArray(value.trace) && value.trace.length > 0)),
    malformed: !valid, oracle_digest: digest(expected) };
}
