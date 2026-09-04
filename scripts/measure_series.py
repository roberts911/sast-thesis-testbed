"""Utworzenie serii zadan scalenia do pomiaru czasu do informacji zwrotnej.

Kazde zadanie wprowadza jeden plik z jedna podatnoscia, co odwzorowuje typowa
zmiane zgłaszaną do przegladu. Miedzy kolejnymi zadaniami zachowana jest
przerwa, aby uruchomienia obu przeplywow pracy nie konkurowaly o maszyny
wykonawcze, co zaburzaloby pomiar.

Uruchamiac w katalogu glownym repozytorium, na czystym drzewie roboczym:
    python scripts/measure_series.py

Zadan pomiarowych NIE scala sie do galezi glownej. Po zebraniu pomiarow
skryptem harvest_times.py zadania nalezy zamknac, a galezie usunac.
"""

import pathlib
import subprocess
import sys
import time

SOURCE_DIR = 'synthetic/CWE-089'   # katalog, z ktorego pobierane sa pliki
TARGET_DIR = 'measure'             # katalog docelowy w galezi pomiarowej
CASES = 5                          # liczba zadan scalenia
PAUSE_SECONDS = 360                # przerwa miedzy zadaniami


def run(command, check=True, capture=False):
    return subprocess.run(command, shell=True, check=check,
                          capture_output=capture, text=True,
                          encoding='utf-8', errors='replace')


def require_clean_tree():
    status = run('git status --porcelain', capture=True).stdout.strip()
    if status:
        print('Drzewo robocze nie jest czyste, przerwano. Niezatwierdzone zmiany:')
        print(status)
        sys.exit(1)


def collect_sources():
    base = pathlib.Path(SOURCE_DIR)
    if not base.is_dir():
        print('Brak katalogu {}, przerwano.'.format(SOURCE_DIR))
        sys.exit(1)
    files = sorted(p for p in base.iterdir()
                   if p.is_file() and p.suffix in ('.js', '.ts'))
    if len(files) < CASES:
        print('W katalogu {} jest {} plikow, wymagane {}.'.format(
            SOURCE_DIR, len(files), CASES))
        sys.exit(1)
    return files[:CASES]


def main():
    require_clean_tree()
    sources = collect_sources()

    print('Seria pomiarowa: {} zadan scalenia, przerwa {} s miedzy nimi.'.format(
        CASES, PAUSE_SECONDS))
    print('Zrodlo plikow: {}\n'.format(SOURCE_DIR))

    created = []

    for index, source in enumerate(sources, start=1):
        branch = 'pomiar-{}'.format(index)

        run('git checkout main', check=True)
        run('git pull', check=True)

        # usuniecie pozostalosci po ewentualnym nieudanym przebiegu
        run('git branch -D {}'.format(branch), check=False, capture=True)
        run('git checkout -b {}'.format(branch), check=True)

        target = pathlib.Path(TARGET_DIR) / 'case_{}{}'.format(index, source.suffix)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source.read_text(encoding='utf-8'), encoding='utf-8')

        run('git add "{}"'.format(target.as_posix()), check=True)
        run('git commit -m "Pomiar czasu {}: {}"'.format(index, source.name),
            check=True)
        run('git push -u origin {}'.format(branch), check=True)
        run('gh pr create --base main --head {} '
            '--title "Pomiar czasu {}" '
            '--body "Pomiar czasu do informacji zwrotnej, plik {}"'.format(
                branch, index, source.name), check=True)

        created.append(branch)
        print('  utworzono zadanie {} z {} (galaz {}, plik {})'.format(
            index, CASES, branch, source.name))

        if index < CASES:
            print('  przerwa {} s...'.format(PAUSE_SECONDS))
            time.sleep(PAUSE_SECONDS)

    run('git checkout main', check=True)

    print('\nUtworzono {} zadan scalenia: {}'.format(len(created),
                                                     ', '.join(created)))
    print('Odczekaj na zakonczenie obu przeplywow pracy w kazdym zadaniu,')
    print('nastepnie uruchom: python scripts/harvest_times.py')


if __name__ == '__main__':
    main()