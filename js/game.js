// Zakletý dům – česká parserová textovka ve stylu ZX Spectrum (The Hobbit).
(function (root) {
    'use strict';
    var W = root.WORLD, PIC = root.PICS;
    var COLS = 42, LOGLINES = 10, HIKEY = 'textovka';
    var KEY_REC = 1000;                   // rekord = KEY_REC - tahy (kit ukládá jen větší hodnoty)

    var S = null;                         // stav rozehrané hry
    var G = { state: 'title', t: 0, win: false, msg: '' };
    var log = [], inp = '', hist = [], hpos = 0;
    var mode = (typeof root.matchMedia === 'function' && root.matchMedia('(pointer: coarse)').matches) ? 'menu' : 'kbd';
    var frozenGhost = false;              // pro testy

    // ---------- Pomůcky
    function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim().replace(/\s+/g, ' '); }
    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function wrap(text, max) {
        var words = String(text).split(' '), lines = [], cur = '';
        words.forEach(function (w) {
            if (!cur) { cur = w; } else if ((cur + ' ' + w).length <= max) { cur += ' ' + w; } else { lines.push(cur); cur = w; }
        });
        if (cur) { lines.push(cur); }
        return lines;
    }
    function say(text, col) {
        wrap(text, COLS).forEach(function (l) { log.push({ t: l, c: col === undefined ? 7 : col }); });
        if (log.length > 300) { log.splice(0, log.length - 300); }
    }
    function names(arr) { return arr.map(function (e) { return e.n; }).join(', '); }
    function adjf(fx, base) { return base + ({ f: 'á', m: 'ý', p: 'é' })[fx.g]; }

    // ---------- Stav světa
    function newGame(seed) {
        S = { room: W.start, turns: 0, hits: 0, cool: 0, it: {}, fx: {}, np: {}, lamp: { full: false, lit: false }, flags: {}, rnd: Z.rng(seed || (Date.now() & 0xffffff)),
            ghost: { room: 'detsky', gone: false, seen: false } };
        Object.keys(W.items).forEach(function (id) { S.it[id] = { loc: W.items[id].loc, inn: W.items[id].inn || null, lit: false }; });
        Object.keys(W.fix).forEach(function (id) { S.fx[id] = W.fix[id].state; });
        Object.keys(W.npcs).forEach(function (id) { S.np[id] = W.npcs[id].loc; });
        log = []; inp = ''; hpos = 0;
        say('Je hluboká noc. Přišel jsi do zakletého domu, abys našel zlatý amulet a zlomil kletbu. Do úsvitu máš ' + W.limit + ' tahů. Piš POMOC, kdyby ses ztratil.', 15);
        describe();
    }
    function itemNear(id) { var i = S.it[id]; return i.loc === 'inv' || (i.loc === S.room && !(i.inn && S.fx[i.inn] !== 'open')); }
    function lightSource() { return (S.lamp.lit && itemNear('lampa')) || (S.it.svicka.lit && itemNear('svicka')); }
    function hasLight() { return !W.rooms[S.room].dark || !!lightSource(); }
    function inInv(id) { return S.it[id].loc === 'inv'; }
    function visItems() {
        return Object.keys(W.items).filter(function (id) { var i = S.it[id]; return i.loc === S.room && !(i.inn && S.fx[i.inn] !== 'open'); });
    }
    function exitsOf(room) {
        var r = W.rooms[room], out = [];
        Object.keys(r.ex).forEach(function (d) { var e = r.ex[d]; if (!(e[1] && S.fx[e[1]] === 'hidden')) { out.push(d); } });
        return out;
    }
    function passable(e) { return !e[1] || S.fx[e[1]] === 'open'; }
    function protectedFromGhost() { return inInv('medailon') || S.ghost.gone; }

    function describe() {
        var r = W.rooms[S.room];
        if (!hasLight()) {
            say('Tma', 14); say('Je naprostá tma. Nic nevidíš. Cítíš studený průvan. Potřebuješ světlo.', 7);
            return;
        }
        say(r.n, 14);
        say(r.d, 7);
        var seen = visItems().map(function (id) { return W.items[id].n; });
        Object.keys(W.npcs).forEach(function (id) { if (id !== 'pani' && S.np[id] === S.room) { seen.push(W.npcs[id].n); } });
        if (!S.ghost.gone && S.ghost.room === S.room) { seen.push('Šedá paní'); }
        if (seen.length) { say('Vidíš: ' + seen.join(', ') + '.', 13); }
        say('Východy: ' + exitsOf(S.room).map(function (d) { return W.dirs[d]; }).join(', ') + '.', 12);
    }

    // ---------- Rozsah (co hráč může označit)
    function mk(t, id, o, extra) {
        var e = { t: t, id: id, n: o.n || o.st[0], st: o.st, adj: o.adj || null, w: (o.adj ? o.adj[0] + ' ' : '') + o.st[0] };
        if (extra) { Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); }
        return e;
    }
    function scope() {
        var out = [];
        Object.keys(W.items).forEach(function (id) { if (inInv(id)) { out.push(mk('i', id, W.items[id], { inv: true })); } });
        if (!hasLight()) { return out; }
        visItems().forEach(function (id) { out.push(mk('i', id, W.items[id])); });
        Object.keys(W.fix).forEach(function (id) {
            var f = W.fix[id];
            if (S.fx[id] === 'hidden') { return; }
            var here = f.kind === 'cont' ? f.room === S.room : Object.keys(W.rooms[S.room].ex).some(function (d) { return W.rooms[S.room].ex[d][1] === id; });
            if (here) { out.push(mk('f', id, f)); }
        });
        Object.keys(W.npcs).forEach(function (id) { if (id !== 'pani' && S.np[id] === S.room) { out.push(mk('n', id, W.npcs[id])); } });
        if (!S.ghost.gone && S.ghost.room === S.room) { out.push(mk('n', 'pani', W.npcs.pani)); }
        (W.scen[S.room] || []).forEach(function (sc, i) { out.push(mk('s', sc.id || ('s' + i), { st: sc.st, n: sc.st[0] }, { d: sc.d })); });
        // vyloučit duplicitu (Šedá paní může být v np i jako duch)
        var seen = {};
        return out.filter(function (e) { var k = e.t + e.id; if (seen[k]) { return false; } seen[k] = 1; return true; });
    }

    // ---------- Parser
    var FILL = { na: 1, do: 1, v: 1, ve: 1, k: 1, ke: 1, s: 1, se: 1, si: 1, od: 1, o: 1, u: 1, z: 1, za: 1, pod: 1, pro: 1, po: 1, to: 1, ten: 1, ta: 1, tu: 1, tam: 1, a: 1, i: 1, mu: 1, ji: 1, jim: 1, sebou: 1, mi: 1, me: 1, by: 1 };
    var VERBS = [
        ['go', 'jdi', 'jit', 'jed', 'bez', 'utec', 'chod', 'vejdi', 'vystup', 'sestup', 'slez', 'vylez'],
        ['take', 'vezmi', 'vem', 'seber', 'sebr', 'zved', 'ber', 'popad', 'vzit', 'sebe'],
        ['drop', 'poloz', 'odloz', 'zahod', 'pust', 'poloz'],
        ['look', 'rozhledni', 'rozhlid', 'rozhlez', 'rozhlizej', 'look', 'l', 'pohled'],
        ['exam', 'prohledni', 'prohlidni', 'prohlid', 'prozkoumej', 'zkoumej', 'podivej', 'zkontroluj', 'popis', 'zkus'],
        ['read', 'cti', 'precti', 'read'],
        ['inv', 'inventar', 'inv', 'i', 'batoh', 'veci'],
        ['use', 'pouzij', 'pouzit', 'uzij', 'zatahni', 'stiskni', 'tahni', 'otoc', 'pouzi'],
        ['open', 'otevri', 'otevrit', 'odevri'],
        ['close', 'zavri', 'zavrit', 'zaviri'],
        ['unlock', 'odemkni', 'odemknout', 'odemk'],
        ['talk', 'mluv', 'promluv', 'pozdrav', 'rekni', 'zeptej'],
        ['give', 'dej', 'daruj', 'podej', 'dat'],
        ['feed', 'nakrm'],
        ['wait', 'cekej', 'pockej', 'cekat', 'wait', 'odpocin'],
        ['help', 'pomoc', 'help', 'napoveda', 'pomoz', 'h'],
        ['light', 'zapal', 'rozsvit', 'zazehni'],
        ['dig', 'kopej', 'vykopej', 'rypej', 'kopat', 'zakopej'],
        ['fill', 'napln', 'dolij', 'nalij']
    ];
    function verbOf(tok) {
        for (var i = 0; i < VERBS.length; i++) {
            var v = VERBS[i];
            for (var j = 1; j < v.length; j++) {
                if (tok === v[j] || (v[j].length >= 4 && tok.indexOf(v[j]) === 0)) { return v[0]; }
            }
        }
        return null;
    }
    function dirOf(tok) {
        if (tok.length === 1) { return ({ s: 's', j: 'j', v: 'v', z: 'z' })[tok] || null; }
        if (tok.indexOf('sever') === 0) { return 's'; }
        if (tok.indexOf('jih') === 0) { return 'j'; }
        if (tok.indexOf('vychod') === 0) { return 'v'; }
        if (tok.indexOf('zapad') === 0) { return 'z'; }
        if (tok.indexOf('nahor') === 0 || tok === 'up' || tok.indexOf('vzhuru') === 0) { return 'u'; }
        if (tok.indexOf('dol') === 0 || tok === 'down') { return 'd'; }
        return null;
    }
    function matchNoun(e, tok) { return tok.length >= 3 && e.st.some(function (s) { return tok.indexOf(s) === 0; }); }
    function matchAdj(e, tok) { return !!e.adj && e.adj.some(function (a) { return tok.length >= 3 && tok.indexOf(a) === 0; }); }
    // Vrací pole zmínek; každá zmínka = pole kandidátů
    function mentions(tokens) {
        var sc = scope(), adjT = [], nounT = [], out = [];
        tokens.forEach(function (tok) {
            if (sc.some(function (e) { return matchAdj(e, tok); })) { adjT.push(tok); } else if (sc.some(function (e) { return matchNoun(e, tok); })) { nounT.push(tok); }
        });
        function filt(c) {
            var f = c.filter(function (e) { return adjT.some(function (a) { return matchAdj(e, a); }); });
            return f.length ? f : c;
        }
        if (!nounT.length) { adjT.slice(0, 1).forEach(function (a) { out.push(sc.filter(function (e) { return matchAdj(e, a); })); }); return out; }
        nounT.forEach(function (tok) {
            var c = filt(sc.filter(function (e) { return matchNoun(e, tok); }));
            var key = c.map(function (e) { return e.t + e.id; }).join();
            if (!out.some(function (o) { return o.map(function (e) { return e.t + e.id; }).join() === key; })) { out.push(c); }
        });
        return out;
    }
    function pick(c, prefInv) {
        var l = c.slice().sort(function (a, b) { return ((b.inv ? 1 : 0) - (a.inv ? 1 : 0)) * (prefInv ? 1 : -1); });
        return l[0];
    }

    // ---------- Provedení příkazů; funkce vrací cenu (0 nebo 1 tah)
    function doGo(d) {
        var e = W.rooms[S.room].ex[d];
        if (!e || (e[1] && S.fx[e[1]] === 'hidden')) { say('Tím směrem se jít nedá.', 7); return 0; }
        if (e[1] && S.fx[e[1]] !== 'open') {
            var f = W.fix[e[1]], st = S.fx[e[1]];
            if (st === 'locked' && f.lockedMsg) { say(f.lockedMsg, 7); } else { say(cap(f.n) + ' ' + (f.kind === 'door' ? 'je' : 'je') + ' ' + adjf(f, st === 'locked' ? 'zamčen' : 'zavřen') + '.', 7); }
            return 0;
        }
        S.room = e[0];
        if (S.room !== S.ghost.room) { S.ghost.seen = false; }
        if (W.rooms[S.room].deadly && !lightSource()) {
            say('Ve tmě šlápneš do prázdna. Okraj studny se ti vysmekne zpod nohou a padáš do černé hlubiny...', 10);
            lose('Spadl jsi do studny. Potmě se do ní nechoď.'); return 0;
        }
        describe();
        return 1;
    }
    function contents(fid) { return Object.keys(W.items).filter(function (id) { return S.it[id].inn === fid && S.it[id].loc === W.fix[fid].room; }); }
    function doOpen(f, key) {
        var id = f.id, fx = W.fix[id], st = S.fx[id];
        if (st === 'open') { say(cap(fx.n) + ' ' + adjf(fx, 'otevřen') + ' už je.', 7); return 0; }
        if (st === 'locked') {
            if (fx.key && inInv(fx.key)) { S.fx[id] = 'closed'; say('Klíč zacvakne v zámku. Odemkl jsi ' + fx.n + '.', 12); st = 'closed'; } else {
                say(fx.lockedMsg || (cap(fx.n) + ' ' + adjf(fx, 'zamčen') + '. Potřebuješ správný klíč.'), 7); return 0;
            }
        }
        S.fx[id] = 'open'; Z.snd.beep(200, 0.1, 120, 0.04);
        var msg = 'Otevřel jsi: ' + fx.n + '.';
        if (fx.kind === 'cont') {
            var c = contents(id);
            msg += c.length ? ' Uvnitř vidíš: ' + c.map(function (i) { return W.items[i].n; }).join(', ') + '.' : ' Je prázdná.';
        }
        say(msg, 12); return 1;
    }
    function doClose(f) {
        var fx = W.fix[f.id];
        if (S.fx[f.id] !== 'open') { say(cap(fx.n) + ' ' + adjf(fx, 'zavřen') + ' už je.', 7); return 0; }
        S.fx[f.id] = 'closed'; say('Zavřel jsi: ' + fx.n + '.', 7); return 1;
    }
    function doUnlock(f, keyEnt) {
        var fx = W.fix[f.id], st = S.fx[f.id];
        if (st !== 'locked') { say(cap(fx.n) + ' ' + (st === 'open' ? 'je otevřen' + ({ f: 'á', m: 'ý', p: 'é' })[fx.g] : 'není zamčen' + ({ f: 'á', m: 'ý', p: 'é' })[fx.g]) + '.', 7); return 0; }
        if (!fx.key) { say(fx.lockedMsg || 'To takhle nepůjde.', 7); return 0; }
        if (keyEnt && keyEnt.t === 'i' && keyEnt.id !== fx.key) { say('Ten klíč sem nepasuje.', 7); return 0; }
        if (!inInv(fx.key)) { say('Nemáš klíč, který by sem pasoval.', 7); return 0; }
        S.fx[f.id] = 'closed'; say('Klíč zacvakne v zámku. Odemkl jsi ' + fx.n + '. Teď je můžeš otevřít.', 12); Z.snd.coin(); return 1;
    }
    function doTake(e) {
        if (e.t !== 'i') { say('To nejde vzít.', 7); return 0; }
        if (e.inv) { say('Už to máš u sebe.', 7); return 0; }
        var i = S.it[e.id]; i.loc = 'inv'; i.inn = null;
        say('Bereš: ' + W.items[e.id].n + '.', 12); Z.snd.coin(); return 1;
    }
    function doDrop(e, target) {
        if (e.t !== 'i' || !e.inv) { say('Tohle u sebe nemáš.', 7); return 0; }
        if (target && target.id === 'oltar') { return doAltar(e); }
        S.it[e.id].loc = S.room; say('Pokládáš: ' + W.items[e.id].n + '.', 7); return 1;
    }
    function doAltar(e) {
        if (S.room !== 'krypta') { say('Tady není žádný oltář.', 7); return 0; }
        if (e.id !== 'amulet') { say('Tohle na oltář nepatří. Prohlubeň má tvar amuletu.', 7); return 0; }
        if (!(S.it.svicka.lit && itemNear('svicka'))) {
            say('Amulet dosedne do prohlubně, ale oltář zůstane temný. Chybí rozsvícená svíčka.', 14); return 1;
        }
        S.it.amulet.loc = 'krypta';
        win(); return 0;
    }
    function doExam(e) {
        if (e.t === 'i') {
            var it = W.items[e.id];
            say((it.read && e.id !== 'kniha' ? it.n + '. ' : '') + (it.d || it.n + '.'), 7);
            if (it.read) { say(it.read, 13); if (e.id === 'kniha') { S.flags.kread = true; } }
        } else if (e.t === 'f') {
            var f = W.fix[e.id], st = S.fx[e.id];
            var m = f.d + ' ' + cap(adjf(f, st === 'locked' ? 'zamčen' : st === 'open' ? 'otevřen' : 'zavřen')) + '.';
            if (f.kind === 'cont' && st === 'open') { var c = contents(e.id); m += c.length ? ' Uvnitř: ' + c.map(function (i) { return W.items[i].n; }).join(', ') + '.' : ' Je prázdná.'; }
            say(m, 7);
        } else if (e.t === 'n') { say(W.npcs[e.id].d, 7); } else { say(e.d, 7); }
        return 0;
    }
    function doRead(e) {
        if (e.t === 'i' && W.items[e.id].read) { say(W.items[e.id].read, 13); if (e.id === 'kniha') { S.flags.kread = true; } return 0; }
        say('Není co číst.', 7); return 0;
    }
    function doTalk(e) {
        if (e.t !== 'n') { say('Nikdo ti neodpoví.', 7); return 0; }
        if (e.id === 'zahradnik') {
            if (!S.it.mklic.loc) { say('"Pod mou růží jsem kdysi zakopal klíč od knihovny. Potřebuješ lopatu, ta je v kolně."', 13); } else if (!inInv('medailon') && !S.ghost.gone) { say('"Střez se Šedé paní. Medailon ze salonu tě před ní ochrání."', 13); } else { say('"Do sklepa jen se světlem. Ve tmě se tam utopilo mnoho lidí."', 13); }
        } else if (e.id === 'kocka') {
            if (S.flags.fed) { say('Kočka spokojeně přede a otírá se ti o nohu.', 13); } else { say('"Mňau." Kočka se dívá na tvé kapsy. Zřejmě by uvítala něco k snědku. Na krku jí cinká něco stříbrného.', 13); }
        } else if (e.id === 'pani') {
            if (S.ghost.gone) { say('Šedá paní už není.', 7); } else { say('"Můj medvídek... Kde je můj medvídek? Nechala jsem ho na půdě..." Její hlas zní jako vítr v komíně.', 13); }
        }
        return 1;
    }
    function doGive(item, npc) {
        if (item.t !== 'i' || !item.inv) { say('Tohle u sebe nemáš.', 7); return 0; }
        if (!npc || npc.t !== 'n') { say('Komu?', 7); return 0; }
        if (item.id === 'ryba' && npc.id === 'kocka') {
            S.it.ryba.loc = null; S.flags.fed = true; S.it.sklic.loc = 'kuchyne';
            say('Kočka se vrhne na rybu. Při jídle jí z obojku spadne drobný stříbrný klíč.', 12); Z.snd.coin(); return 1;
        }
        if (item.id === 'medved' && npc.id === 'pani') {
            S.it.medved.loc = null; S.ghost.gone = true;
            say('Šedá paní sevře medvídka a po tváři jí stékají stříbrné slzy. "Děkuji... Oltář v kryptě čeká na amulet a světlo svíčky." Pomalu se rozplyne.', 12); Z.snd.win(); return 1;
        }
        say(cap(npc.n) + ' to nechce.', 7); return 0;
    }
    function doLight(e) {
        var id = e && e.id;
        if (!e) { id = (S.it.lampa.loc === 'inv' || itemNear('lampa')) && S.lamp.full ? 'lampa' : 'svicka'; }
        if (id === 'lampa') {
            if (!itemNear('lampa')) { say('Lampu u sebe nemáš.', 7); return 0; }
            if (S.lamp.lit) { say('Lampa už svítí.', 7); return 0; }
            if (!S.lamp.full) { say('Lampa je prázdná. Potřebuješ do ní nalít olej.', 7); return 0; }
            if (!inInv('zapalky')) { say('Čím ji zapálíš? Potřebuješ zápalky.', 7); return 0; }
            S.lamp.lit = true; say('Škrtneš zápalkou a rozsvítíš lampu. Tmavé kouty ustoupí.', 12);
            if (W.rooms[S.room].dark) { describe(); } return 1;
        }
        if (id === 'svicka') {
            if (!itemNear('svicka')) { say('Svíčku u sebe nemáš.', 7); return 0; }
            if (S.it.svicka.lit) { say('Svíčka už hoří.', 7); return 0; }
            if (!inInv('zapalky') && !S.lamp.lit) { say('Čím ji zapálíš? Potřebuješ zápalky.', 7); return 0; }
            S.it.svicka.lit = true; say('Zapálil jsi svíčku. Plamínek se tiše chvěje.', 12);
            if (W.rooms[S.room].dark) { describe(); } return 1;
        }
        say('To se zapálit nedá.', 7); return 0;
    }
    function doFill() {
        if (!itemNear('lampa') || !(inInv('olej'))) { say('K plnění potřebuješ lampu i olej u sebe.', 7); return 0; }
        if (S.lamp.full) { say('Lampa je už plná.', 7); return 0; }
        S.lamp.full = true; S.it.olej.loc = null; say('Nalil jsi olej do lampy. Teď ji stačí zapálit.', 12); return 1;
    }
    function doDig() {
        if (!inInv('lopata')) { say('Čím bys kopal? Potřebuješ lopatu.', 7); return 0; }
        if (S.room !== 'zahrada') { say('Tady není co vykopávat.', 7); return 1; }
        if (S.it.mklic.loc) { say('Už jsi tu kopal. Nic dalšího tu není.', 7); return 1; }
        S.it.mklic.loc = 'zahrada';
        say('Zaryješ lopatu pod růži. Cink! Ve hlíně se zalesklo něco mosazného: starý klíč.', 12); Z.snd.coin(); return 1;
    }
    function doUse(e, e2) {
        if (e.t === 'f') { if (e2 && e2.t === 'i' && S.fx[e.id] === 'locked' && !doUnlock(e, e2)) { return 0; } return doOpen(e); }
        if (e.t === 'n' || e.t === 's') { say('Jak to chceš použít?', 7); return 0; }
        if (e2 && e2.id === 'oltar') { return doDrop(e, e2); }
        if (e.id === 'olej' || (e.id === 'lampa' && e2 && e2.id === 'olej')) { return doFill(); }
        if (e.id === 'lampa') { return S.lamp.full ? doLight(e) : (inInv('olej') ? doFill() : doLight(e)); }
        if (e.id === 'zapalky') { return doLight(e2 && e2.t === 'i' ? e2 : null); }
        if (e.id === 'svicka') { return doLight(e); }
        if (e.id === 'lopata') { return doDig(); }
        if (e.id === 'ryba' && e2 && e2.t === 'n') { return doGive(e, e2); }
        if (e.id === 'medved' && e2 && e2.t === 'n') { return doGive(e, e2); }
        if (e.id === 'medailon') { say('Medailon máš na krku. Cítíš, jak tě chrání.', 7); return 0; }
        if (e.id === 'amulet') { return doAltar(e); }
        if (e.id === 'zebrik') {
            if (S.room !== 'galerie') { say('Tady žebřík nepotřebuješ.', 7); return 0; }
            if (S.fx.padak !== 'locked') { say('Žebřík už stojí pod dvířky.', 7); return 0; }
            S.fx.padak = 'closed'; S.it.zebrik.loc = 'galerie';
            say('Opřel jsi žebřík o zeď pod padací dvířka. Teď na ně dosáhneš.', 12); return 1;
        }
        if (e.id === 'kniha') {
            if (S.room !== 'knihovna') { say('Tady knihu k ničemu nepoužiješ.', 7); return 0; }
            if (!S.flags.kread) { say('Kniha vypadá důležitě. Možná by ses do ní měl nejdřív začíst.', 7); return 0; }
            if (S.fx.regal !== 'hidden') { say('Regál už je otočený.', 7); return 0; }
            S.fx.regal = 'open'; say('Zasuneš knihu do mezery v polici. Klik! Regál se otočí a za ním se objeví skrytý průchod na sever.', 12); Z.snd.boom(); return 1;
        }
        if (e.t === 'i' && /^[mks]klic$/.test(e.id)) { say('Použít klíč na co? Řekni třeba ODEMKNI DVEŘE KLÍČEM.', 7); return 0; }
        say('Nevíš, jak to tady použít.', 7); return 0;
    }
    function showInv() {
        var l = Object.keys(W.items).filter(inInv).map(function (id) {
            var n = W.items[id].n; if (id === 'lampa') { n += S.lamp.lit ? ' (svítí)' : S.lamp.full ? ' (plná)' : ' (prázdná)'; }
            if (id === 'svicka' && S.it.svicka.lit) { n += ' (hoří)'; } return n;
        });
        say(l.length ? 'Máš u sebe: ' + l.join(', ') + '.' : 'Nemáš u sebe nic.', 13); return 0;
    }
    function help() {
        say('Piš příkazy česky: JDI NA SEVER (nebo S J V Z), VEZMI KLÍČ, POLOŽ, POUŽIJ, OTEVŘI, ZAVŘI, ODEMKNI DVEŘE KLÍČEM, MLUV S, DEJ, ZAPAL, ČTI, PROHLÉDNI, ROZHLÉDNI SE, INVENTÁŘ, ČEKEJ.', 13);
        say('Cíl: najdi zlatý amulet a polož ho na oltář. Čtení a prohlížení tah nestojí.', 13); return 0;
    }

    function parse(raw) {
        var tk = norm(raw).split(' ').filter(Boolean);
        if (!tk.length) { return 0; }
        if (tk.length === 1 && dirOf(tk[0]) && tk[0] !== 'i') { return doGo(dirOf(tk[0])); }
        var verb = verbOf(tk[0]);
        if (!verb) {
            var d0 = dirOf(tk[0]);
            if (d0 && tk.length <= 2) { return doGo(d0); }
            say('Tomu nerozumím. Zkus jiná slova nebo napiš POMOC.', 10); return 0;
        }
        var rest = tk.slice(1);
        if (verb === 'go') {
            var sv = ({ vystup: 'u', vylez: 'u', sestup: 'd', slez: 'd' })[tk[0]];
            if (sv) { return doGo(sv); }
            for (var i = 0; i < rest.length; i++) { var d = dirOf(rest[i]); if (d) { return doGo(d); } }
            say('Kam chceš jít? Zadej světovou stranu.', 7); return 0;
        }
        if (verb === 'look') { describe(); return 0; }
        if (verb === 'inv') { return showInv(); }
        if (verb === 'help') { return help(); }
        if (verb === 'wait') { say('Chvíli čekáš a posloucháš dům...', 7); return 1; }
        if (verb === 'dig') { return doDig(); }
        if (verb === 'fill') { return doFill(); }
        rest = rest.filter(function (t) { return !FILL[t]; });
        var m = mentions(rest);
        if (verb === 'light' && !m.length) { return rest.length ? (say('Nic takového tu nevidím.', 7), 0) : doLight(null); }
        if (verb === 'feed') { verb = 'give'; if (m.length === 1 && m[0][0].t === 'n') { m.unshift(Object.keys(S.it).filter(function (i) { return i === 'ryba' && inInv(i); }).map(function (i) { return mk('i', i, W.items[i], { inv: true }); })); if (!m[0].length) { say('Nemáš čím krmit.', 7); return 0; } } }
        if (!m.length) { say(rest.length ? 'Nic takového tu nevidím.' : 'Co přesně?', 7); return 0; }
        var a = m[0], b = m[1];
        switch (verb) {
            case 'take': return doTake(pick(a, false));
            case 'drop': return doDrop(pick(a, true), b && pick(b, false));
            case 'exam': return doExam(pick(a, false));
            case 'read': return doRead(pick(a, true));
            case 'use': return doUse(pick(a, true), b && pick(b, false));
            case 'open': {
                var f1 = a.filter(function (e) { return e.t === 'f'; })[0];
                if (!f1) { say('To se otevřít nedá.', 7); return 0; }
                return doOpen(f1);
            }
            case 'close': {
                var f2 = a.filter(function (e) { return e.t === 'f'; })[0];
                if (!f2) { say('To se zavřít nedá.', 7); return 0; }
                return doClose(f2);
            }
            case 'unlock': {
                var f3 = a.filter(function (e) { return e.t === 'f'; })[0];
                if (!f3) { say('To se odemknout nedá.', 7); return 0; }
                var key = null;
                if (b) { key = b.filter(function (e) { return e.id === W.fix[f3.id].key; })[0] || pick(b, true); }
                return doUnlock(f3, key);
            }
            case 'talk': return doTalk(pick(a, false));
            case 'give': return doGive(pick(a, true), b && pick(b, false));
            case 'light': return doLight(pick(a, true));
        }
        return 0;
    }

    // ---------- Tah, duch, konec
    function ghostMove() {
        var g = S.ghost;
        if (g.gone || frozenGhost) { return; }
        if (S.rnd() < 0.45) {
            var r = W.rooms[g.room], opts = [];
            Object.keys(r.ex).forEach(function (d) {
                var e = r.ex[d];
                if (passable(e) && W.ghostRooms.indexOf(e[0]) >= 0) { opts.push(e[0]); }
            });
            if (opts.length) { var to = opts[S.rnd() * opts.length | 0]; if (to !== g.room) { g.room = to; g.seen = false; } }
        }
    }
    function ghostCheck() {
        var g = S.ghost;
        if (g.gone || g.room !== S.room) { return; }
        if (protectedFromGhost()) {
            if (!g.seen) { g.seen = true; say('Šedá paní se objeví, ale před medailonem ucukne a jen tě sleduje prázdnýma očima.', 15); }
            return;
        }
        if (S.cool > 0) { return; }
        S.hits++; S.cool = 6; S.turns += 8; Z.snd.hit();
        if (S.hits >= 3) { say('Šedá paní tě ledově sevře potřetí. Svět zčerná...', 10); lose('Šedá paní tě pohltila. Měl sis opatřit medailon.'); return; }
        say('Šedá paní tě ledově sevře! Ztrácíš 8 tahů a v mrákotách se probereš v hale. (zásah ' + S.hits + '/3)', 10);
        S.room = 'hala'; describe();
    }
    function endTurn() {
        S.turns++; if (S.cool > 0) { S.cool--; }
        ghostMove(); ghostCheck();
        if (G.state !== 'play') { return; }
        var left = W.limit - S.turns;
        if (left <= 0) { lose('Zazní úsvit a kletba domu tě pohltila. Nestihl jsi to.'); return; }
        if (left === 20 || left === 8) { say('Východ slunce se blíží. Zbývá ti ' + left + ' tahů!', 10); }
    }
    function win() {
        G.state = 'over'; G.win = true; G.t = 0;
        var rec = Z.hi.submit(HIKEY, KEY_REC - S.turns - 1);
        G.turns = S.turns + 1; G.best = KEY_REC - rec; G.newRecord = rec === KEY_REC - S.turns - 1;
        G.msg = 'Amulet zazáří, kletba je zlomena!';
        S.turns++; Z.snd.win();
    }
    function lose(msg) { G.state = 'over'; G.win = false; G.t = 0; G.msg = msg; G.turns = S.turns; G.best = Z.hi.get(HIKEY) ? KEY_REC - Z.hi.get(HIKEY) : 0; Z.snd.die(); }

    function run(raw, shown) {
        raw = String(raw).trim();
        if (!raw || G.state !== 'play') { return; }
        say('> ' + (shown || raw), 11);
        hist.push(raw); if (hist.length > 30) { hist.shift(); } hpos = hist.length;
        var cost = parse(raw);
        if (G.state === 'play' && cost) { endTurn(); }
    }

    // ---------- Vstup: klávesnice (psaní) a dotykové menu
    function onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) { return; }
        var k = e.key;
        if (G.state !== 'play') { return; }
        if (k === 'Enter') { if (mode === 'kbd') { var c = inp; inp = ''; run(c); } return; }
        if (k === 'Backspace') { inp = inp.slice(0, -1); if (e.preventDefault) { e.preventDefault(); } return; }
        if (k === 'Escape') { inp = ''; return; }
        if (k === 'ArrowUp' && mode === 'kbd') { if (hpos > 0) { hpos--; inp = hist[hpos] || ''; } return; }
        if (k === 'ArrowDown' && mode === 'kbd') { if (hpos < hist.length) { hpos++; inp = hist[hpos] || ''; } return; }
        if (k && k.length === 1 && /[A-Za-z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ ]/.test(k)) {
            mode = 'kbd';
            if (k === ' ' && (!inp || inp.slice(-1) === ' ')) { return; }
            if (inp.length < 38) { inp += k; Z.snd.tick(); }
        }
    }

    var MV = [
        { l: 'JDI', v: 'jdi', k: 'go' }, { l: 'VEZMI', v: 'vezmi', k: 'take' }, { l: 'POLOŽ', v: 'poloz', k: 'drop' }, { l: 'POUŽIJ', v: 'pouzij', k: 'use' },
        { l: 'OTEVŘI', v: 'otevri', k: 'open' }, { l: 'ZAVŘI', v: 'zavri', k: 'close' }, { l: 'ODEMKNI', v: 'odemkni', k: 'unlock' }, { l: 'PROHLÉDNI', v: 'prohledni', k: 'exam' },
        { l: 'ČTI', v: 'cti', k: 'read' }, { l: 'MLUV S', v: 'mluv', k: 'talk' }, { l: 'DEJ', v: 'dej', k: 'give' }, { l: 'ZAPAL', v: 'zapal', k: 'light' },
        { l: 'KOPEJ', v: 'kopej', none: true }, { l: 'NAPLŇ LAMPU', v: 'napln', none: true }, { l: 'ROZHLÉDNI SE', v: 'rozhledni', none: true }, { l: 'INVENTÁŘ', v: 'inventar', none: true }, { l: 'ČEKEJ', v: 'cekej', none: true }
    ];
    var DIRW = { s: 'sever', j: 'jih', v: 'vychod', z: 'zapad', u: 'nahoru', d: 'dolu' };
    var M = { stage: 0, sel: 0, verb: 0, o1: null, list: [] };
    W.ghostRooms = ['predsin', 'hala', 'jidelna', 'kuchyne', 'salon', 'galerie', 'loznice', 'pracovna', 'detsky', 'balkon'];

    function entOpt(e) { return { l: cap(e.n).toUpperCase(), w: e.w, e: e }; }
    function menuObjs(kind, stage, o1) {
        var sc = scope(), out = [];
        function add(f) { sc.filter(f).forEach(function (e) { out.push(entOpt(e)); }); }
        if (stage === 1) {
            switch (kind) {
                case 'go': exitsOf(S.room).forEach(function (d) { out.push({ l: W.dirs[d].toUpperCase(), w: DIRW[d] }); }); break;
                case 'take': add(function (e) { return e.t === 'i' && !e.inv; }); break;
                case 'drop': case 'give': add(function (e) { return e.t === 'i' && e.inv; }); break;
                case 'use': add(function (e) { return e.t === 'i' || e.t === 'f'; }); break;
                case 'open': case 'close': case 'unlock': add(function (e) { return e.t === 'f'; }); break;
                case 'read': add(function (e) { return e.t === 'i' && W.items[e.id].read; }); break;
                case 'talk': add(function (e) { return e.t === 'n'; }); break;
                case 'light': add(function (e) { return e.t === 'i' && (e.id === 'lampa' || e.id === 'svicka'); }); break;
                default: add(function () { return true; });
            }
        } else {
            var skip = function (e) { return !(o1 && e.t === o1.e.t && e.id === o1.e.id); };
            if (kind === 'use') { out.push({ l: '[HOTOVO]', w: '' }); add(function (e) { return skip(e) && (e.t !== 's'); }); }
            if (kind === 'drop') { out.push({ l: '[JEN POLOŽ]', w: '' }); add(function (e) { return e.t === 's' || e.t === 'f'; }); }
            if (kind === 'give') { add(function (e) { return e.t === 'n'; }); }
            if (kind === 'unlock') { out.push({ l: '[AUTOMATICKY]', w: '' }); add(function (e) { return e.t === 'i' && /klic$/.test(e.id); }); }
        }
        return out;
    }
    function menuExec(words, shown) { M.stage = 0; M.o1 = null; run(words, shown); M.sel = M.verb; }
    function menuTick() {
        var n;
        if (M.stage === 0) { n = MV.length; } else { n = M.list.length; }
        if (Z.input.hit('right')) { M.sel = (M.sel + 1) % n; Z.snd.tick(); }
        if (Z.input.hit('left')) { M.sel = (M.sel + n - 1) % n; Z.snd.tick(); }
        if (Z.input.hit('up')) { M.sel = (M.sel + n - 4) % n; }
        if (Z.input.hit('down')) { M.sel = (M.sel + 4) % n; }
        if (Z.input.hit('alt')) {
            if (M.stage > 0) { M.stage--; if (M.stage === 0) { M.sel = M.verb; } else { M.list = menuObjs(MV[M.verb].k, 1); M.sel = 0; } }
        }
        if (Z.input.hit('fire')) {
            var v = MV[M.verb];
            if (M.stage === 0) {
                M.verb = M.sel; v = MV[M.verb];
                if (v.none) { menuExec(v.v, v.l.toLowerCase()); return; }
                M.list = menuObjs(v.k, 1);
                if (!M.list.length) { say('Není co vybrat.', 7); return; }
                M.stage = 1; M.sel = 0;
            } else if (M.stage === 1) {
                M.o1 = M.list[M.sel];
                if (v.k === 'use' || v.k === 'drop' || v.k === 'give' || v.k === 'unlock') {
                    M.list = menuObjs(v.k, 2, M.o1);
                    if (M.list.length) { M.stage = 2; M.sel = 0; return; }
                }
                menuExec(v.v + ' ' + M.o1.w, v.l.toLowerCase() + ' ' + M.o1.l.toLowerCase());
            } else {
                var o2 = M.list[M.sel];
                menuExec(v.v + ' ' + M.o1.w + ' ' + o2.w, v.l.toLowerCase() + ' ' + M.o1.l.toLowerCase() + (o2.w ? ' + ' + o2.l.toLowerCase() : ''));
            }
        }
    }

    // ---------- Kreslení
    function recText() { var b = Z.hi.get(HIKEY); return b ? 'REKORD: ' + (KEY_REC - b) + ' TAHŮ' : 'REKORD ZATÍM NENÍ'; }
    function drawTitle() {
        Z.cls(0, 7); Z.border = 0;
        PIC.draw('zahrada', { day: false });
        Z.text(128, 78, 'ZAKLETÝ DŮM', 14, { align: 'center', scale: 2 });
        Z.text(128, 98, 'TEXTOVÁ ADVENTURA', 11, { align: 'center' });
        var lines = ['NAJDI ZLATÝ AMULET A ZLOM KLETBU.', 'PIŠ ČESKY: JDI NA SEVER, VEZMI KLÍČ,', 'ODEMKNI DVEŘE KLÍČEM. S J V Z = SMĚRY.', 'DOTYK: VYBÍREJ SLOVESO A PŘEDMĚT.', 'LIMIT ' + W.limit + ' TAHŮ, JEN JEDEN POKUS.'];
        lines.forEach(function (l, i) { Z.text(128, 110 + i * 9, l, 15, { align: 'center' }); });
        Z.text(128, 158, recText(), 12, { align: 'center' });
        if ((G.t >> 5) & 1) { Z.text(128, 172, mode === 'menu' ? 'STISKNI OK' : 'ENTER = ZAČÍT HRU', 14, { align: 'center' }); }
    }
    function drawOver() {
        Z.cls(0, 7); Z.border = G.win ? 4 : 2;
        PIC.draw('zahrada', { day: G.win, evil: !G.win });
        Z.text(128, 80, G.win ? 'VÍTĚZSTVÍ!' : 'KONEC HRY', G.win ? 12 : 10, { align: 'center', scale: 2 });
        var y = 102;
        wrap(G.msg, 40).forEach(function (l) { Z.text(128, y, l, 15, { align: 'center' }); y += 9; });
        y += 4;
        Z.text(128, y, 'TAHŮ: ' + G.turns + ' / ' + W.limit, 14, { align: 'center' }); y += 10;
        if (G.win) {
            Z.text(128, y, G.newRecord ? 'NOVÝ REKORD!' : 'REKORD: ' + G.best + ' TAHŮ', G.newRecord ? 12 : 11, { align: 'center' });
        } else { Z.text(128, y, recText(), 11, { align: 'center' }); }
        if (G.t > 50 && ((G.t >> 5) & 1)) { Z.text(128, 178, mode === 'menu' ? 'STISKNI OK' : 'ENTER = TITULNÍ OBRAZOVKA', 14, { align: 'center' }); }
    }
    function drawPlay() {
        Z.cls(0, 7); Z.border = 0;
        Z.text(8, 0, 'ZAKLETÝ DŮM', 13);
        var left = W.limit - S.turns;
        Z.text(248, 0, 'TAH ' + Z.pad(S.turns, 3) + '/' + W.limit, left <= 15 ? 10 : 14, { align: 'right' });
        var lit = hasLight(), npcs = [];
        if (lit) {
            Object.keys(W.npcs).forEach(function (id) { if (S.np[id] === S.room && id !== 'pani') { npcs.push(id); } });
            if (!S.ghost.gone && S.ghost.room === S.room) { npcs.push('pani'); }
        }
        PIC.draw(S.room, { dark: !lit, npcs: npcs });
        var vis = log.slice(-LOGLINES);
        vis.forEach(function (l, i) { Z.text(8, 75 + i * 9, l.t, l.c); });
        Z.rect(8, 166, 240, 1, 1);
        if (mode === 'kbd') {
            Z.text(8, 168, '> ' + inp + (((G.t >> 4) & 1) ? '_' : ' '), 15);
            Z.text(8, 180, 'ENTER=ODESLAT  NAHORU=PŘEDCHOZÍ  POMOC', 9);
        } else {
            var v = MV[M.verb], cur = M.stage === 0 ? MV[M.sel] : M.list[M.sel];
            var crumb = M.stage === 0 ? 'CO UDĚLAT?' : v.l + (M.stage === 2 ? ' ' + M.o1.l + ' ...' : ' ...');
            Z.text(8, 168, crumb, 11);
            Z.rect(8, 179, 240, 11, 1);
            Z.text(128, 179, cur ? cur.l : '-', 14, { align: 'center' });
            Z.text(10, 179, '<', 15); Z.text(244, 179, '>', 15);
        }
    }

    function startGame() { newGame(); M.stage = 0; M.sel = 0; M.verb = 0; G.state = 'play'; G.t = 0; Z.snd.win(); }
    var game = {
        tick: function () {
            G.t++; Z.pauseOk = false;
            if (G.state === 'title') { if (Z.input.hit('fire') && G.t > 5) { startGame(); } }
            else if (G.state === 'over') { if (G.t > 50 && Z.input.hit('fire')) { G.state = 'title'; G.t = 0; } }
            else if (mode === 'menu') { menuTick(); }
        },
        draw: function () {
            if (G.state === 'title') { drawTitle(); } else if (G.state === 'over') { drawOver(); } else { drawPlay(); }
        }
    };

    Z.keymap.pause = []; Z.keymap.mute = [113];         // P a M jsou při psaní normální písmena; ztlumení zvuku F2
    Z.rebuildKeys();
    Z.init({
        title: 'Zakletý dům',
        touch: [{ act: 'left', label: '◀' }, { act: 'right', label: '▶' }, { act: 'fire', label: 'OK', cls: 'big' }, { act: 'alt', label: 'ZPĚT' }]
    });
    if (root.document && root.document.addEventListener) {
        root.document.addEventListener('keydown', onKey);
        root.document.addEventListener('pointerdown', function (e) { if (e && e.pointerType === 'touch') { mode = 'menu'; } });
    }
    Z.run(game);

    // Rozhraní pro testy
    root.GAME = {
        W: W, G: G, game: game, onKey: onKey, run: run, newGame: newGame, scope: scope, parse: parse, norm: norm,
        S: function () { return S; }, log: function () { return log; }, setMode: function (m) { mode = m; }, getMode: function () { return mode; },
        freezeGhost: function (b) { frozenGhost = b; }, lightSource: lightSource, input: function () { return inp; }, menu: M, startGame: startGame,
        menuObjs: menuObjs, MV: MV, KEY_REC: KEY_REC
    };
})(typeof window !== 'undefined' ? window : globalThis);
