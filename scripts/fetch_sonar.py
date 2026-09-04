import json, os, urllib.request, base64

TOKEN = os.environ['SONAR_TOKEN']
BASE = ('https://sonarcloud.io/api/issues/search'
        '?componentKeys=roberts911_sast-thesis-testbed&branch=main&ps=500&p={}')
auth = base64.b64encode(f'{TOKEN}:'.encode()).decode()

issues, page = [], 1
while True:
    req = urllib.request.Request(BASE.format(page),
                                 headers={'Authorization': f'Basic {auth}'})
    data = json.load(urllib.request.urlopen(req))
    issues += data['issues']
    print(f'strona {page}: {len(data["issues"])}, razem {len(issues)} z {data["total"]}')
    if len(issues) >= data['total'] or not data['issues']:
        break
    page += 1

json.dump({'total': len(issues), 'issues': issues},
          open('sonar_full.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('zapisano sonar_full.json')