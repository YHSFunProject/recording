"""把 prototype/index.html 转成发布用的页面片段（发布时外层会自动包上 <html><head><body>）。
用法: python tools/build_artifact.py 输出文件路径
"""
import re, sys, pathlib
src = (pathlib.Path(__file__).resolve().parent.parent / 'prototype' / 'index.html').read_text(encoding='utf-8')
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
head = re.sub(r'<meta[^>]*>\s*', '', head)                               # charset / viewport 由发布外壳提供
head = re.sub(r'<title>.*?</title>', '<title>泰拉纪事馆</title>', head, flags=re.S)
body = body.replace('js/main.js?v=2', 'js/main.js')                      # 发布文件不带查询参数
# 发布页由外壳加了上下安全区内边距：高度用 100% 而不是 100vh
style = '<style>html,body{height:100%}#app{height:100%}@media (max-width:760px){html,body,#app{height:auto}}</style>\n'
out = head.strip() + '\n' + style + body.strip() + '\n'
pathlib.Path(sys.argv[1]).write_text(out, encoding='utf-8', newline='\n')
print('ok', len(out))
