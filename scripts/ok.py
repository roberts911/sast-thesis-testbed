import pandas as pd
from scipy.stats import spearmanr

d = pd.read_csv('final_evaluation_matrix.csv')
v = d[(d.expected_finding == True) & (~d.cwe.isin(['CWE-798', 'CWE-327']))]
print(v.groupby('flow_level')[['codeql_detected', 'sonar_detected']]
       .agg(['sum', 'count']).to_string())
for col in ('codeql_detected', 'sonar_detected'):
    r, p = spearmanr(v['flow_level'], v[col].astype(int))
    print(f'{col}: rho={r:.3f} p={p:.4f}')