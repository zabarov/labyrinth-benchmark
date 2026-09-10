"""Independent text interpreter. No TypeScript, Mirai, or generated oracle imports."""
import json
import re
import sys


def evaluate(packet):
    if packet['access'] == 'revoked':
        return dict(status='blocked', value=None, trace=[])
    lines = packet['source_text'].splitlines()
    match = re.fullmatch(r'Maze with (10|100|1000) layers\. Start at S1C with x=(\d+) and left_count=0\.', lines[0])
    if not match:
        raise ValueError('invalid_header')
    length, state = map(int, match.groups())
    required = [
        'At every node repeat its operation k times: x=((x+a)*m) modulo 97. Keep integer state.',
        'After the operation, if x modulo 3 is 0 choose L, if it is 1 choose C, otherwise choose R.',
        'Increment left_count when choosing L. Move to that branch in the next layer; after the last layer finish.',
        'Do not skip a node or reset x between layers. Record node, before, after, branch for each visited layer.'
    ]
    if lines[1:5] != required or len(lines) != 5 + length * 3 or state > 100000:
        raise ValueError('unsupported_semantics')
    nodes = {}
    for i, line in enumerate(lines[5:]):
        m = re.fullmatch(r'(S\d+[LCR]): a=(\d+); m=(\d+); k=(\d+)\.', line)
        if not m or m[1] != f'S{i // 3 + 1}{"LCR"[i % 3]}':
            raise ValueError('invalid_node')
        a, multiplier, count = map(int, m.groups()[1:])
        if not (0 <= a <= 100 and 1 <= multiplier <= 4 and 1 <= count <= 3):
            raise ValueError('invalid_operation')
        nodes[m[1]] = (a, multiplier, count)
    branch, left, trace = 'C', 0, []
    for layer in range(1, length + 1):
        key, before = f'S{layer}{branch}', state
        a, multiplier, count = nodes[key]
        for _ in range(count):
            state = ((state + a) * multiplier) % 97
        branch = 'LCR'[state % 3]
        left += branch == 'L'
        trace.append(dict(node=key, before=before, after=state, branch=branch))
    return dict(status='completed', value=left if packet['goal'] == 'left_count' else state, trace=trace)


if __name__ == '__main__':
    packet = json.load(sys.stdin)
    json.dump(evaluate(packet), sys.stdout, separators=(',', ':'))
