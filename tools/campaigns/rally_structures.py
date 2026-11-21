"""Use the existing road-network tunnel shell for mapped rally tunnels.

Portal DEM heights are estimates. Interpolate the deck by distance rather than
following the hill above the bore; keep the surrounding terrain unchanged.
"""
import math


def apply_tunnel_decks(race, sampled):
    nodes = race['road']['nodes']
    structures = ['tunnel' if p.get('tags', {}).get('tunnel') == 'yes' else 'road'
                  for p in sampled[:-1]]
    spans = []
    start = 0
    while start < len(structures):
        end = start + 1
        while end < len(structures) and structures[end] == structures[start]:
            end += 1
        spans.append((start, end, structures[start]))
        if structures[start] == 'tunnel':
            distances = [0]
            for a, b in zip(nodes[start:end], nodes[start+1:end+1]):
                distances.append(distances[-1] + math.hypot(b['x']-a['x'], b['y']-a['y']))
            first, last = nodes[start]['elevation'], nodes[end]['elevation']
            for i, distance in enumerate(distances):
                nodes[start+i]['elevation'] = first + (last-first)*distance/max(.001, distances[-1])
        start = end
    if not any(kind == 'tunnel' for _, _, kind in spans):
        raise ValueError('Requested tunnel is absent from the selected road trace')
    for segment, node in zip(race['road']['segments'], nodes[1:]):
        segment['elevation'] = node['elevation']
    def point(i):
        n = nodes[i]
        return dict(x=n['x'], z=n['y'], heightM=n['elevation']*12)
    network_nodes = [dict(id=f'n-{i}', **point(i)) for i in [spans[0][0], *[end for _, end, _ in spans]]]
    edges = []
    for index, (start, end, kind) in enumerate(spans):
        edges.append(dict(id=f'structure-{index}', from_=f'n-{start}', to=f'n-{end}',
                          points=[point(i) for i in range(start+1, end)], structure=kind,
                          widthM=race['road']['width'], surface='asphalt', clearanceM=4,
                          thicknessM=.5, bidirectional=True))
        edges[-1]['from'] = edges[-1].pop('from_')
    race['road']['network'] = dict(version=1, nodes=network_nodes, edges=edges,
                                 startNodeId=network_nodes[0]['id'], finishNodeId=network_nodes[-1]['id'])
    return [dict(startPoint=a, endPoint=b, method='Distance-linear deck between DEM portal estimates')
            for a, b, kind in spans if kind == 'tunnel']
