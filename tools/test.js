// Testy hry Zakletý dům (Node, bez prohlížeče):  node tools/test.js [adresář pro PNG]
const path = require('path');
const assert = require('assert');
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const root = path.resolve(__dirname, '..');
const png = process.argv[2] || null;
const files = ['js/speccy.js', 'js/pics.js', 'js/world.js', 'js/game.js'].map(f => path.join(root, f));
let okc = 0;
function ok(c, m) { assert.ok(c, m); okc++; }

function fresh(seed) {
    const g = H.load(files);
    return g;
}

const WALK = [
    'z', 'vezmi lopatu', 'vezmi olej', 'vezmi lampu', 'vezmi žebřík', 'v', 'kopej', 'vezmi mosazný klíč', 'otevři bránu', 'jdi na sever',
    'vezmi dopis', 'čti dopis', 's', 'v', 'otevři vitrínu', 'vezmi medailon', 'odemkni dveře klíčem', 'otevři dveře', 'v',
    'vezmi knihu', 'čti knihu', 'použij knihu', 's', 'j', 'z', 'z', 'z', 'vezmi zápalky', 'z', 'otevři dvířka', 's', 'vezmi rybu', 'j',
    'dej rybu kočce', 'vezmi stříbrný klíč', 'v', 'v', 'v', 'v', 's', 'odemkni skříňku klíčem', 'otevři skříňku', 'vezmi amulet',
    'j', 'z', 'z', 'jdi nahoru', 'v', 'vezmi deník', 'čti deník', 'z', 's', 'j', 'z', 'v', 'j', 's', 'použij žebřík', 'otevři dvířka', 'nahoru', 'vezmi kostěný klíč', 'vezmi medvídka',
    'dolů', 'dolů', 'z', 'z', 'naplň lampu', 'zapal lampu', 'jdi dolů', 'v', 's', 'vezmi svíčku', 'j', 'odemkni dveře klíčem', 'otevři dveře', 'v',
    'zapal svíčku', 'polož amulet na oltář'
];

function play(g, cmds, visited, tolerate) {
    const A = g.sandbox.GAME;
    for (const c of cmds) {
        A.run(c);
        if (visited) visited.add(A.S().room);
        ok(!g.hasNaN(A.S()), 'NaN ve stavu po: ' + c);
        if (A.G.state !== 'play') break;
    }
}

// 1) Kompletní průchod hrou
(function () {
    const g = fresh();
    const A = g.sandbox.GAME;
    g.step(10);
    ok(A.G.state === 'title', 'title');
    if (png) { g.png(path.join(png, 'title.png'), 3); }
    g.key(13, true); g.step(2); g.key(13, false); g.step(2);
    ok(A.G.state === 'play', 'start po Enter');
    A.newGame(12345); A.freezeGhost(true);
    const visited = new Set([A.S().room]);
    play(g, WALK, visited);
    const S = A.S();
    if (A.G.state !== 'over' || !A.G.win) { console.log(A.log().slice(-12).map(l => l.t).join('\n')); }
    ok(A.G.state === 'over' && A.G.win, 'výhra průchodem');
    ok(S.turns < A.W.limit, 'v limitu: ' + S.turns);
    const rooms = Object.keys(A.W.rooms);
    const miss = rooms.filter(r => !visited.has(r));
    ok(miss.length === 0, 'nenavštívené místnosti: ' + miss);
    const items = Object.keys(A.W.items);
    // položky, které hráč za hry vzal nebo spotřeboval (olej v lampě, ryba kočce, medvídek; amulet na oltáři)
    const lost = items.filter(i => S.it[i].loc === null || S.it[i].loc === 'inv' || S.it[i].loc === 'krypta' || (i === 'zebrik' && S.it[i].loc === 'galerie'));
    ok(lost.length === items.length, 'nevzaté předměty: ' + items.filter(i => !lost.includes(i)));
    ok(Object.keys(A.W.npcs).length === 3, 'npc');
    console.log('Průchod OK: ' + S.turns + ' tahů, ' + rooms.length + ' místností, ' + items.length + ' předmětů');
    if (png) { g.step(3); g.png(path.join(png, 'win.png'), 3); }
    ok(g.Z.hi.get('textovka') === A.KEY_REC - A.G.turns, 'rekord uložen');
    // návrat na titulní obrazovku
    g.step(60); g.key(32, true); g.step(2); g.key(32, false); g.step(2);
    ok(A.G.state === 'title', 'návrat na title');
    // druhá hra, horší výsledek nepřepíše rekord
    const rec1 = g.Z.hi.get('textovka');
    g.key(13, true); g.step(2); g.key(13, false); g.step(2);
    A.newGame(12345); A.freezeGhost(true);
    play(g, ['čekej', 'čekej'].concat(WALK));
    ok(A.G.win && g.Z.hi.get('textovka') === rec1, 'horší výsledek nepřepíše rekord');
})();

// 2) Dosažitelnost (datová): fixed-point přes zámky a klíče
(function () {
    const g = fresh(); const A = g.sandbox.GAME, W = A.W;
    const R = new Set([W.start]), I = new Set();
    let ch = true;
    const lit = () => I.has('lampa') && I.has('olej') && I.has('zapalky');
    while (ch) {
        ch = false;
        const addR = r => { if (!R.has(r)) { R.add(r); ch = true; } };
        const addI = i => { if (!I.has(i)) { I.add(i); ch = true; } };
        for (const r of [...R]) {
            for (const d of Object.keys(W.rooms[r].ex)) {
                const [to, fx] = W.rooms[r].ex[d];
                let pass = true;
                if (fx) {
                    const f = W.fix[fx];
                    if (fx === 'regal') pass = I.has('kniha');
                    else if (fx === 'padak') pass = I.has('zebrik');
                    else if (f.key) pass = I.has(f.key);
                }
                if (W.rooms[to].dark && !lit()) pass = false;
                if (pass) addR(to);
            }
            for (const id of Object.keys(W.items)) {
                const it = W.items[id];
                if (it.loc !== r) continue;
                if (it.inn) { const f = W.fix[it.inn]; if (f.key && !I.has(f.key)) continue; }
                addI(id);
            }
        }
        if (R.has('zahrada') && I.has('lopata')) addI('mklic');
        if (R.has('kuchyne') && I.has('ryba')) addI('sklic');
    }
    const mr = Object.keys(W.rooms).filter(r => !R.has(r)), mi = Object.keys(W.items).filter(i => !I.has(i));
    ok(mr.length === 0, 'nedosažitelné místnosti: ' + mr);
    ok(mi.length === 0, 'nedosažitelné předměty: ' + mi);
    // symetrie východů
    const opp = { s: 'j', j: 's', v: 'z', z: 'v', u: 'd', d: 'u' };
    for (const r of Object.keys(W.rooms)) for (const d of Object.keys(W.rooms[r].ex)) {
        const [to, fx] = W.rooms[r].ex[d];
        const back = W.rooms[to].ex[opp[d]];
        ok(back && back[0] === r && back[1] === fx, 'nesymetrický východ ' + r + ' ' + d);
    }
    ok(Object.keys(W.rooms).length === 20, '20 místností');
    console.log('Dosažitelnost OK: ' + R.size + ' místností, ' + I.size + ' předmětů');
})();

// 3) Parser: diakritika, pády, zkratky
(function () {
    const g = fresh(); const A = g.sandbox.GAME;
    A.newGame(1); A.freezeGhost(true); A.G.state = 'play';
    const room = () => A.S().room;
    A.run('z'); ok(room() === 'kolna', 'zkratka z');
    A.run('V'); ok(room() === 'zahrada', 'zkratka v velké');
    A.run('Jdi na západ'); ok(room() === 'kolna', 'jdi na západ');
    A.run('vezmi lopatu'); ok(A.S().it.lopata.loc === 'inv', 'pád lopatu');
    A.run('seber olejovou lampu'); ok(A.S().it.lampa.loc === 'inv', 'adjektivum olejovou lampu');
    A.run('vem láhev oleje'); ok(A.S().it.olej.loc === 'inv', 'oleje');
    A.run('i'); A.run('inventář');
    A.run('jdi na východ'); ok(room() === 'zahrada', 'východ');
    A.run('rozhlédni se');
    A.run('KOPEJ'); ok(A.S().it.mklic.loc === 'zahrada', 'kopej');
    A.run('vezmi mosazný klíč'); ok(A.S().it.mklic.loc === 'inv', 'mosazný klíč');
    A.run('s'); ok(room() === 'zahrada', 'brána zavřená blokuje');
    A.run('otevři bránu'); A.run('s'); ok(room() === 'predsin', 'otevřená brána');
    A.run('zavři bránu'); ok(A.S().fx.brana === 'closed', 'zavři');
    A.run('blbost'); A.run('vezmi lenochoda');
    A.run('mluv se zahradníkem');
    // zápal lampy bez zápalek
    A.run('zapal lampu'); ok(!A.S().lamp.lit, 'bez zápalek nezapálí');
    // psaní přes klávesnici
    A.setMode('kbd');
    for (const ch of 'inventář') A.onKey({ key: ch });
    ok(A.input() === 'inventář', 'psaní: ' + A.input());
    A.onKey({ key: 'Backspace', preventDefault() {} }); ok(A.input() === 'inventá', 'backspace');
    A.onKey({ key: 'Enter' }); ok(A.input() === '', 'enter vyčistí');
    ok(A.log().some(l => l.t === '> inventá'), 'příkaz v logu');
    // P a M jsou normální písmena (pauza a zvuk nezasahují)
    for (const ch of 'pomoc m') A.onKey({ key: ch });
    ok(A.input() === 'pomoc m', 'P a M se píšou');
    g.key(80, true); g.step(2); g.key(80, false); g.key(77, true); g.step(2); g.key(77, false);
    ok(!g.Z.paused() && !g.Z.pauseOk && !g.Z.snd.isMuted(), 'P/M nepauzuje ani nevypíná zvuk');
    console.log('Parser OK');
})();

// 4) Prohry a ghost
(function () {
    let g = fresh(), A = g.sandbox.GAME;
    // a) limit tahů
    A.newGame(2); A.freezeGhost(true); g.Z.pauseOk = false;
    A.G.state = 'play';
    for (let i = 0; i < 200 && A.G.state === 'play'; i++) A.run('čekej');
    ok(A.G.state === 'over' && !A.G.win && /úsvit/.test(A.G.msg), 'prohra limitem');
    ok(A.S().turns === A.W.limit, 'limit přesně: ' + A.S().turns);
    // b) studna potmě
    g = fresh(); A = g.sandbox.GAME; A.newGame(3); A.freezeGhost(true); A.G.state = 'play';
    const S = A.S(); S.room = 'vinarna';
    A.run('jdi na sever');
    ok(A.G.state === 'over' && !A.G.win && /studn/i.test(A.G.msg), 'smrt ve studni potmě');
    // c) ghost bez medailonu: třetí zásah
    g = fresh(); A = g.sandbox.GAME; A.newGame(4); A.G.state = 'play';
    for (let i = 0; i < 400 && A.G.state === 'play'; i++) {
        A.S().ghost.room = A.S().room; A.S().cool = 0; A.freezeGhost(true);
        A.run('čekej');
    }
    ok(A.G.state === 'over' && !A.G.win && A.S().hits === 3, 'smrt od ducha');
    // d) s medailonem duch neublíží
    g = fresh(); A = g.sandbox.GAME; A.newGame(5); A.G.state = 'play';
    A.S().it.medailon.loc = 'inv'; A.S().it.medailon.inn = null; A.S().room = 'hala';
    for (let i = 0; i < 30; i++) { A.S().ghost.room = 'hala'; A.run('čekej'); }
    ok(A.S().hits === 0 && A.G.state === 'play', 'medailon chrání');
    // e) medvídek uklidní ducha
    g = fresh(); A = g.sandbox.GAME; A.newGame(6); A.G.state = 'play'; A.freezeGhost(true);
    A.S().it.medved.loc = 'inv'; A.S().room = 'detsky'; A.S().ghost.room = 'detsky';
    A.run('dej medvídka paní'); ok(A.S().ghost.gone, 'duch uklidněn');
    A.S().room = 'hala'; for (let i = 0; i < 20; i++) A.run('čekej'); ok(A.S().hits === 0, 'uklidněný duch');
    // f) náhodný duch se pohybuje po domě
    g = fresh(); A = g.sandbox.GAME; A.newGame(7); A.G.state = 'play';
    const seen = new Set();
    for (let i = 0; i < 100; i++) { A.S().room = 'zahrada'; A.S().cool = 99; A.run('čekej'); seen.add(A.S().ghost.room); if (A.G.state !== 'play') break; }
    ok(seen.size >= 4, 'duch se pohybuje: ' + [...seen]);
    console.log('Prohry OK (duch navštívil ' + seen.size + ' místností)');
})();

// 5) Dotykové menu: slovesa + předměty
(function () {
    const g = fresh(); const A = g.sandbox.GAME;
    g.key(13, true); g.step(2); g.key(13, false);
    A.setMode('menu'); A.newGame(8); A.freezeGhost(true); A.G.state = 'play';
    const hit = a => { g.press(a); g.step(1); g.release(a); g.step(1); };
    // JDI -> ZÁPAD
    hit('fire');
    ok(A.menu.stage === 1, 'menu krok 1');
    const labels = A.menu.list.map(o => o.l);
    ok(labels.includes('ZÁPAD'), 'menu nabízí západ: ' + labels);
    A.menu.sel = labels.indexOf('ZÁPAD'); hit('fire');
    ok(A.S().room === 'kolna', 'menu: jdi západ');
    // VEZMI LOPATA
    hit('right'); hit('fire');
    const l2 = A.menu.list.map(o => o.l); ok(l2.includes('LOPATA'), 'menu vezmi: ' + l2);
    A.menu.sel = l2.indexOf('LOPATA'); hit('fire');
    ok(A.S().it.lopata.loc === 'inv', 'menu: vezmi lopatu');
    // ZPĚT z druhé úrovně
    hit('fire'); ok(A.menu.stage === 1, 'verb vezmi znovu'); hit('alt'); ok(A.menu.stage === 0, 'zpět');
    // projdi celou hru přes menu: sekvence (sloveso, objekt1, objekt2) – kontrola, že vše lze vybrat
    const menuDo = (verb, o1, o2) => {
        A.menu.sel = A.MV.findIndex(v => v.l === verb); hit('fire');
        if (A.MV[A.menu.verb].none) return;
        const i1 = A.menu.list.findIndex(o => o.l === o1); ok(i1 >= 0, 'menu ' + verb + ' nenabízí ' + o1 + ' v: ' + A.menu.list.map(o => o.l));
        A.menu.sel = i1; hit('fire');
        if (o2) { const i2 = A.menu.list.findIndex(o => o.l === o2); ok(i2 >= 0, 'menu ' + verb + ' ' + o1 + ' nenabízí ' + o2 + ' v: ' + A.menu.list.map(o => o.l)); A.menu.sel = i2; hit('fire'); }
    };
    A.newGame(9); A.G.state = 'play'; A.freezeGhost(true); A.menu.stage = 0;
    const seq = [
        ['JDI', 'ZÁPAD'], ['VEZMI', 'LOPATA'], ['VEZMI', 'LÁHEV OLEJE'], ['VEZMI', 'OLEJOVÁ LAMPA'], ['VEZMI', 'DŘEVĚNÝ ŽEBŘÍK'], ['JDI', 'VÝCHOD'], ['KOPEJ'],
        ['VEZMI', 'MOSAZNÝ KLÍČ'], ['OTEVŘI', 'REZAVÁ BRÁNA'], ['JDI', 'SEVER'], ['JDI', 'SEVER'], ['JDI', 'VÝCHOD'], ['OTEVŘI', 'VITRÍNA'], ['VEZMI', 'STŘÍBRNÝ MEDAILON'],
        ['ODEMKNI', 'DUBOVÉ DVEŘE', 'MOSAZNÝ KLÍČ'], ['OTEVŘI', 'DUBOVÉ DVEŘE'], ['JDI', 'VÝCHOD'], ['ČTI', 'KNIHA STÍNŮ'], ['POUŽIJ', 'KNIHA STÍNŮ', '[HOTOVO]'], ['JDI', 'SEVER']
    ];
    seq.forEach(s => menuDo.apply(null, s));
    ok(A.S().room === 'tajna', 'menu: dojít do tajné komnaty, jsem v ' + A.S().room);
    console.log('Menu OK');
})();

// 6) Screenshoty
(function () {
    if (!png) return;
    const g = fresh(); const A = g.sandbox.GAME;
    g.key(13, true); g.step(2); g.key(13, false); g.step(2);
    A.newGame(1); A.freezeGhost(true); A.G.state = 'play';
    g.step(2); g.png(path.join(png, 'play0.png'), 3);
    const rooms = Object.keys(A.W.rooms);
    // sheet jednotlivých místností
    const S = A.S();
    S.it.lampa.loc = 'inv'; S.lamp.full = true; S.lamp.lit = true;
    rooms.forEach(r => { S.room = r; A.run('rozhlédni se'); g.step(1); g.png(path.join(png, 'room_' + r + '.png'), 2); });
    // prohra
    A.G.state = 'over'; A.G.win = false; A.G.msg = 'Zazní úsvit a kletba domu tě pohltila. Nestihl jsi to.'; A.G.turns = 130; A.G.t = 60; g.step(1); g.png(path.join(png, 'lose.png'), 3);
    // menu mód
    A.G.state = 'play'; A.setMode('menu'); S.room = 'kuchyne'; A.run('rozhlédni se'); g.step(2); g.png(path.join(png, 'menu.png'), 3);
})();

console.log('VŠECHNY TESTY PROŠLY (' + okc + ' kontrol)');
