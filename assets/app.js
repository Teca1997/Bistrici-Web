'use strict';
(() => {
  const lesson = window.BISTRICI_LESSON;
  const el = id => document.getElementById(id);
  el('title').textContent = lesson.title;
  el('meta').textContent = `${lesson.grade}. razred · susret ${String(lesson.meeting).padStart(2,'0')} · jedna lekcija po susretu`;
  el('intro').textContent = lesson.intro;
  lesson.tasks.forEach((text,i) => el('task'+i).textContent = text);
  el('classroom').placeholder = lesson.grade+'.a';
  el('classroom').pattern = lesson.grade+'[. ]?[a-zA-Z]';
  const editor = CodeMirror.fromTextArea(el('code'), {mode:'javascript',lineNumbers:true,indentUnit:2,tabSize:2,lineWrapping:true,extraKeys:{Escape:cm => cm.getInputField().blur(),'Ctrl-Enter':() => run(),'Cmd-Enter':() => run(),Tab:cm => cm.execCommand('indentMore'),'Shift-Tab':cm => cm.execCommand('indentLess')}});
  window.bistriciEditor = editor;
  editor.setValue(lesson.starter);
  let active = null, timer, changed = false, loading = false;
  const notice = text => { el('notice').textContent = text; };
  const status = text => { el('saveStatus').textContent = text; };
  const ascii = s => s.replace(/[đĐ]/g, c => c === 'đ' ? 'd' : 'D').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const identity = () => {
    const first = el('first').value.trim().normalize('NFC'), last = el('last').value.trim().normalize('NFC');
    const classroom = el('classroom').value.trim().toLowerCase().replace(/[. ]/g,'');
    if (!first || !last || !ascii(first) || !ascii(last) || !new RegExp('^'+lesson.grade+'[a-z]$').test(classroom)) return null;
    return {first,last,classroom};
  };
  const key = who => 'bistrici:v2:'+JSON.stringify([lesson.id,who.first.toLocaleLowerCase('hr'),who.last.toLocaleLowerCase('hr'),who.classroom]);
  const filename = who => `Bistrici_${who.classroom}_S${String(lesson.meeting).padStart(2,'0')}_${ascii(who.first)}_${ascii(who.last)}.js`;
  const same = (a,b) => a && b && key(a) === key(b);
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
    el('filename').textContent=who?filename(who):'Za naziv datoteke upiši ime, prezime i odjeljenje ove razine.';
    el('export').disabled=!who || !same(who,active);
    el('exportJson').disabled=el('export').disabled;
    if(active&&!same(active,who)) {clearTimeout(timer);status('Podaci su promijenjeni. Klikni „Otvori rad učenika”.');}
  }
  for(const id of ['first','last','classroom'])el(id).addEventListener('input',refreshIdentity);
  el('openStudent').onclick=() => {
    const who=identity(); if(!who){notice('Upiši ime, prezime i odjeljenje, primjerice '+lesson.grade+'.a.');return;}
    if(same(active,who)){save();notice('Ovaj učenik već radi.');return;}
    if((changed||active)&&!confirm('Promijeniti učenika? Prije promjene izvezi važan rad. Uređivač će otvoriti zaseban rad odabranog učenika.'))return;
    let stored=null, storageAvailable=true;
    try {const raw=localStorage.getItem(key(who)); if(raw){stored=JSON.parse(raw);if(stored.lesson!==lesson.id||typeof stored.code!=='string'||stored.code.length>200000)throw new Error();}}
    catch {storageAvailable=false;notice('Lokalna pohrana nije dostupna ili je kopija oštećena. Prije nastavka koristi izvezenu datoteku; važne podatke sačuvaj preuzimanjem.');}
    if(stored&&!confirm('Postoji lokalni rad za upisano ime i odjeljenje. Učitati ga?'))return;
    runner.stop();active=who;setCode(stored?stored.code:lesson.starter);refreshIdentity();
    el('owner').textContent=`Rad: ${who.first} ${who.last}, ${who.classroom}`;
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
    try {localStorage.removeItem(key(active));active=null;setCode(lesson.starter);runner.stop();el('owner').textContent='Nije odabran učenik.';status('Lokalni rad obrisan. Za nastavak ponovno otvori rad učenika.');refreshIdentity();}
    catch{notice('Brisanje nije dostupno.');}
  };
  function download(json) {
    const who=identity();if(!same(who,active)){notice('Najprije otvori rad učenika.');return;}
    const content=json?JSON.stringify({format:'bistrici-work',version:1,lesson:lesson.id,student:who,code:editor.getValue()},null,2):editor.getValue();
    const url=URL.createObjectURL(new Blob([content],{type:json?'application/json':'text/javascript;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=filename(who).replace(/\.js$/,json?'.json':'.js');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);save();notice('Datoteka je pripremljena za preuzimanje. Provjeri mapu Preuzimanja prije predaje u Teamsu.');
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
