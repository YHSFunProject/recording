"""把海陆距离场与国家归属导出为 SVG 路径（供风格对比页等静态视图使用）。
用法: python tools/export_vectors.py prototype/data/land.png nations.json prototype/js/geo-vectors.js [year]
"""
import sys, json
import numpy as np, cv2

land_png, nat_json, out = sys.argv[1], sys.argv[2], sys.argv[3]
year = float(sys.argv[4]) if len(sys.argv) > 4 else 1098.9
# 归属半径：归一化椭圆距离小于 REACH 的陆地才分给某国（>1 让相邻国家的地块连成连续国界）
REACH = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
a = (cv2.imread(land_png, 0).astype(np.float32) - 128) / 3
land = (a > 0).astype(np.uint8)
X0, Y0, ST = 40, 200, 2
H, W = land.shape

def alive(n):
    l = n.get('life')
    if not l: return True
    return (l[0] is None or year >= l[0]) and (l[1] is None or year < l[1])

def paths(mask, eps=0.8, min_area=6):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    d = []
    for c in cs:
        if abs(cv2.contourArea(c)) < min_area: continue
        c = cv2.approxPolyDP(c, eps, True)[:, 0, :]
        if len(c) < 3: continue
        pts = [f"{X0 + x * ST:.0f} {Y0 + y * ST:.0f}" for x, y in c]
        d.append('M' + 'L'.join(pts) + 'Z')
    return ''.join(d)

nations = [n for n in json.load(open(nat_json, encoding='utf-8'))['N'] if n['own'] and alive(n)]
yy, xx = np.mgrid[0:H, 0:W]
SX, SY = X0 + xx * ST, Y0 + yy * ST
best = np.full((H, W), REACH, np.float32); owner = np.full((H, W), -1, np.int16)
for i, n in enumerate(nations):
    cx, cy, rx, ry = n['own']
    d = np.hypot((SX - cx) / rx, (SY - cy) / ry)
    m = d < best; best[m] = d[m]; owner[m] = i
owner[land == 0] = -1

res = {'coast': paths(land, 0.7, 4), 'nations': {}}
for i, n in enumerate(nations):
    m = (owner == i).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    res['nations'][n['id']] = paths(m, 1.0, 20)
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// 由 tools/export_vectors.py 生成：海岸线与国家地块（年份 %g）的 SVG 路径，坐标为设定图像素\n' % year)
    f.write('export const COAST = ' + json.dumps(res['coast']) + ';\n')
    f.write('export const NATION_SHAPES = ' + json.dumps(res['nations'], ensure_ascii=False) + ';\n')
print(len(res['coast']), {k: len(v) for k, v in res['nations'].items()})
