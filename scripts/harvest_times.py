import json, subprocess, datetime, statistics, collections

REPO = 'roberts911/sast-thesis-testbed'

def api(path):
    out = subprocess.run(f'gh api "{path}"', shell=True,
                         capture_output=True, text=True, encoding='utf-8')
    return json.loads(out.stdout)

def ts(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))

prs = api(f'repos/{REPO}/pulls?state=all&per_page=50')
rows = []
for pr in prs:
    if not pr['title'].startswith('Pomiar czasu'):
        continue
    created = ts(pr['created_at'])
    sha = pr['head']['sha']
    checks = api(f'repos/{REPO}/commits/{sha}/check-runs?per_page=50')
    for run in checks.get('check_runs', []):
        if not run.get('completed_at'):
            continue
        rows.append({
            'pr': pr['number'],
            'kontrola': run['name'],
            'sekundy': (ts(run['completed_at']) - created).total_seconds(),
            'wynik': run['conclusion'],
        })

for r in sorted(rows, key=lambda x: (x['kontrola'], x['pr'])):
    print('#{:>3} {:40s} {:7.0f} s  {}'.format(
        r['pr'], r['kontrola'][:40], r['sekundy'], r['wynik']))

print('\npodsumowanie:')
by = collections.defaultdict(list)
for r in rows:
    by[r['kontrola']].append(r['sekundy'])
for name, vals in by.items():
    print('  {:40s} n={} srednia {:.0f} s | mediana {:.0f} s | min {:.0f} | max {:.0f}'.format(
        name[:40], len(vals), statistics.mean(vals), statistics.median(vals),
        min(vals), max(vals)))