"""Convert uploaded nested timings to a Perfetto-compatible Chrome JSON trace.
Usage: python tools/performance_trace.py CAPTURE.json OUTPUT.trace.json
No timing is fabricated from per-frame aggregates.
"""
import json
import sys


def convert(report):
    trace = report.get('trace') or {}
    names = trace.get('names', [])
    events = [{'ph': 'M', 'pid': 1, 'tid': 1, 'name': 'thread_name',
               'args': {'name': 'Race main thread (instrumented)'}}]
    for name_id, start, duration, self_ms, frame, depth in trace.get('spans', []):
        events.append({'ph': 'X', 'pid': 1, 'tid': 1, 'name': names[name_id],
                       'ts': start * 1000, 'dur': duration * 1000,
                       'args': {'selfMs': self_ms, 'frame': frame, 'depth': depth}})
    for frame in report.get('frames', []):
        events.append({'ph': 'i', 's': 't', 'pid': 1, 'tid': 1, 'name': 'Frame context',
                       'ts': frame['atMs'] * 1000, 'args': {**frame.get('context', {}), **frame.get('work', {}), 'wallClockMs': frame.get('wallClockMs')}})
    return {'traceEvents': events, 'metadata': report.get('metadata'),
            'displayTimeUnit': 'ms', 'limitations': report.get('limitations'),
            'droppedSpans': trace.get('droppedSpans', 0)}


if __name__ == '__main__':
    with open(sys.argv[1]) as source:
        result = convert(json.load(source))
    with open(sys.argv[2], 'w') as target:
        json.dump(result, target, separators=(',', ':'))
