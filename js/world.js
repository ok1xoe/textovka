// Data světa hry Zakletý dům: místnosti, východy, zámky, předměty, postavy.
// Směry: s=sever, j=jih, v=východ, z=západ, u=nahoru, d=dolů. Východ = [cíl, id zámku/dveří].
(function (root) {
    'use strict';
    var W = {};
    W.dirs = { s: 'sever', j: 'jih', v: 'východ', z: 'západ', u: 'nahoru', d: 'dolů' };
    W.start = 'zahrada';
    W.limit = 130;

    W.rooms = {
        zahrada: { n: 'Zahrada', ex: { s: ['predsin', 'brana'], z: ['kolna'] },
            d: 'Stojíš ve zpustlé zahradě před starým domem. V okně se mihne světlo. Na severu je rezavá brána, na západě dřevěná kolna. U plotu kvete jediná růže.' },
        kolna: { n: 'Kolna', ex: { v: ['zahrada'] },
            d: 'Stísněná kolna plná nářadí a pavučin. Prkna vrzají. Východem se vrátíš do zahrady.' },
        predsin: { n: 'Předsíň', ex: { j: ['zahrada', 'brana'], s: ['hala'] },
            d: 'Prašná předsíň s věšákem a oválným zrcadlem. Na jihu je brána do zahrady, na severu se otevírá velká hala.' },
        hala: { n: 'Velká hala', ex: { j: ['predsin'], v: ['salon'], z: ['jidelna'], u: ['galerie'] },
            d: 'Obrovská hala s křišťálovým lustrem a starými hodinami. Široké schody vedou nahoru na galerii. Na východě je salon, na západě jídelna.' },
        jidelna: { n: 'Jídelna', ex: { v: ['hala'], z: ['kuchyne'] },
            d: 'Dlouhý stůl je prostřen pro hostinu, která nikdy nezačala. Svíčky na něm se samy nehýbou. Na západě je kuchyně, na východě hala.' },
        kuchyne: { n: 'Kuchyně', ex: { v: ['jidelna'], s: ['spiz', 'spizd'], d: ['sklep'] },
            d: 'Černá kuchyně s obrovským sporákem. Na severu jsou dvířka do spíže, v podlaze zeje otvor se schody dolů do sklepa.' },
        spiz: { n: 'Spíž', ex: { j: ['kuchyne', 'spizd'] },
            d: 'Těsná spíž. Na policích stojí sklenice s kompoty a z trámu visí uzenina. Jedinou cestou ven je jih.' },
        salon: { n: 'Salon', ex: { z: ['hala'], v: ['knihovna', 'knihdv'] },
            d: 'Elegantní salon. V krbu doutná oheň, ze zdi shlíží portrét přísné dámy. V rohu stojí vitrína. Na východě jsou dubové dveře.' },
        knihovna: { n: 'Knihovna', ex: { z: ['salon', 'knihdv'], s: ['tajna', 'regal'] },
            d: 'Stěny jsou od podlahy ke stropu pokryty knihami. Vzduch voní papírem a časem. Odsud se vrátíš západem do salonu.' },
        tajna: { n: 'Tajná komnata', ex: { j: ['knihovna', 'regal'] },
            d: 'Úzká kamenná komnata s runami na podlaze. Na podstavci stojí okovaná skříňka. Východ je jen jeden, na jih.' },
        galerie: { n: 'Galerie', ex: { d: ['hala'], v: ['loznice'], s: ['pracovna'], z: ['detsky'], j: ['balkon'], u: ['podkrovi', 'padak'] },
            d: 'Ochoz nad halou. Dveře vedou na východ do ložnice, na sever do pracovny, na západ do dětského pokoje a na jih na balkon. Nad hlavou je strop s padacími dvířky.' },
        loznice: { n: 'Ložnice', ex: { z: ['galerie'] },
            d: 'Ložnice s nebesy. Postel je neustlaná, jako by z ní někdo právě vstal. Na nočním stolku leží deník.' },
        pracovna: { n: 'Pracovna', ex: { j: ['galerie'] },
            d: 'Pracovna starého pána. Psací stůl, globus a police s pergameny. Všude leží prach silný jako sníh.' },
        detsky: { n: 'Dětský pokoj', ex: { v: ['galerie'] },
            d: 'Dětský pokoj s malou postýlkou a dřevěným koníkem. Na stěnách se táhnou vybledlé duhové pruhy. Je tu ledově.' },
        podkrovi: { n: 'Půda', ex: { d: ['galerie', 'padak'] },
            d: 'Nízká půda plná pavučin a rozbitého nábytku. Měsíc svítí malým okénkem na starou truhlu. Dolů vedou padací dvířka.' },
        balkon: { n: 'Balkon', ex: { s: ['galerie'] },
            d: 'Balkon s kamennou balustrádou. Pod tebou se vlní tmavý les, nad ním plove měsíc. Zpět je cesta na sever.' },
        sklep: { n: 'Sklep', ex: { u: ['kuchyne'], v: ['vinarna'] }, dark: true,
            d: 'Klenutý sklep s vlhkými zdmi. Po schodech nahoru se vrátíš do kuchyně, na východě pokračuje chodba do vinárny.' },
        vinarna: { n: 'Vinárna', ex: { z: ['sklep'], s: ['studna'], v: ['krypta', 'kryptadv'] }, dark: true,
            d: 'Řady sudů a pavučin. Od severu táhne chlad a slyšíš pomalé kapání vody. Na východě jsou těžké železné dveře.' },
        studna: { n: 'Studna', ex: { j: ['vinarna'] }, dark: true, deadly: true,
            d: 'Kruhová jeskyně se starou studnou uprostřed. Okraj je kluzký. Na kamenném okraji leží svíčka. Zpět je cesta na jih.' },
        krypta: { n: 'Krypta', ex: { z: ['vinarna', 'kryptadv'] }, dark: true,
            d: 'Rodinná hrobka. Na kamenných sarkofázích tančí stíny. Uprostřed stojí oltář s prohlubní ve tvaru amuletu.' }
    };

    // g = rod: f ženský, m mužský, p množné/střední (pro tvary zavřená/zavřené/zavřený)
    W.fix = {
        brana: { n: 'rezavá brána', st: ['bran'], g: 'f', kind: 'door', state: 'closed', d: 'Rezavá kovová brána s vrzavými panty.' },
        spizd: { n: 'dvířka do spíže', st: ['dvirk', 'spiz'], g: 'p', kind: 'door', state: 'closed', d: 'Malá dřevěná dvířka.' },
        knihdv: { n: 'dubové dveře', st: ['dver'], adj: ['dub'], g: 'p', kind: 'door', state: 'locked', key: 'mklic', d: 'Masivní dubové dveře s mosazným zámkem.' },
        regal: { n: 'otočný regál', st: ['regal', 'polic'], g: 'm', kind: 'door', state: 'hidden', d: 'Regál s knihami, který se otočil a odhalil průchod.' },
        padak: { n: 'padací dvířka', st: ['dvirk', 'padac', 'strop'], g: 'p', kind: 'door', state: 'locked', lockedMsg: 'Padací dvířka jsou příliš vysoko, nedosáhneš na ně.', d: 'Čtvercová dvířka ve stropě, příliš vysoko na dosah.' },
        kryptadv: { n: 'železné dveře', st: ['dver'], adj: ['zelezn'], g: 'p', kind: 'door', state: 'locked', key: 'kklic', d: 'Těžké železné dveře s kostěnou klíčovou dírkou.' },
        vitrina: { n: 'vitrína', st: ['vitrin'], g: 'f', kind: 'cont', room: 'salon', state: 'closed', d: 'Prosklená vitrína.' },
        skrinka: { n: 'okovaná skříňka', st: ['skrin', 'truhl'], g: 'f', kind: 'cont', room: 'tajna', state: 'locked', key: 'sklic', d: 'Okovaná skříňka se stříbrným zámkem.' }
    };

    W.items = {
        lopata: { n: 'lopata', st: ['lopat'], loc: 'kolna', d: 'Zahradnická lopata. Vypadá, že už dlouho nekopala.' },
        olej: { n: 'láhev oleje', st: ['ole', 'lahv'], loc: 'kolna', d: 'Láhev lampového oleje.' },
        lampa: { n: 'olejová lampa', st: ['lamp'], adj: ['olejov'], loc: 'kolna', d: 'Staromódní olejová lampa.' },
        zebrik: { n: 'dřevěný žebřík', st: ['zebri'], loc: 'kolna', d: 'Lehký dřevěný žebřík.' },
        zapalky: { n: 'zápalky', st: ['zapalk', 'krabic'], loc: 'jidelna', d: 'Krabička suchých zápalek.' },
        ryba: { n: 'sušená ryba', st: ['ryb'], adj: ['susen'], loc: 'spiz', d: 'Sušená ryba. Voní tak, že by ji ucítil i hluchý.' },
        mklic: { n: 'mosazný klíč', st: ['klic'], adj: ['mosaz'], loc: null, d: 'Těžký mosazný klíč, ještě od hlíny.' },
        sklic: { n: 'stříbrný klíč', st: ['klic'], adj: ['stribr'], loc: null, d: 'Drobný stříbrný klíček.' },
        kklic: { n: 'kostěný klíč', st: ['klic'], adj: ['kost'], loc: 'podkrovi', d: 'Klíč vyřezaný z bílé kosti.' },
        medailon: { n: 'stříbrný medailon', st: ['medail'], adj: ['stribr'], loc: 'salon', inn: 'vitrina', d: 'Medailon s vyrytým sluncem. Hřeje v dlani a chrání před duchy.' },
        dopis: { n: 'dopis', st: ['dopis', 'list'], loc: 'predsin', read: 'Milý hoste, dům je zakletý od smrti paní domu. Kletbu zlomí jen zlatý amulet na oltáři v kryptě při světle svíčky. Ve tmě sklepa hrozí studna! Do úsvitu máš jen omezený čas. V.' },
        kniha: { n: 'Kniha stínů', st: ['knih'], loc: 'knihovna', d: 'Starý svazek s kožešinovou vazbou.', read: 'Kniha stínů: Amulet ukrývá tajná komnata. Regál se otočí, když tuto knihu POUŽIJEŠ v knihovně. Skříňku odemkne stříbrný klíč, který nosí kočka.' },
        denik: { n: 'deník', st: ['denik'], loc: 'loznice', read: 'Deník: Můj medvídek zůstal na půdě. Kostěný klíč od krypty jsem schovala tam, kam dosáhneš jen po žebříku. Svíčku jsem upustila u studny.' },
        svicka: { n: 'svíčka', st: ['svic'], loc: 'studna', d: 'Tlustá bílá svíčka.' },
        medved: { n: 'plyšový medvídek', st: ['medv', 'medvid'], adj: ['plysov'], loc: 'podkrovi', d: 'Roztrhaný plyšový medvídek s jedním okem.' },
        amulet: { n: 'zlatý amulet', st: ['amul'], adj: ['zlat'], loc: 'tajna', inn: 'skrinka', d: 'Zlatý amulet zářící vlastním světlem.' }
    };

    W.npcs = {
        zahradnik: { n: 'starý zahradník', st: ['zahradnik', 'zahrad'], loc: 'zahrada', d: 'Shrbený stařík s lopatou bez ostří. Zdá se, že ho vůbec nevadí, že je průsvitný.' },
        kocka: { n: 'černá kočka', st: ['kock', 'kocc', 'kocic'], loc: 'kuchyne', d: 'Černá kočka s žlutýma očima. Přede.' },
        pani: { n: 'Šedá paní', st: ['pani', 'dam', 'duch'], loc: 'detsky', d: 'Průsvitná žena v šedých šatech. Hledá něco, co ztratila.' }
    };

    W.scen = {
        zahrada: [{ st: ['ruz'], d: 'Rudá růže. Půda pod ní je čerstvě nakypřená.' }, { st: ['dum'], d: 'Starý dům s tmavými okny.' }, { st: ['plot'], d: 'Zchátralý plot.' }],
        kolna: [{ st: ['nared', 'pavuc'], d: 'Rez a pavučiny.' }],
        predsin: [{ st: ['zrcadl'], d: 'V zrcadle se na okamžik mihne další postava. Pak zmizí.' }, { st: ['vesak'], d: 'Prázdný věšák.' }],
        hala: [{ st: ['hodin'], d: 'Hodiny stojí na půlnoci.' }, { st: ['lustr'], d: 'Křišťálový lustr, v něm hoří jediná svíčka.' }, { st: ['schod'], d: 'Široké schody vedou nahoru.' }],
        jidelna: [{ st: ['stul'], d: 'Prostřený stůl. Jídlo je z prachu. Na kraji leží krabička zápalek.' }],
        kuchyne: [{ st: ['sporak'], d: 'Studený sporák.' }, { st: ['otvor', 'schod'], d: 'Schody do tmavého sklepa.' }],
        spiz: [{ st: ['kompot', 'sklen'], d: 'Kompoty z minulého století.' }],
        salon: [{ st: ['portret'], d: 'Přísná dáma na portrétu má v očích smutek.' }, { st: ['krb', 'ohen'], d: 'Oheň v krbu hřeje, i když ho nikdo nenaložil.' }],
        knihovna: [{ st: ['prach'], d: 'Spousta knih a prach. Jedna kniha je vysunutá víc než ostatní.' }],
        tajna: [{ st: ['run'], d: 'Runy říkají: Světlo a zlato zlomí kletbu.' }],
        galerie: [{ st: ['ochoz', 'zabradl'], d: 'Dřevěné zábradlí nad halou.' }],
        loznice: [{ st: ['postel', 'nebes'], d: 'Postel se zdánlivě pohybuje, jako by dýchala.' }],
        pracovna: [{ st: ['globus'], d: 'Globus. Nejsou na něm žádné pevniny, jen hřbitovy.' }, { st: ['stul', 'pergamen'], d: 'Pergameny jsou prázdné.' }],
        detsky: [{ st: ['konik', 'postylk'], d: 'Dřevěný koník se pomalu houpe.' }],
        podkrovi: [{ st: ['truhl'], d: 'Prázdná truhla.' }],
        balkon: [{ st: ['les', 'mesic'], d: 'Les šumí a měsíc se kyvadlově zjasňuje.' }],
        sklep: [{ st: ['sud'], d: 'Sudy plné prachu.' }],
        vinarna: [{ st: ['sud'], d: 'Sudy jsou prázdné.' }],
        studna: [{ st: ['studn'], d: 'Hluboká černá studna. Nikdy bys neměl šlapat potmě.' }],
        krypta: [{ st: ['oltar'], id: 'oltar', d: 'Kamenný oltář s prohlubní ve tvaru amuletu. Okolo je místo pro svíčku.' }, { st: ['sarkofag', 'hrob'], d: 'Chladné kamenné sarkofágy.' }]
    };

    root.WORLD = W;
})(typeof window !== 'undefined' ? window : globalThis);
