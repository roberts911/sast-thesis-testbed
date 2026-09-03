"""Ewaluacja skanerow SAST wzgledem korpusu syntetycznego.

Kluczowa zasada: zgloszenie liczy sie jako wykrycie TYLKO wtedy, gdy dotyczy tej samej
klasy podatnosci co oczekiwana dla danego pliku. Zliczanie dowolnego zgloszenia zawyza
zarowno TP (plik "wykryty" regula o innej semantyce), jak i FP (pliki bezpieczne
oflagowane szumem w rodzaju missing-rate-limiting czy x-powered-by).
"""

import json
import os

import pandas as pd

# --- Mapy regula -> klasa CWE z ground truth -------------------------------------
# Puste zbiory oznaczaja reguly nieistotne dla badanych klas (szum).

CODEQL_RULE_TO_CWE = {
    'js/code-injection': {'CWE-094'},
    'js/command-line-injection': {'CWE-078'},
    'js/sql-injection': {'CWE-089'},
    'js/reflected-xss': {'CWE-079'},
    'js/bad-tag-filter': {'CWE-079'},
    # Niekompletna sanityzacja wieloznakowa - trafia zarowno w naiwny filtr "../",
    # jak i w regexowe czyszczenie HTML.
    'js/incomplete-multi-character-sanitization': {'CWE-022', 'CWE-079'},
    'js/path-injection': {'CWE-022'},
    'js/zipslip': {'CWE-022'},
    'js/prototype-pollution-utility': {'CWE-1321'},
    'js/remote-property-injection': {'CWE-1321'},
    'js/redos': {'CWE-1333'},
    'js/polynomial-redos': {'CWE-1333'},
    'js/regex-injection': {'CWE-1333'},
    'js/insufficient-password-hash': {'CWE-327'},
    'js/request-forgery': {'CWE-020'},
    # Szum wzgledem badanych klas:
    'js/missing-rate-limiting': set(),
    'js/log-injection': set(),
    'js/resource-exhaustion': set(),
    'js/unvalidated-dynamic-method-call': set(),
}

SONAR_RULE_TO_CWE = {
    'jssecurity:S3649': {'CWE-089'},
    'tssecurity:S3649': {'CWE-089'},
    'jssecurity:S5147': {'CWE-089', 'CWE-020'},
    'jssecurity:S2076': {'CWE-078'},
    'jssecurity:S6350': {'CWE-078'},
    'tssecurity:S6350': {'CWE-078'},
    'jssecurity:S2083': {'CWE-022'},
    'tssecurity:S2083': {'CWE-022'},
    'jssecurity:S5131': {'CWE-079'},
    'javascript:S7790': {'CWE-079'},
    'jssecurity:S5334': {'CWE-094'},
    'tssecurity:S5334': {'CWE-094'},
    'javascript:S1523': {'CWE-094'},
    'typescript:S1523': {'CWE-094'},
    'jssecurity:S6109': {'CWE-1321'},
    'jssecurity:S2631': {'CWE-1333'},
    'javascript:S5852': {'CWE-1333'},
    'typescript:S5852': {'CWE-1333'},
    'javascript:S4790': {'CWE-327'},
    'javascript:S2068': {'CWE-798'},
    'javascript:S6418': {'CWE-798'},
    'secrets:S6290': {'CWE-798'},
    'secrets:S6689': {'CWE-798'},
    'secrets:S8217': {'CWE-798'},
    'jssecurity:S7044': {'CWE-020'},
    'tssecurity:S5144': {'CWE-020'},
}


def load_codeql(path='codeql_alerts.json'):
    """Zwraca liste krotek (nazwa_pliku, regula, linia)."""
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            alerts = json.load(handle)
    except FileNotFoundError:
        print('Brak pliku {}. Pomijam analize CodeQL.'.format(path))
        return []

    findings = []
    for alert in alerts:
        location = alert.get('most_recent_instance', {}).get('location', {})
        if not location.get('path'):
            continue
        findings.append(
            (os.path.basename(location['path']), alert['rule']['id'], location.get('start_line'))
        )
    return findings


def load_sonar(path='sonar_issues.json'):
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            payload = json.load(handle)
    except FileNotFoundError:
        print('Brak pliku {}. Pomijam analize SonarQube.'.format(path))
        return []

    findings = []
    for issue in payload.get('issues', []):
        component = issue.get('component', '')
        file_path = component.split(':', 1)[1] if ':' in component else component
        findings.append((os.path.basename(file_path), issue.get('rule'), issue.get('line')))
    return findings


def build_detection_maps(findings, rule_map, known_files):
    """Zwraca (wykrycia_wg_CWE, wykrycia_dowolne, reguly_nieprzypisane)."""
    matched = {}
    any_finding = {name: False for name in known_files}
    unmapped = set()

    for filename, rule, _line in findings:
        if filename not in any_finding:
            continue
        any_finding[filename] = True

        if rule not in rule_map:
            unmapped.add(rule)
            continue
        matched.setdefault(filename, set()).update(rule_map[rule])

    return matched, any_finding, unmapped


def evaluate_scanners():
    try:
        df = pd.read_csv('synthetic/ground_truth.csv')
    except FileNotFoundError:
        print('Blad: Nie znaleziono pliku synthetic/ground_truth.csv')
        return

    df['filename'] = df['file'].apply(os.path.basename)
    known = set(df['filename'])

    cq_matched, cq_any, cq_unmapped = build_detection_maps(
        load_codeql(), CODEQL_RULE_TO_CWE, known
    )
    sq_matched, sq_any, sq_unmapped = build_detection_maps(
        load_sonar(), SONAR_RULE_TO_CWE, known
    )

    df['codeql_detected'] = df.apply(
        lambda r: r['cwe'] in cq_matched.get(r['filename'], set()), axis=1
    )
    df['sonar_detected'] = df.apply(
        lambda r: r['cwe'] in sq_matched.get(r['filename'], set()), axis=1
    )
    df['codeql_any_finding'] = df['filename'].map(cq_any)
    df['sonar_any_finding'] = df['filename'].map(sq_any)

    def metrics(column):
        tp = int((df['expected_finding'] & df[column]).sum())
        fp = int((~df['expected_finding'] & df[column]).sum())
        fn = int((df['expected_finding'] & ~df[column]).sum())
        tn = int((~df['expected_finding'] & ~df[column]).sum())
        return tp, fp, fn, tn

    def report(name, column):
        tp, fp, fn, tn = metrics(column)
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

        print('{}:'.format(name))
        print('  TP (wykryte luki):       {}/50'.format(tp))
        print('  FN (przeoczone luki):    {}/50'.format(fn))
        print('  FP (falszywe alarmy):    {}/50'.format(fp))
        print('  TN (poprawne milczenie): {}/50'.format(tn))
        print('  Precision: {:.3f} | Recall: {:.3f} | F1: {:.3f}'.format(precision, recall, f1))

    print('=' * 62)
    print('WYNIKI EWALUACJI SAST - zgloszenie dopasowane do klasy CWE')
    print('=' * 62)
    report('CodeQL', 'codeql_detected')
    print('-' * 62)
    report('SonarQube Cloud', 'sonar_detected')
    print('=' * 62)

    print('\nKONTROLA: zliczanie DOWOLNEGO zgloszenia (metoda bledna, dla porownania)')
    for name, column in (('CodeQL', 'codeql_any_finding'), ('Sonar', 'sonar_any_finding')):
        tp, fp, fn, tn = metrics(column)
        print('  {:8s} TP={:2d} FP={:2d} FN={:2d} TN={:2d}'.format(name, tp, fp, fn, tn))

    if cq_unmapped:
        print('\nReguly CodeQL nieprzypisane do zadnej badanej klasy:')
        for rule in sorted(cq_unmapped):
            print('  ' + rule)
    if sq_unmapped:
        print('\nReguly Sonara nieprzypisane do zadnej badanej klasy: {}'.format(len(sq_unmapped)))

    df.to_csv('final_evaluation_matrix.csv', index=False)
    print("\nZapisano macierz do 'final_evaluation_matrix.csv'")


if __name__ == '__main__':
    evaluate_scanners()
