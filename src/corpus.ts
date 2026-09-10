import { createHash } from 'node:crypto';
import { digest, fail, atomicJSON, readJSON } from './core.js';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TaskPacket, Result, Phase, Instruction, ExecutionProgram as Program } from './types.js';

export type {Instruction, ExecutionProgram as Program} from './types.js';
const branches = ['L', 'C', 'R'];
export const phases: Phase[] = ['cold', 'unchanged', 'source_edit', 'goal_change', 'new_scope', 'revoked_access'];
export function generate(seed: string, length: number, phase: Phase = 'cold', version = 'sha256-v1'): TaskPacket {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(seed) || ![10, 100, 1000].includes(length) || !phases.includes(phase)) fail('invalid_corpus_parameters');
  let counter = 0;
  let old = createHash('sha256').update(`working-memory-family-${seed}`).digest().readUInt32LE(0);
  const random = () => {
    if (version === 'legacy-v1') { old = (Math.imul(1664525, old) + 1013904223) >>> 0; return old; }
    if (version !== 'sha256-v1') fail('unsupported_corpus_version');
    return createHash('sha256').update(`labyrinth/sha256-v1/${seed}/${counter++}`).digest().readUInt32BE(0);
  };
  const initial = version === 'legacy-v1' ? Number(seed) * 3 : random() % 97;
  if (!Number.isSafeInteger(initial) || initial < 0) fail('invalid_legacy_seed');
  const nodes: Instruction[] = [];
  for (let step = 0; step < length; step++) for (const branch of branches)
    nodes.push({ id: `S${step + 1}${branch}`, add: random() % 17 + 1 + (phase === 'source_edit' && step === 0 ? 19 : 0), multiply: random() % 4 + 1, repeat: random() % 3 + 1 });
  const text = [
    `Maze with ${length} layers. Start at S1C with x=${initial} and left_count=0.`,
    'At every node repeat its operation k times: x=((x+a)*m) modulo 97. Keep integer state.',
    'After the operation, if x modulo 3 is 0 choose L, if it is 1 choose C, otherwise choose R.',
    'Increment left_count when choosing L. Move to that branch in the next layer; after the last layer finish.',
    'Do not skip a node or reset x between layers. Record node, before, after, branch for each visited layer.',
    ...nodes.map(n => `${n.id}: a=${n.add}; m=${n.multiply}; k=${n.repeat}.`)
  ].join('\n');
  const source = phase === 'revoked_access' ? '' : text;
  return { contract_version: '1.0.0', task_id: `${version}.${seed}.${length}.${phase}`, source_text: source,
    source_digest: digest(source), goal: phase === 'goal_change' ? 'left_count' : 'final_state', length,
    phase, scope: phase === 'new_scope' ? 'new-principal' : 'original-principal',
    access: phase === 'revoked_access' ? 'revoked' : 'allowed', tools: [],
    result_contract:'TrialResult@1.0.0',constraints:['full_trace_required','integer_state','revoked_access_no_disclosure'] };
}
export function parseText(text: string): Program {
  const lines = text.split('\n');
  const header = /^Maze with (10|100|1000) layers\. Start at S1C with x=(\d+) and left_count=0\.$/.exec(lines[0]);
  if (!header) fail('invalid_text_header');
  const length = Number(header![1]), initial = Number(header![2]);
  if (initial > 100000 || lines.length !== 5 + length * 3) fail('invalid_text_size');
  const reference = generate('1', length).source_text.split('\n');
  if (lines.slice(1,5).some((line, i) => line !== reference[i+1])) fail('unsupported_text_semantics');
  const nodes = lines.slice(5).map((line, i) => {
    const m = /^(S\d+[LCR]): a=(\d+); m=(\d+); k=(\d+)\.$/.exec(line);
    if (!m || m[1] !== `S${Math.floor(i / 3) + 1}${branches[i % 3]}`) fail('invalid_node');
    const node = { id: m![1], add: Number(m![2]), multiply: Number(m![3]), repeat: Number(m![4]) };
    if (node.add > 100 || node.multiply < 1 || node.multiply > 4 || node.repeat < 1 || node.repeat > 3) fail('invalid_operation');
    return node;
  });
  return { initial, length, nodes };
}
export function execute(program: Program, goal: TaskPacket['goal']): Result {
  let x = program.initial, branch = 'C', left = 0;
  const trace: Result['trace'] = [];
  for (let step = 0; step < program.length; step++) {
    const node = program.nodes[step * 3 + branches.indexOf(branch)], before = x;
    for (let k = 0; k < node.repeat; k++) x = ((x + node.add) * node.multiply) % 97;
    branch = branches[x % 3]; if (branch === 'L') left++;
    trace.push({ node: node.id, before, after: x, branch });
  }
  return { status: 'completed', value: goal === 'left_count' ? left : x, trace };
}
export function oracle(packet: TaskPacket): Result {
  return packet.access === 'revoked' ? { status: 'blocked', value: null, trace: [] } : execute(parseText(packet.source_text), packet.goal);
}
export async function independentOracle(packet: TaskPacket): Promise<Result> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.LABYRINTH_PYTHON ?? 'python3',
      [fileURLToPath(new URL('../evaluator/text_oracle.py', import.meta.url))],
      { env: { PATH: process.env.PATH }, stdio: ['pipe','pipe','pipe'] });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('oracle_timeout')); }, 30000);
    child.on('error', reject);
    child.stdout.on('data', data => { output += data; if (output.length > 4 * 1024 * 1024) child.kill(); });
    child.on('close', code => { clearTimeout(timer); try {
      if (code !== 0) fail('oracle_failed'); resolve(JSON.parse(output));
    } catch (e) { reject(e); } });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(packet));
  });
}
export async function writeCorpus(root: string, seeds: string[], lengths: number[], version = 'sha256-v1'): Promise<void> {
  const packets = seeds.flatMap(seed => lengths.flatMap(length => phases.map(phase => generate(seed, length, phase, version))));
  await atomicJSON(join(root, 'packets.json'), { version, seeds, lengths, digest: digest(packets), packets });
}
export async function loadCorpus(root: string): Promise<TaskPacket[]> {
  const data = await readJSON(join(root, 'packets.json'));
  if (!Array.isArray(data.packets) || digest(data.packets) !== data.digest) fail('corpus_digest_mismatch');
  const expected = data.seeds.flatMap((seed: string) => data.lengths.flatMap((n: number) => phases.map(p => generate(seed,n,p,data.version))));
  if (digest(expected) !== data.digest) fail('corpus_generator_mismatch');
  return data.packets;
}
