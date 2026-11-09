"""Build public navigation from published learner metadata; no private repository access."""
from pathlib import Path
import html,json,re

def render(rows):
 body='<header><h1>Bistrići – Matematički laboratorij</h1><p>Matematika kroz istraživanje i programiranje.</p></header><main><h2>Odaberi svoj razred</h2><p>Odaberi lekciju i istražuj matematiku pišući JavaScript izravno u pregledniku.</p><div class="catalog">'
 for grade in range(5,9):
  available=sorted((r for r in rows if r['grade']==grade),key=lambda r:r['meeting'])
  body+=f'<details class="panel"><summary><strong>{grade}. razred</strong></summary>'
  if not available:body+='<p>Lekcije su u pripremi. Nakon objave ovdje ćeš moći odabrati susret.</p>'
  else:
   for r in available:body+=f'<a href="lessons/{r["id"]}/index.html">S{r["meeting"]:02d} · {html.escape(r["title"])}</a>'
   missing=[t for t in range(1,71) if t not in {r['meeting'] for r in available}]
   if missing:
    body+=f'<details><summary>Susreti u pripremi ({len(missing)})</summary>'
    body+=''.join(f'<p class="muted">S{t:02d} · Nedostupno</p>' for t in missing)+'</details>'
  body+='</details>'
 return '<!doctype html><html lang="hr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bistrići</title><link rel="stylesheet" href="assets/app.css">'+body+'</div></main></html>'

def published_rows(root):
 rows=[]
 for path in sorted((root/'lessons').glob('*/lesson.js')):
  raw=path.read_text(encoding='utf-8');prefix='window.BISTRICI_LESSON = '
  assert raw.startswith(prefix),f'Nepodržani metapodaci: {path}'
  row=json.loads(raw[len(prefix):].strip().removesuffix(';'))
  assert type(row['grade']) is int and row['grade'] in (5,6,7,8)
  assert type(row['meeting']) is int and 1<=row['meeting']<=70
  assert row['id']==f"{row['grade']}-S{row['meeting']:02d}"==path.parent.name
  assert isinstance(row['title'],str) and row['title'].strip()
  assert (path.parent/'index.html').is_file(),f'Nedostaje stranica: {path.parent}'
  rows.append(row)
 assert len({r['id'] for r in rows})==len(rows)
 return rows

if __name__=='__main__':
 root=Path.cwd();rows=published_rows(root)
 (root/'index.html').write_text(render(rows),encoding='utf-8')
 print(f'Naslovnica automatski izrađena: {len(rows)} objavljenih lekcija.')
