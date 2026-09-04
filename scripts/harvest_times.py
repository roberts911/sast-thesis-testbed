"""Zebranie pomiarow czasu do informacji zwrotnej na zadaniu scalenia.

Metryka zdefiniowana w podrozdziale 3.4: czas od utworzenia zadania scalenia
do chwili udostepnienia zgloszen w widoku przegladu zmian. Punktem koncowym
jest znacznik zakonczenia kontroli rejestrowanej przez narzedzie w tym widoku.

Wymaga zalogowanego narzedzia gh z uprawnieniem do odczytu repozytorium.
Uruchamiac po zakonczeniu wszystkich uruchomien serii:
    python scripts/harvest_times.py
"""

import collections
import csv
import datetime
import json
import statistics
import subprocess
import sys

REPO = 'roberts911/sast-thesis-testbed'
TITLE_PREFIX = 'Pomiar czasu'
OUTPUT = 'results/feedback_times.csv'


def api(path):
    result = subprocess.run('gh api "{}"'.format(path), shell=True,
                            capture_output=True, text=True,
                            encoding='utf-8', errors='replace')
    if result.returncode != 0:
        print('Blad wywolania interfejsu: {}'.format(result.stderr.strip()))
        sys.exit(1)
    return json.loads(result.stdout)


def moment(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))


def collect():
    rows = []
    pulls = api('repos/{}/pulls?state=all&per_page=100'.format(REPO))

    for pull in pulls:
        if not pull['title'].startswith(TITLE_PREFIX):
            continue
        created = moment(pull['created_at'])
        sha = pull['head']['sha']

        checks = api('repos/{}/commits/{}/check-runs?per_page=100'.format(REPO, sha))
        for run in checks.get('check_runs', []):
            if not run.get('completed_at'):
                continue
            rows.append({
                'zadanie': pull['number'],
                'kontrola': run['name'],
                'utworzenie': pull['created_at'],
                'zakonczenie': run['completed_at'],
                'sekundy': round((moment(run['completed_at']) - created).total_seconds()),
                'wynik': run.get('conclusion') or '',
            })
    return rows


def main():
    rows = collect()
    if not rows:
        print('Nie znaleziono zadan o tytule rozpoczynajacym sie od "{}".'.format(
            TITLE_PREFIX))
        print('Sprawdz, czy seria zostala utworzona i czy uruchomienia sie zakonczyly.')
        return

    print('POMIARY JEDNOSTKOWE')
    print('{:>8s}  {:38s} {:>9s}  {}'.format('zadanie', 'kontrola',
                                             'sekundy', 'wynik'))
    for row in sorted(rows, key=lambda r: (r['kontrola'], r['zadanie'])):
        print('{:>8d}  {:38s} {:9d}  {}'.format(
            row['zadanie'], row['kontrola'][:38], row['sekundy'], row['wynik']))

    grouped = collections.defaultdict(list)
    for row in rows:
        grouped[row['kontrola']].append(row['sekundy'])

    print('\nPODSUMOWANIE WEDLUG KONTROLI')
    for name in sorted(grouped):
        values = grouped[name]
        odch = statistics.stdev(values) if len(values) > 1 else 0.0
        print('  {:38s} n={}'.format(name[:38], len(values)))
        print('    srednia {:.0f} s | mediana {:.0f} s | min {:.0f} s | '
              'maks {:.0f} s | odch. std. {:.0f} s'.format(
                  statistics.mean(values), statistics.median(values),
                  min(values), max(values), odch))

    try:
        with open(OUTPUT, 'w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        print('\nZapisano {} pomiarow -> {}'.format(len(rows), OUTPUT))
    except OSError as error:
        print('\nNie udalo sie zapisac pliku {}: {}'.format(OUTPUT, error))


if __name__ == '__main__':
    main()