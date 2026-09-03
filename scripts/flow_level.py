import pandas as pd
df = pd.read_csv('final_evaluation_matrix.csv')
v = df[df['expected_finding'] == True]
print(v.groupby('flow_level')[['codeql_detected', 'sonar_detected']]
       .agg(['sum', 'count']))