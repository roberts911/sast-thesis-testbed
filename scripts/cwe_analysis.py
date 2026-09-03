import pandas as pd

df = pd.read_csv('final_evaluation_matrix.csv')

print("="*60)
print("ANALIZA SKUTECZNOŚCI WEDŁUG KLAS CWE")
print("="*60)

for cwe, group in df.groupby('cwe'):
    print(f"\nKategoria: {cwe}")
    
    # Podatne (expected = True)
    vuln = group[group['expected_finding'] == True]
    c_tp = len(vuln[vuln['codeql_detected'] == True])
    s_tp = len(vuln[vuln['sonar_detected'] == True])
    
    # Bezpieczne (expected = False)
    safe = group[group['expected_finding'] == False]
    c_fp = len(safe[safe['codeql_detected'] == True])
    s_fp = len(safe[safe['sonar_detected'] == True])
    
    print(f"  CodeQL: Wykryte luki (TP): {c_tp}/5 | Fałszywe alarmy (FP): {c_fp}/5")
    print(f"  Sonar : Wykryte luki (TP): {s_tp}/5 | Fałszywe alarmy (FP): {s_fp}/5")