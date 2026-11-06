"""从参考地图按颜色提取陆地，输出有符号距离场 PNG 供 terrain.js 采样。
用法: python tools/trace_land.py reference/terra-map-reference.jpeg prototype/data/land.png [preview.png]
坐标：参考图像素 = 设定图坐标（与 data.js 一致）。输出覆盖 x∈[40,1320], y∈[200,1760]，每 2px 一格。
"""
import sys
import numpy as np, cv2
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src)[:, :, ::-1].astype(np.int16)  # RGB
R, G, B = im[..., 0], im[..., 1], im[..., 2]
H, W = R.shape

# 水体：偏蓝的暗色（海 65,100,122；湖 50,76,93）。中性黑（文字、徽记）算陆地。
water = (B - R > 28) & (B < 150)
land = ~water

yy, xx = np.mgrid[0:H, 0:W]
# 未知地域：暗色六边形团块按陆地处理（底下地形未知）
unk = ((xx - 445) ** 2 + (yy - 268) ** 2 < 165 ** 2) & (B < 115) & (B - R < 52) & (yy < 450)
land |= unk
# 海面上的标题、徽标、图例、署名等浅色元素 → 海
for x0, y0, x1, y1 in [(840, 0, W, 200), (925, 200, 1200, 450), (30, 30, 170, 95),
                       (935, 1200, W, H), (640, 1530, W, H), (0, 1630, 240, H), (955, 1262, 1065, 1295)]:
    land[y0:y1, x0:x1] = False

# 清理：去小岛噪点、补小孔（文字/图标残留），保留大湖
land = ndi.binary_opening(land, iterations=1)
lab, n = ndi.label(land)
sizes = ndi.sum(land, lab, range(1, n + 1))
land = np.isin(lab, 1 + np.nonzero(sizes >= 40)[0])
holes = ndi.binary_fill_holes(land) & ~land
hl, hn = ndi.label(holes)
hs = ndi.sum(holes, hl, range(1, hn + 1))
# 封闭水体：细长的（河道描线、标签底色）或很小的 → 填为陆地；有宽度的湖泊保留
for i in range(1, hn + 1):
    comp = hl == i
    sl = ndi.find_objects(comp.astype(np.uint8))[0]
    c = comp[sl]
    if hs[i - 1] < 250 or not ndi.binary_opening(np.pad(c, 4), iterations=4).any():
        land[sl] |= c

# 平滑海岸（去 JPEG 锯齿与六边形描边台阶）
soft = cv2.GaussianBlur(land.astype(np.float32), (0, 0), 1.6) > 0.5

# 有符号距离（像素，陆地为正）
d_in = ndi.distance_transform_edt(soft)
d_out = ndi.distance_transform_edt(~soft)
sdf = np.where(soft, d_in - 0.5, -(d_out - 0.5))

# 重采样到输出网格：x∈[40,1320], y∈[200,1760] 每 2px
OX, OY, OW, OH, STEP = 40, 200, 641, 781, 2
gx = OX + np.arange(OW) * STEP; gy = OY + np.arange(OH) * STEP
full = np.full((OH, OW), -40.0, np.float32)
X, Y = np.meshgrid(gx, gy)
inside = (X < W) & (Y < H)
full[inside] = sdf[Y[inside], X[inside]]
enc = np.clip(128 + full * 3, 0, 255).astype(np.uint8)  # ±42px 量程
cv2.imwrite(out, enc)
print('land px', int(soft.sum()), 'out', enc.shape)

if len(sys.argv) > 3:
    pv = im.astype(np.uint8)[:, :, ::-1].copy()
    edge = soft ^ ndi.binary_erosion(soft)
    pv[ndi.binary_dilation(edge)] = (0, 200, 255)
    cv2.imwrite(sys.argv[3], pv)
