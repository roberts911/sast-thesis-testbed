import os, pandas as pd
from evaluate import (load_codeql, load_sonar,
                      CODEQL_RULE_TO_CWE, SONAR_RULE_TO_CWE)

gt = pd.read_csv('synthetic/ground_truth.csv')
gt = gt[gt['expected_finding'] == True]
gt['filename'] = gt['file'].apply(os.path.basename)
exp_line = dict(zip(gt['filename'], gt['sink_line']))
exp_cwe  = dict(zip(gt['filename'], gt['cwe']))

def offsets(findings, rule_map):
    out = []
    for fn, rule, line in findings:
        if fn not in exp_line or not line:
            continue
        if exp_cwe[fn] in rule_map.get(rule, set()):
            out.append(abs(line - exp_line[fn]))
    return out

cq = offsets(load_codeql(), CODEQL_RULE_TO_CWE)
sq = offsets(load_sonar(),  SONAR_RULE_TO_CWE)
for name, d in (('CodeQL', cq), ('Sonar', sq), ('Razem', cq + sq)):
    s = pd.Series(d)
    print(f'\n{name}: n={len(s)}')
    print(f'  mediana {s.median():.0f} | p90 {s.quantile(0.9):.0f} '
          f'| p95 {s.quantile(0.95):.0f} | max {s.max():.0f}')