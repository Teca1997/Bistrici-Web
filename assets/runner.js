/* Worker runs in an opaque-origin sandbox. No student identity crosses this boundary. */
'use strict';
window.BistriciRunner = class {
  constructor(output, state) { this.output = output; this.state = state; }
  stop(message = 'Izvršavanje je zaustavljeno.') {
    clearTimeout(this.timer);
    if (this.frame) { this.frame.remove(); this.frame = null; this.output('info', message); }
    if (this.listener) window.removeEventListener('message', this.listener);
    this.listener = null; this.state(false);
  }
  run(code, seconds = 5) {
    this.stop();
    const frame = document.createElement('iframe');
    frame.hidden = true; frame.setAttribute('sandbox', 'allow-scripts');
    this.frame = frame;
    let lines = 0;
    this.listener = event => {
      if (event.source !== frame.contentWindow || this.frame !== frame) return;
      const d = event.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'ready') frame.contentWindow.postMessage({code}, '*');
      else if (d.type === 'line') {
        if (++lines > 300) { this.stop('Dosegnuto je ograničenje od 300 ispisa. Provjeri petlju.'); return; }
        this.output(['log','warn','error'].includes(d.level) ? d.level : 'log', String(d.text).slice(0, 4000));
      } else if (d.type === 'done') this.stop('Izvršavanje je završeno.');
      else if (d.type === 'failure') { this.output('error', String(d.text).slice(0,4000)); this.stop('Program je prekinut. Kod je sačuvan.'); }
    };
    window.addEventListener('message', this.listener);
    // CSP is inherited by blob workers: no network, imports, nested workers or application origin.
    frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; child-src 'none'"><script>
    const send = parent.postMessage.bind(parent);
    onmessage = e => {
      if(e.source !== parent || typeof e.data.code !== 'string') return;
      onmessage = null;
      const source = ${JSON.stringify(`
        const deliver = postMessage.bind(self);
        let count = 0;
        const format = x => {
          if (typeof x === 'string') return x.slice(0,4000);
          if (typeof x === 'bigint') return x.toString()+'n';
          if (typeof x === 'undefined') return 'undefined';
          try { const seen = new WeakSet(); return JSON.stringify(x, (k,v) => {
            if (typeof v === 'bigint') return v.toString()+'n';
            if (typeof v === 'object' && v !== null) { if(seen.has(v)) return '[kružna referenca]'; seen.add(v); }
            return v;
          }).slice(0,4000); } catch { return String(x).slice(0,4000); }
        };
        for (const level of ['log','warn','error']) console[level] = (...args) => {
          if (++count > 300) throw new Error('Previše ispisa (najviše 300).');
          deliver({type:'line',level,text:args.map(format).join(' ').slice(0,4000)});
        };
        onmessage = e => {
          onmessage = null;
          try { new Function('"use strict";\\n' + e.data)(); deliver({type:'done'}); }
          catch(err) { deliver({type:'failure',text: (err.name === 'SyntaxError' ? 'Sintaksna pogreška: provjeri zagrade, navodnike i znakove. ' : 'Pogreška tijekom izvođenja: ') + err.name + ': ' + err.message}); }
        };
      `)};
      try {
        const url = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
        const w = new Worker(url); URL.revokeObjectURL(url);
        w.onmessage = m => send(m.data, '*');
        w.onerror = () => send({type:'failure',text:'Preglednik nije mogao pokrenuti izolirani program.'}, '*');
        w.postMessage(e.data.code);
      } catch(err) { send({type:'failure',text: 'Izolirano pokretanje nije dostupno: '+err.message}, '*'); }
    };
    send({type:'ready'}, '*');<\/script>`;
    document.body.append(frame); this.state(true);
    this.timer = setTimeout(() => this.stop('Vrijeme je isteklo. Provjeri uvjet petlje ili odaberi dulje trajanje.'), seconds * 1000);
  }
};
