"""Dobor podzbioru warstwy rzeczywistej ze zbioru SecBench.js.

Uruchamiac w katalogu zawierajacym piec katalogow klas podatnosci
(code-injection, command-injection, path-traversal, prototype-pollution, redos).

Kryteria wlaczenia:
  1. obecnosc wersji naprawionej (fixedVersion != n/a),
  2. obecnosc rewizji naprawiajacej (fixCommit != n/a),
  3. obecnosc lokalizacji ujscia (sink != n/a),
  4. obecnosc deklaracji zaleznosci,
  5. wersja naprawiona wyzsza od podatnej (wpisy o wersjach identycznych
     sa odrzucane, poniewaz skanowanie tego samego kodu dwukrotnie
     uniemozliwia pomiar wynikow falszywie dodatnich),
  6. oba numery wersji sa dokladne, bez operatorow zakresu.

Dobor jest dwufazowy. Ten skrypt zapisuje uporzadkowana liste kandydatow
(candidates.csv). Skrypt pobierajacy przyjmuje pierwsze PER_CLASS pozycji
na klase, ktore przejda weryfikacje: pakiet daje sie pobrac w obu wersjach
i plik wskazany jako ujscie istnieje w obu. Kandydaci nieprzechodzacy
weryfikacji sa pomijani, co eliminuje wpisy z nieistniejacymi wersjami
lub blednymi sciezkami bez wprowadzania recznych wyjatkow.

Preferencja doboru: najpierw wpisy roznaice sie numerem korekty, nastepnie
numerem wydania pobocznego, na koncu glownego. W obrebie tej samej kategorii
porzadek alfabetyczny po identyfikatorze, co zapewnia odtwarzalnosc.
"""

import collections
import csv
import json
import pathlib

CLASSES = {
    'code-injection':      ('CWE-094', 'Wstrzykniecie kodu'),
    'command-injection':   ('CWE-078', 'Wstrzykniecie polecen systemowych'),
    'path-traversal':      ('CWE-022', 'Przejscie przez katalogi'),
    'prototype-pollution': ('CWE-1321', 'Zanieczyszczenie prototypu'),
    'redos':               ('CWE-1333', 'Odmowa uslugi ReDoS'),
}

NA = {'', 'n/a', 'N/A', 'na', None}
RANK = {'patch': 0, 'minor': 1, 'major': 2}
PER_CLASS = 5


def parse_version(value):
    core = value.split('-')[0].split('.')
    return [int(x) if x.isdigit() else 0 for x in (core + ['0', '0', '0'])[:3]]


def version_gap(vulnerable, fixed):
    """Zwraca 'patch', 'minor', 'major' albo None gdy wersja naprawiona
    nie jest wyzsza od podatnej."""
    a, b = parse_version(vulnerable), parse_version(fixed)
    if b <= a:
        return None
    if b[0] != a[0]:
        return 'major'
    if b[1] != a[1]:
        return 'minor'
    return 'patch'


def collect():
    pools = collections.defaultdict(list)
    rejected = []
    totals = collections.Counter()

    for cls, (cwe, label) in CLASSES.items():
        base = pathlib.Path(cls)
        if not base.is_dir():
            print('OSTRZEZENIE: brak katalogu {}'.format(cls))
            continue

        for entry in sorted(p for p in base.iterdir() if p.is_dir()):
            meta = entry / 'package.json'
            if not meta.exists():
                continue
            totals[cls] += 1

            try:
                data = json.loads(meta.read_text(encoding='utf-8'))
            except ValueError:
                rejected.append((entry.name, cls, 'niepoprawny plik metadanych'))
                continue

            entry_id = data.get('id') or entry.name

            if data.get('fixedVersion') in NA:
                rejected.append((entry_id, cls, 'brak fixedVersion'))
                continue
            if data.get('fixCommit') in NA:
                rejected.append((entry_id, cls, 'brak fixCommit'))
                continue
            if data.get('sink') in NA:
                rejected.append((entry_id, cls, 'brak sink'))
                continue


            dependencies = data.get('dependencies') or {}
            if not dependencies:
                rejected.append((entry_id, cls, 'brak dependencies'))
                continue

            package, vulnerable = list(dependencies.items())[0]
            fixed = data['fixedVersion']

            if not all(v[:1].isdigit() for v in (vulnerable, fixed)):
                rejected.append((entry_id, cls, 'numer wersji nie jest dokladny'))
                continue

            gap = version_gap(vulnerable, fixed)
            if gap is None:
                rejected.append((entry_id, cls, 'wersja naprawiona nie wyzsza od podatnej'))
                continue

            parts = data['sink'].rsplit(':', 2)
            pools[cls].append({
                'id': entry_id,
                'cwe': cwe,
                'class': label,
                'package': package,
                'vulnerable_version': vulnerable,
                'fixed_version': fixed,
                'version_gap': gap,
                'fix_commit': data['fixCommit'],
                'sink_file': parts[0],
                'sink_line': parts[1] if len(parts) == 3 else '',
                'entry_dir': str(entry),
            })

    return pools, rejected, totals


def main():
    pools, rejected, totals = collect()

    print('KROK 1. Liczebnosc wpisow i pul po zastosowaniu kryteriow')
    print('{:22s} {:>7s} {:>9s}'.format('klasa', 'wpisow', 'w puli'))
    for cls in CLASSES:
        print('  {:20s} {:7d} {:9d}'.format(cls, totals[cls], len(pools[cls])))
    print('  {:20s} {:7d} {:9d}'.format(
        'RAZEM', sum(totals.values()), sum(len(v) for v in pools.values())))

    print('\nKROK 2. Rozklad odstepu wersji w pulach')
    print('{:22s} {:>6s} {:>7s} {:>7s}'.format('klasa', 'patch', 'minor', 'major'))
    for cls in CLASSES:
        cnt = collections.Counter(r['version_gap'] for r in pools[cls])
        print('  {:20s} {:6d} {:7d} {:7d}'.format(
            cls, cnt['patch'], cnt['minor'], cnt['major']))

    candidates = []
    for cls in CLASSES:
        ordered = sorted(pools[cls], key=lambda r: (RANK[r['version_gap']], r['id']))
        for rank, row in enumerate(ordered, start=1):
            row['rank'] = rank
            candidates.append(row)

    print('\nKROK 3. Pierwszych {} kandydatow w kazdej klasie'.format(PER_CLASS))
    for cls in CLASSES:
        for row in [r for r in candidates if r['class'] == CLASSES[cls][1]][:PER_CLASS]:
            print('  {:9s} {:2d} {:22s} {:26s} {:11s} -> {:11s} {}'.format(
                row['cwe'], row['rank'], row['id'][:22], row['package'][:26],
                row['vulnerable_version'], row['fixed_version'], row['version_gap']))

    if not candidates:
        print('\nBLAD: nie znaleziono zadnego kandydata, sprawdz strukture katalogow')
        return

    with open('candidates.csv', 'w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(candidates[0].keys()))
        writer.writeheader()
        writer.writerows(candidates)

    print('\nKROK 4. Zapis')
    print('  zapisano {} kandydatow -> candidates.csv'.format(len(candidates)))
    print('  docelowo {} wpisow ({} na klase), wybor konczy skrypt pobierajacy'.format(
        PER_CLASS * len(CLASSES), PER_CLASS))
    thin = [(cls, len(pools[cls])) for cls in CLASSES if len(pools[cls]) < PER_CLASS * 2]
    if thin:
        print('  UWAGA: waskie pule, mozliwy niedobor po weryfikacji:')
        for cls, n in thin:
            print('    {} - kandydatow {}'.format(cls, n))

    print('\nKROK 5. Odrzucenia ({} wpisow)'.format(len(rejected)))
    for reason, n in collections.Counter(x[2] for x in rejected).most_common():
        print('  {}: {}'.format(reason, n))

    print('\n  w podziale na klasy:')
    for (cls, reason), n in sorted(collections.Counter(
            (x[1], x[2]) for x in rejected).items()):
        print('    {:20s} {}: {}'.format(cls, reason, n))

    errors = [x for x in rejected if x[2] in (
        'wersja naprawiona nie wyzsza od podatnej',
        'numer wersji nie jest dokladny')]
    if errors:
        print('\n  wpisy o niespojnych metadanych wersji:')
        for entry_id, cls, _ in errors:
            print('    {} ({})'.format(entry_id, cls))

    with open('rejected.csv', 'w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle)
        writer.writerow(['id', 'class', 'reason'])
        writer.writerows(rejected)
    print('\n  pelna lista odrzucen -> rejected.csv')


if __name__ == '__main__':
    main()