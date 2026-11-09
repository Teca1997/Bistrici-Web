'use strict';
(() => {
  const lesson = window.BISTRICI_LESSON;
  const el = id => document.getElementById(id);
  el('title').textContent = lesson.title;
  el('meta').textContent = `${lesson.grade}. razred · susret ${String(lesson.meeting).padStart(2,'0')} · jedna lekcija po susretu`;
  el('intro').textContent = lesson.intro;
  lesson.tasks.forEach((text,i) => el('task'+i).textContent = text);
  el('classroom').textContent = lesson.grade+'. razred';
  const editor = CodeMirror.fromTextArea(el('code'), {mode:'javascript',lineNumbers:true,indentUnit:2,tabSize:2,lineWrapping:true,extraKeys:{Escape:cm => cm.getInputField().blur(),'Ctrl-Enter':() => run(),'Cmd-Enter':() => run(),Tab:cm => cm.execCommand('indentMore'),'Shift-Tab':cm => cm.execCommand('indentLess')}});
  window.bistriciEditor = editor;
  editor.setValue(lesson.starter);
  let active = null, timer, changed = false, loading = false;
  const notice = text => { el('notice').textContent = text; };
  const status = text => { el('saveStatus').textContent = text; };
  const ascii = s => s.replace(/[đĐ]/g, c => c === 'đ' ? 'd' : 'D').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const identity = () => {
    const first = el('first').value.trim().normalize('NFC'), last = el('last').value.trim().normalize('NFC');
    if (!first || !last || !ascii(first) || !ascii(last)) return null;
    return {first,last,classroom:String(lesson.grade)};
  };
  const key = who => 'bistrici:v2:'+JSON.stringify([lesson.id,who.first.toLocaleLowerCase('hr'),who.last.toLocaleLowerCase('hr'),who.classroom]);
  const filename = who => `Bistrici_${who.classroom}_S${String(lesson.meeting).padStart(2,'0')}_${ascii(who.first)}_${ascii(who.last)}.js`;
  const gradeOf = who => who && /^[5-8](?:[. ]?[a-z])?$/i.test(String(who.classroom)) ? Number(String(who.classroom)[0]) : null;
  const same = (a,b) => a && b && typeof a.first==='string' && typeof b.first==='string' && typeof a.last==='string' && typeof b.last==='string' && a.first.normalize('NFC').toLocaleLowerCase('hr')===b.first.normalize('NFC').toLocaleLowerCase('hr') && a.last.normalize('NFC').toLocaleLowerCase('hr')===b.last.normalize('NFC').toLocaleLowerCase('hr') && gradeOf(a)===lesson.grade && gradeOf(b)===lesson.grade;
  const output = (kind,text) => { const p = document.createElement('p'); p.className=kind;p.textContent=text;el('output').append(p);el('output').scrollTop=el('output').scrollHeight; };
  const runner = new BistriciRunner(output, running => {el('stop').disabled=!running;el('runState').textContent=running?'Program se izvršava…':'Program miruje.';});
  function save() {
    clearTimeout(timer);
    if (!active || !same(active,identity())) {status('Odaberi učenika za automatsko spremanje.'); return;}
    try {localStorage.setItem(key(active),JSON.stringify({version:1,lesson:lesson.id,student:active,code:editor.getValue(),saved:new Date().toISOString()}));status('Automatski spremljeno na ovom računalu. Izvezi datoteku za sigurnu kopiju.');changed=false;}
    catch {status('Lokalna pohrana nije dostupna ili je puna. Spremi rad u datoteku.');}
  }
  editor.on('change', () => {if(loading)return;changed=true;status('Promjene u kodu…');clearTimeout(timer);timer=setTimeout(save,600);});
  function setCode(code) {loading=true;editor.setValue(code);editor.clearHistory();loading=false;changed=false;}
  function refreshIdentity() {
    const who=identity();
    el('filename').textContent=who?filename(who):'Za naziv datoteke upiši ime i prezime.';
    el('export').disabled=!who;
    el('exportJson').disabled=el('export').disabled;
    for (const id of ['export','exportJson']) el(id).title=who?'Preuzmi kod iz uređivača.':'Upiši ime i prezime.';
    if(who&&!active) notice('Rad možeš odmah preuzeti. Za automatsko lokalno spremanje odaberi „Nastavi spremljeni rad”.');
    if(active&&!same(active,who)) {clearTimeout(timer);status('Podaci su promijenjeni. Klikni „Nastavi spremljeni rad”.');}
  }
  for(const id of ['first','last'])for(const event of ['input','change'])el(id).addEventListener(event,refreshIdentity);
  el('openStudent').onclick=() => {
    const who=identity(); if(!who){notice('Upiši ime i prezime.');return;}
    if(same(active,who)){save();notice('Ovaj učenik već radi.');return;}
    if((changed||active)&&!confirm('Promijeniti učenika? Prije promjene izvezi važan rad. Uređivač će otvoriti zaseban rad odabranog učenika.'))return;
    let stored=null, storageAvailable=true, legacy=false;
    try {
      const valid = item => item && item.lesson===lesson.id && typeof item.code==='string' && item.code.length<=200000 && same(who,item.student);
      const raw=localStorage.getItem(key(who));
      if(raw){stored=JSON.parse(raw);if(!valid(stored))throw new Error();}
      else {
        // Preserve v2 works saved before the optional classroom section was removed.
        const candidates=[];
        for(let i=0;i<localStorage.length;i++){
          const name=localStorage.key(i);if(!name || !name.startsWith('bistrici:v2:'))continue;
          try {const item=JSON.parse(localStorage.getItem(name));if(name!==key(who)&&valid(item))candidates.push(item);} catch {}
        }
        if(candidates.length===1){stored=candidates[0];legacy=true;}
        if(candidates.length>1&&!confirm('Postoji više ranijih radova s tim imenom i prezimenom. Nijedan neće biti automatski učitan. Započeti novi odvojeni rad? Raniji rad možeš nastaviti učitavanjem svoje datoteke.'))return;
      }
    }
    catch {stored=null;storageAvailable=false;notice('Lokalna pohrana nije dostupna ili je kopija oštećena. Prije nastavka koristi izvezenu datoteku; važne podatke sačuvaj preuzimanjem.');}
    if(stored&&!confirm(legacy?'Pronađen je raniji rad spremljen s odjeljenjem. Učitati ga? Izvorna lokalna kopija ostat će sačuvana.':'Postoji lokalni rad za upisano ime i prezime. Učitati ga?'))return;
    runner.stop();active=who;setCode(stored?stored.code:lesson.starter);refreshIdentity();
    el('owner').textContent=`Rad: ${who.first} ${who.last}, ${lesson.grade}. razred`;
    status(stored?'Učitan lokalni rad.':'Započet zaseban rad.');notice('Kod nije automatski pokrenut.');
    if(storageAvailable) save(); else status('Lokalni oporavak nije dostupan. Obvezno izvezi rad u datoteku.');
  };
  function run(){el('output').replaceChildren();runner.run(editor.getValue(),Number(el('timeout').value));}
  el('run').onclick=run;el('stop').onclick=()=>runner.stop();el('clear').onclick=()=>el('output').replaceChildren();
  el('reset').onclick=()=>{if(confirm('Zamijeniti sadašnji kod početnim? Izvezi rad ako ga želiš sačuvati.')){runner.stop();setCode(lesson.starter);changed=true;save();}};
  el('delete').onclick=()=>{
    if(!active||!same(active,identity()))return;
    if(!confirm('Obrisati lokalni rad ovog učenika za ovu lekciju? Preuzete datoteke ostaju sačuvane.'))return;
    clearTimeout(timer);
    try {localStorage.removeItem(key(active));active=null;setCode(lesson.starter);runner.stop();el('owner').textContent='Nije odabran učenik.';status('Lokalni rad obrisan. Za nastavak odaberi „Nastavi spremljeni rad”.');refreshIdentity();}
    catch{notice('Brisanje nije dostupno.');}
  };
  function download(json) {
    const who=identity();if(!who){notice('Upiši ime i prezime.');return;}
    if(active&&!same(who,active)&&!confirm('Podaci učenika promijenjeni su. Preuzeti trenutačni kod na ime '+who.first+' '+who.last+'? Lokalni rad prethodnog učenika neće se prepisati.'))return;
    const content=json?JSON.stringify({format:'bistrici-work',version:1,lesson:lesson.id,student:who,code:editor.getValue()},null,2):editor.getValue();
    const url=URL.createObjectURL(new Blob([content],{type:json?'application/json':'text/javascript;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=filename(who).replace(/\.js$/,json?'.json':'.js');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);if(same(who,active))save();notice('Datoteka je pripremljena za preuzimanje. Provjeri mapu Preuzimanja prije predaje u Teamsu.');
  }
  el('export').onclick=()=>download(false);el('exportJson').onclick=()=>download(true);
  el('import').onclick=()=>el('file').click();
  el('file').onchange=async()=>{
    const file=el('file').files[0];el('file').value='';if(!file)return;
    if(!/\.(js|json)$/i.test(file.name)||file.size>200000){notice('Odaberi .js ili Bistrići .json datoteku do 200 kB.');return;}
    try {
      let code=await file.text();
      if(/\.json$/i.test(file.name)){
        const work=JSON.parse(code);
        if(work.format!=='bistrici-work'||work.version!==1||work.lesson!==lesson.id||typeof work.code!=='string')throw new Error('Strukturirani rad ne pripada ovoj lekciji.');
        if(!same(active,work.student))throw new Error('Najprije upiši vlasnika datoteke i otvori njegov rad.');code=work.code;
      }
      if(code.length>200000||code.includes('\u0000'))throw new Error('Datoteka nije podržan tekstualni JavaScript.');
      if(!confirm('Učitavanje će zamijeniti kod u uređivaču i lokalnu kopiju aktivnog učenika. Sačuvaj sadašnji rad izvozom ako ti je potreban. Nastaviti?'))return;
      runner.stop();setCode(code);changed=true;save();notice('Rad je učitan. Nije pokrenut.');
    }catch(err){notice('Učitavanje nije uspjelo: '+err.message);}
  };
  window.addEventListener('pagehide',()=>{if(changed)save();});
  window.addEventListener('beforeunload',e=>{if(changed){save();if(changed){e.preventDefault();e.returnValue='';}}});
  refreshIdentity();status('Upiši svoje podatke pa otvori vlastiti rad. Tuđi se rad ne učitava automatski.');
})();
