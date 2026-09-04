import subprocess, time, pathlib

SRC = 'synthetic/CWE-089'   # katalog, z którego bierzemy pliki
files = sorted(pathlib.Path(SRC).glob('*.js'))[:5]

for i, src in enumerate(files, start=1):
    branch = f'pomiar-{i}'
    subprocess.run(f'git checkout main && git pull', shell=True, check=True)
    subprocess.run(f'git checkout -b {branch}', shell=True, check=True)
    dest = pathlib.Path('measure') / f'case_{i}.js'
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(src.read_text(encoding='utf-8'), encoding='utf-8')
    subprocess.run(f'git add {dest} && git commit -m "Pomiar {i}"', shell=True, check=True)
    subprocess.run(f'git push -u origin {branch}', shell=True, check=True)
    subprocess.run(f'gh pr create --base main --head {branch} '
                   f'--title "Pomiar czasu {i}" --body "Pomiar czasu do informacji zwrotnej"',
                   shell=True, check=True)
    print(f'utworzono zadanie {i}, przerwa 6 minut')
    time.sleep(360)