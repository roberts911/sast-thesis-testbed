"""Ewaluacja skanerow SAST na dwuwarstwowym zbiorze badawczym.

Zrodla danych:
  codeql_full.sarif   - pelna analiza CodeQL galezi glownej (format SARIF 2.1.0)
  sonar_full.json     - pelny eksport zgloszen SonarQube Cloud (galaz glowna)
  synthetic/ground_truth.csv - wykaz referencyjny warstwy syntetycznej
  real/*/meta.json           - wykazy referencyjne warstwy rzeczywistej

Zasady klasyfikacji (podrozdzial 3.3):
  TP - zgloszenie dopasowane lokalizacyjnie i klasowo do wpisu referencyjnego,
       zgloszenia wielokrotne wskazujace ten sam wpis liczone jednokrotnie,
  FP - zgloszenie o istotnosci bezpieczenstwa w artefakcie, dla ktorego nie
       oczekuje sie wykrycia (pula kontrolna, wersja naprawiona),
  FN - wpis referencyjny bez dopasowanego zgloszenia.

Dopasowanie lokalizacji: okno +/-N wierszy wokol wiersza ujscia, sprawdzane dla
lokalizacji glownej zgloszenia oraz dla kazdego kroku jego sciezki przeplywu.
Dopasowanie klasy: rownosc identyfikatora CWE albo przynaleznosc do tej samej
grupy hierarchicznej taksonomii.
"""

import collections
import csv
import json
import pathlib

N_WINDOW = 10

# --- Grupy hierarchiczne CWE ----------------------------------------------
# Kazda grupa obejmuje klase badana wraz z jej odpowiednikami nadrzednymi
# i podrzednymi w taksonomii, co realizuje dopasowanie hierarchiczne.
CWE_GROUPS = [
    {'CWE-094', 'CWE-095', 'CWE-096', 'CWE-470', 'CWE-1336'},
    {'CWE-078', 'CWE-077', 'CWE-088'},
    {'CWE-089', 'CWE-564', 'CWE-943'},
    {'CWE-079', 'CWE-080', 'CWE-116'},
    {'CWE-022', 'CWE-023', 'CWE-036', 'CWE-073', 'CWE-706'},
    {'CWE-1321', 'CWE-915', 'CWE-471'},
    {'CWE-1333', 'CWE-400', 'CWE-407', 'CWE-730'},
    {'CWE-798', 'CWE-259', 'CWE-321', 'CWE-522'},
    {'CWE-327', 'CWE-326', 'CWE-328', 'CWE-916'},
    {'CWE-020', 'CWE-129', 'CWE-1284'},
    {'CWE-330', 'CWE-338', 'CWE-335'},
]


def norm_cwe(value):
    digits = ''.join(c for c in str(value) if c.isdigit())
    return 'CWE-{:03d}'.format(int(digits)) if digits else ''


def class_match(reported, expected):
    reported, expected = norm_cwe(reported), norm_cwe(expected)
    if not reported or not expected:
        return False
    if reported == expected:
        return True
    return any(reported in g and expected in g for g in CWE_GROUPS)


# --- Odwzorowanie regul na klasy CWE --------------------------------------
CODEQL_RULES = {
    'js/code-injection': {'CWE-094'},
    'js/unsafe-code-construction': {'CWE-094'},
    'js/command-line-injection': {'CWE-078'},
    'js/shell-command-constructed-from-input': {'CWE-078'},
    'js/shell-command-injection-from-environment': {'CWE-078'},
    'js/sql-injection': {'CWE-089'},
    'js/reflected-xss': {'CWE-079'},
    'js/stored-xss': {'CWE-079'},
    'js/xss': {'CWE-079'},
    'js/bad-tag-filter': {'CWE-079'},
    'js/incomplete-multi-character-sanitization': {'CWE-022', 'CWE-079'},
    'js/path-injection': {'CWE-022'},
    'js/zipslip': {'CWE-022'},
    'js/prototype-pollution-utility': {'CWE-1321'},
    'js/prototype-polluting-assignment': {'CWE-1321'},
    'js/remote-property-injection': {'CWE-1321'},
    'js/redos': {'CWE-1333'},
    'js/polynomial-redos': {'CWE-1333'},
    'js/regex-injection': {'CWE-1333'},
    'js/insufficient-password-hash': {'CWE-327'},
    'js/weak-cryptographic-algorithm': {'CWE-327'},
    'js/insecure-randomness': {'CWE-330'},
    'js/hardcoded-credentials': {'CWE-798'},
    'js/request-forgery': {'CWE-020'},
}

SONAR_RULES = {
    'jssecurity:S3649': {'CWE-089'},
    'tssecurity:S3649': {'CWE-089'},
    'jssecurity:S5147': {'CWE-089', 'CWE-020'},
    'jssecurity:S2076': {'CWE-078'},
    'jssecurity:S6350': {'CWE-078'},
    'tssecurity:S6350': {'CWE-078'},
    'javascript:S4036': {'CWE-078'},
    'typescript:S4036': {'CWE-078'},
    'jssecurity:S2083': {'CWE-022'},
    'tssecurity:S2083': {'CWE-022'},
    'jssecurity:S6549': {'CWE-022'},
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
    'javascript:S2245': {'CWE-330'},
    'javascript:S2068': {'CWE-798'},
    'javascript:S6418': {'CWE-798'},
    'secrets:S6290': {'CWE-798'},
    'secrets:S6689': {'CWE-798'},
    'secrets:S8217': {'CWE-798'},
    'jssecurity:S7044': {'CWE-020'},
    'tssecurity:S5144': {'CWE-020'},
}


# --- Wpisy referencyjne ---------------------------------------------------
def load_reference():
    """Zwraca liste artefaktow: (sciezka_prefix, warstwa, oczekiwane, cwe, linia, meta)."""
    items = []

    for row in csv.DictReader(open('synthetic/ground_truth.csv', encoding='utf-8')):
        expected = str(row['expected_finding']).strip().lower() == 'true'
        items.append({
            'key': 'synthetic/' + row['file'].replace('\\', '/'),
            'layer': 'syntetyczna',
            'expected': expected,
            'cwe': norm_cwe(row['cwe']),
            'line': int(row['sink_line']) if row.get('sink_line') else None,
            'flow_level': row.get('flow_level'),
            'label': row['file'],
        })

    for meta_path in sorted(pathlib.Path('real').glob('*/meta.json')):
        meta = json.loads(meta_path.read_text(encoding='utf-8'))
        base = meta_path.parent.name
        for version, expected in (('vulnerable', True), ('fixed', False)):
            items.append({
                'key': 'real/{}/{}/{}'.format(base, version,
                                              meta['sink_file'].replace('\\', '/')),
                'layer': 'rzeczywista',
                'expected': expected,
                'cwe': norm_cwe(meta['cwe']),
                'line': int(meta['sink_line']) if meta.get('sink_line') else None,
                'flow_level': None,
                'label': '{} ({})'.format(meta['package'], version),
                'scope': 'real/{}/{}/'.format(base, version),
            })
    return items


# --- Zgloszenia ----------------------------------------------------------
def load_codeql(path='codeql_full.sarif'):
    """Zwraca liste (sciezka, regula, [linie]) - linia glowna i kroki przeplywu."""
    data = json.load(open(path, encoding='utf-8'))
    findings = []
    for run in data['runs']:
        for result in run.get('results', []):
            locs = result.get('locations', [])
            if not locs:
                continue
            phys = locs[0]['physicalLocation']
            path_uri = phys['artifactLocation']['uri']
            lines = set()
            region = phys.get('region', {})
            if region.get('startLine'):
                lines.add(region['startLine'])
            for flow in result.get('codeFlows', []):
                for tf in flow.get('threadFlows', []):
                    for step in tf.get('locations', []):
                        pl = step.get('location', {}).get('physicalLocation', {})
                        if pl.get('artifactLocation', {}).get('uri') == path_uri:
                            r = pl.get('region', {})
                            if r.get('startLine'):
                                lines.add(r['startLine'])
            findings.append((path_uri, result['ruleId'], sorted(lines)))
    return findings


def load_sonar(path='sonar_full.json'):
    data = json.load(open(path, encoding='utf-8'))
    findings = []
    for issue in data.get('issues', []):
        component = issue.get('component', '')
        file_path = component.split(':', 1)[1] if ':' in component else component
        lines = set()
        if issue.get('line'):
            lines.add(issue['line'])
        for flow in issue.get('flows', []):
            for loc in flow.get('locations', []):
                comp = loc.get('component', '')
                cpath = comp.split(':', 1)[1] if ':' in comp else comp
                tr = loc.get('textRange') or {}
                if cpath == file_path and tr.get('startLine'):
                    lines.add(tr['startLine'])
        findings.append((file_path, issue.get('rule'), sorted(lines)))
    return findings


# --- Ewaluacja -----------------------------------------------------------
def evaluate(name, findings, rule_map, reference):
    by_key = collections.defaultdict(list)
    for path, rule, lines in findings:
        by_key[path].append((rule, lines))

    security_rules = set(rule_map)
    stats = {'TP': 0, 'FP': 0, 'FN': 0, 'TN': 0}
    per_cwe = collections.defaultdict(lambda: {'TP': 0, 'FP': 0})
    per_flow = collections.defaultdict(lambda: {'TP': 0, 'total': 0})
    unmapped = collections.Counter()
    detail = []

    for item in reference:
        matched = False
        for rule, lines in by_key.get(item['key'], []):
            if rule not in rule_map:
                unmapped[rule] += 1
                continue
            if not any(class_match(c, item['cwe']) for c in rule_map[rule]):
                continue
            if item['line'] is None or any(
                    abs(l - item['line']) <= N_WINDOW for l in lines):
                matched = True
                break

        if item['expected']:
            key = 'TP' if matched else 'FN'
            per_cwe[item['cwe']]['TP'] += 1 if matched else 0
            if item['flow_level']:
                per_flow[item['flow_level']]['total'] += 1
                per_flow[item['flow_level']]['TP'] += 1 if matched else 0
        else:
            # dla artefaktu bez oczekiwanego wykrycia liczy sie dowolne
            # zgloszenie bezpieczenstwa w klasie odpowiadajacej wpisowi
            scope = item.get('scope')
            noise = False
            for path, rule, lines in findings:
                if rule not in security_rules:
                    continue
                in_scope = path.startswith(scope) if scope else path == item['key']
                if in_scope and any(class_match(c, item['cwe'])
                                    for c in rule_map[rule]):
                    noise = True
                    break
            key = 'FP' if noise else 'TN'
            per_cwe[item['cwe']]['FP'] += 1 if noise else 0

        stats[key] += 1
        detail.append({'key': item['key'], 'layer': item['layer'],
                       'cwe': item['cwe'], 'label': item['label'],
                       'flow_level': item['flow_level'], 'outcome': key})

    return stats, per_cwe, per_flow, unmapped, detail


def metrics(stats):
    tp, fp, fn = stats['TP'], stats['FP'], stats['FN']
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    fdr = fp / (tp + fp) if tp + fp else 0.0
    return precision, recall, f1, fdr


def report(name, stats, per_cwe, per_flow, unmapped, layer):
    p, r, f1, fdr = metrics(stats)
    print('\n{} - warstwa {}'.format(name, layer))
    print('  TP {:3d} | FN {:3d} | FP {:3d} | TN {:3d}'.format(
        stats['TP'], stats['FN'], stats['FP'], stats['TN']))
    print('  precyzja {:.3f} | czulosc {:.3f} | F1 {:.3f} | FDR {:.3f}'.format(
        p, r, f1, fdr))
    if per_cwe:
        print('  wg klas CWE:')
        for cwe in sorted(per_cwe):
            v = per_cwe[cwe]
            print('    {:9s} TP {:2d} | FP {:2d}'.format(cwe, v['TP'], v['FP']))
    if per_flow:
        print('  wg poziomu przeplywu:')
        for lvl in sorted(per_flow):
            v = per_flow[lvl]
            print('    poziom {}: {}/{}'.format(lvl, v['TP'], v['total']))


def main():
    reference = load_reference()
    codeql = load_codeql()
    sonar = load_sonar()

    print('=' * 70)
    print('EWALUACJA SAST - okno N = {} wierszy, dopasowanie hierarchiczne CWE'
          .format(N_WINDOW))
    print('=' * 70)
    print('artefaktow referencyjnych: {} (syntetyczna {}, rzeczywista {})'.format(
        len(reference),
        sum(1 for i in reference if i['layer'] == 'syntetyczna'),
        sum(1 for i in reference if i['layer'] == 'rzeczywista')))
    print('zgloszen: CodeQL {}, SonarQube Cloud {}'.format(len(codeql), len(sonar)))

    all_detail = []
    for layer in ('syntetyczna', 'rzeczywista'):
        subset = [i for i in reference if i['layer'] == layer]
        print('\n' + '-' * 70)
        for name, findings, rules in (('CodeQL', codeql, CODEQL_RULES),
                                      ('SonarQube Cloud', sonar, SONAR_RULES)):
            stats, per_cwe, per_flow, unmapped, detail = evaluate(
                name, findings, rules, subset)
            report(name, stats, per_cwe, per_flow, unmapped, layer)
            for d in detail:
                d['tool'] = name
            all_detail += detail

    with open('evaluation_matrix.csv', 'w', newline='', encoding='utf-8') as fh:
        writer = csv.DictWriter(fh, fieldnames=list(all_detail[0].keys()))
        writer.writeheader()
        writer.writerows(all_detail)
    print('\nzapisano evaluation_matrix.csv')


if __name__ == '__main__':
    main()