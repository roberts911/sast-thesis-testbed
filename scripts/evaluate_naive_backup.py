import pandas as pd
import json
import os

def evaluate_scanners():
    # 1. Wczytanie macierzy Ground Truth (zakładam ścieżkę synthetic/ground_truth.csv)
    try:
        df = pd.read_csv('synthetic/ground_truth.csv')
    except FileNotFoundError:
        print("Błąd: Nie znaleziono pliku synthetic/ground_truth.csv")
        return
    
    # Ekstrakcja samej nazwy pliku, aby łatwo mapować ścieżki niezależnie od katalogów
    df['filename'] = df['file'].apply(os.path.basename)
    
    # Słowniki śledzące stan wykrycia (domyślnie False dla każdego pliku)
    codeql_results = {filename: False for filename in df['filename']}
    sonar_results = {filename: False for filename in df['filename']}
    
    # 2. Mapowanie wyników CodeQL
    try:
        with open('codeql_alerts.json', 'r', encoding='utf-8') as f:
            codeql_data = json.load(f)
            for alert in codeql_data:
                if 'most_recent_instance' in alert and 'location' in alert['most_recent_instance']:
                    path = alert['most_recent_instance']['location']['path']
                    filename = os.path.basename(path)
                    if filename in codeql_results:
                        codeql_results[filename] = True
    except FileNotFoundError:
        print("Brak pliku codeql_alerts.json. Pomiń analizę CodeQL.")

    # 3. Mapowanie wyników SonarQube Cloud
    try:
        with open('sonar_issues.json', 'r', encoding='utf-8') as f:
            sonar_data = json.load(f)
            issues = sonar_data.get('issues', [])
            for issue in issues:
                # Sonar zwraca komponent w formacie "klucz_projektu:sciezka/do/pliku.js"
                component = issue.get('component', '')
                path = component.split(':', 1)[1] if ':' in component else component
                filename = os.path.basename(path)
                
                if filename in sonar_results:
                    sonar_results[filename] = True
    except FileNotFoundError:
        print("Brak pliku sonar_issues.json. Pomiń analizę SonarQube.")

    # 4. Dołączenie wyników do DataFrame
    df['codeql_detected'] = df['filename'].map(codeql_results)
    df['sonar_detected'] = df['filename'].map(sonar_results)

    # 5. Obliczanie metryk
    def calculate_metrics(tool_column):
        tp = len(df[(df['expected_finding'] == True) & (df[tool_column] == True)])
        fp = len(df[(df['expected_finding'] == False) & (df[tool_column] == True)])
        fn = len(df[(df['expected_finding'] == True) & (df[tool_column] == False)])
        tn = len(df[(df['expected_finding'] == False) & (df[tool_column] == False)])
        return tp, fp, fn, tn

    c_tp, c_fp, c_fn, c_tn = calculate_metrics('codeql_detected')
    s_tp, s_fp, s_fn, s_tn = calculate_metrics('sonar_detected')

    # 6. Prezentacja wyników
    print("="*50)
    print("WYNIKI EWALUACJI SKANERÓW SAST (Korpus 100 plików)")
    print("="*50)
    print(f"CodeQL:")
    print(f"  TP (Wykryte luki):        {c_tp}/50")
    print(f"  FN (Przeoczone luki):     {c_fn}/50")
    print(f"  FP (Fałszywe alarmy):     {c_fp}/50 (z control_pool)")
    print(f"  TN (Poprawne milczenie):  {c_tn}/50")
    print("-" * 50)
    print(f"SonarQube Cloud:")
    print(f"  TP (Wykryte luki):        {s_tp}/50")
    print(f"  FN (Przeoczone luki):     {s_fn}/50")
    print(f"  FP (Fałszywe alarmy):     {s_fp}/50 (z control_pool)")
    print(f"  TN (Poprawne milczenie):  {s_tn}/50")
    print("="*50)
    
    # Eksport macierzy końcowej
    df.to_csv('final_evaluation_matrix.csv', index=False)
    print("Zapisano szczegółową macierz do 'final_evaluation_matrix.csv'")

if __name__ == "__main__":
    evaluate_scanners()