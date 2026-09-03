"""Pobranie warstwy rzeczywistej: druga faza doboru.

Czyta candidates.csv (uporzadkowana lista kandydatow z select.py) i dla kazdej
klasy przyjmuje pierwsze PER_CLASS pozycji, ktore przejda weryfikacje:
  - pakiet daje sie pobrac w wersji podatnej i naprawionej,
  - plik wskazany jako ujscie istnieje w obu wersjach.

Kandydaci nieprzechodzacy weryfikacji sa pomijani i odnotowywani
w skipped.csv. Przyjete wpisy trafiaja do selection.csv oraz do katalogu
real/<id>_<pakiet>/{vulnerable,fixed}.

Uruchamiac w katalogu repozytorium badawczego, po skopiowaniu candidates.csv.
"""

import collections
import csv
import json
import pathlib
import shutil
import subprocess
import tarfile

ROOT = pathlib.Path('real')
TMP = pathlib.Path('tmp_pack')
NPM = 'npm.cmd'          # w systemach uniksowych zmienic na 'npm'
PER_CLASS = 5


def run_npm_pack(spec):
    return subprocess.run(
        '{} pack {} --pack-destination "{}"'.format(NPM, spec, TMP),
        capture_output=True, text=True, shell=True,
        encoding='utf-8', errors='replace')


def fetch(package, version, dest):
    TMP.mkdir(exist_ok=True)
    for old in TMP.glob('*.tgz'):
        old.unlink()

    result = run_npm_pack('{}@{}'.format(package, version))
    if result.returncode != 0:
        text = (result.stderr or result.stdout or '')
        reason = next((l.strip() for l in text.splitlines()
                       if 'ETARGET' in l or 'E404' in l or 'notarget' in l),
                      'npm pack rc={}'.format(result.returncode))
        return False, reason

    archives = sorted(TMP.glob('*.tgz'), key=lambda p: p.stat().st_mtime)
    if not archives:
        return False, 'brak archiwum po npm pack'

    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archives[-1]) as archive:
        for member in archive.getmembers():
            parts = pathlib.PurePosixPath(member.name).parts
            if len(parts) < 2 or not member.isfile():
                continue
            target = dest / pathlib.Path(*parts[1:])
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as source, open(target, 'wb') as out:
                shutil.copyfileobj(source, out)
    archives[-1].unlink()
    return True, ''


def entry_dir(row):
    return ROOT / '{}_{}'.format(row['id'].replace('/', '_'),
                                 row['package'].replace('/', '_'))


def verify(row):
    """Pobiera obie wersje i sprawdza obecnosc pliku ujscia. Zwraca (ok, powod)."""
    base = entry_dir(row)
    for label, version in (('vulnerable', row['vulnerable_version']),
                           ('fixed', row['fixed_version'])):
        ok, reason = fetch(row['package'], version, base / label)
        if not ok:
            return False, 'wersja {} niedostepna ({})'.format(version, reason)

    for label in ('vulnerable', 'fixed'):
        if not (base / label / row['sink_file']).exists():
            return False, 'brak pliku ujscia {} w wersji {}'.format(
                row['sink_file'], label)
    return True, ''


def main():
    rows = list(csv.DictReader(open('candidates.csv', encoding='utf-8')))
    by_class = collections.defaultdict(list)
    for row in rows:
        by_class[row['cwe']].append(row)

    accepted, skipped = [], []

    for cwe in sorted(by_class):
        taken = 0
        for row in by_class[cwe]:
            if taken >= PER_CLASS:
                break
            print('{:9s} {:26s} {:10s} -> {:10s} '.format(
                cwe, row['package'][:26],
                row['vulnerable_version'], row['fixed_version']), end='')

            ok, reason = verify(row)
            if ok:
                base = entry_dir(row)
                (base / 'meta.json').write_text(
                    json.dumps(row, indent=2, ensure_ascii=False),
                    encoding='utf-8')
                accepted.append(row)
                taken += 1
                print('PRZYJETY ({}/{})'.format(taken, PER_CLASS))
            else:
                shutil.rmtree(entry_dir(row), ignore_errors=True)
                skipped.append({'id': row['id'], 'cwe': cwe,
                                'package': row['package'], 'reason': reason})
                print('POMINIETY: {}'.format(reason))

        if taken < PER_CLASS:
            print('  UWAGA: dla {} przyjeto tylko {} z {}'.format(
                cwe, taken, PER_CLASS))

    shutil.rmtree(TMP, ignore_errors=True)

    if accepted:
        with open('selection.csv', 'w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=list(accepted[0].keys()))
            writer.writeheader()
            writer.writerows(accepted)

    if skipped:
        with open('skipped.csv', 'w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=['id', 'cwe',
                                                        'package', 'reason'])
            writer.writeheader()
            writer.writerows(skipped)

    print('\nPODSUMOWANIE')
    print('  przyjetych: {} z {}'.format(len(accepted), PER_CLASS * len(by_class)))
    for cwe in sorted(by_class):
        print('    {}: {}'.format(cwe, sum(1 for r in accepted if r['cwe'] == cwe)))
    print('  pominietych przy weryfikacji: {}'.format(len(skipped)))
    for reason, n in collections.Counter(
            s['reason'].split(' (')[0] for s in skipped).most_common():
        print('    {}: {}'.format(reason, n))
    print('\n  wykaz -> selection.csv, pominiecia -> skipped.csv')
    print('  artefaktow w katalogu real: {}'.format(len(accepted) * 2))


if __name__ == '__main__':
    main()