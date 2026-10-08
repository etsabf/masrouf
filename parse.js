/* Masrouf — parseur de dépenses dictées (français + arabe / derja)
   Règle algérienne : dès qu'on parle en "millions" / "مليون" / "milliard" / "centimes",
   on compte en centimes  →  1 million = 10 000 DA.                                   */
(function (root) {
  'use strict';

  const AR_DIGITS = { '٠':0,'١':1,'٢':2,'٣':3,'٤':4,'٥':5,'٦':6,'٧':7,'٨':8,'٩':9,
                      '۰':0,'۱':1,'۲':2,'۳':3,'۴':4,'۵':5,'۶':6,'۷':7,'۸':8,'۹':9 };

  // valeurs simples (unités, dizaines, centaines)
  const WORDS = {
    // français
    'zero':0,'zéro':0,'un':1,'une':1,'deux':2,'trois':3,'quatre':4,'cinq':5,'six':6,'sept':7,'huit':8,'neuf':9,
    'dix':10,'onze':11,'douze':12,'treize':13,'quatorze':14,'quinze':15,'seize':16,
    'vingt':20,'vingts':20,'trente':30,'quarante':40,'cinquante':50,'soixante':60,
    'cent':100,'cents':100,
    // arabe / derja
    'واحد':1,'واحدة':1,'وحدة':1,'اثنين':2,'اثنان':2,'اثنتين':2,'زوج':2,'جوج':2,
    'ثلاث':3,'ثلاثة':3,'ثلاثه':3,'تلت':3,'تلاتة':3,'أربع':4,'اربع':4,'أربعة':4,'اربعة':4,'ربعة':4,
    'خمس':5,'خمسة':5,'خمسه':5,'ست':6,'ستة':6,'سته':6,'سبع':7,'سبعة':7,'سبعه':7,
    'ثمان':8,'ثماني':8,'ثمانية':8,'ثمانيه':8,'تمنية':8,'تسع':9,'تسعة':9,'تسعه':9,
    'عشر':10,'عشرة':10,'عشره':10,'عشرا':10,
    'إحدى':1,'احدى':1,'أحد':1,'احد':1,'اثنا':2,'اثني':2,'حداش':11,'طناش':12,
    'عشرين':20,'عشرون':20,'ثلاثين':30,'ثلاثون':30,'أربعين':40,'اربعين':40,'أربعون':40,
    'خمسين':50,'خمسون':50,'ستين':60,'ستون':60,'سبعين':70,'سبعون':70,
    'ثمانين':80,'ثمانون':80,'تسعين':90,'تسعون':90,
    'مية':100,'ميه':100,'مئة':100,'مائة':100,'مئه':100,'ميا':100,
    'ميتين':200,'مئتين':200,'مئتان':200,'مائتين':200,'مائتان':200,
    'ثلاثمائة':300,'ثلاثمئة':300,'ثلاثمية':300,'أربعمائة':400,'اربعمائة':400,'أربعمئة':400,'ربعمية':400,
    'خمسمائة':500,'خمسمئة':500,'خمسمية':500,'ستمائة':600,'ستمئة':600,'ستمية':600,
    'سبعمائة':700,'سبعمئة':700,'سبعمية':700,'ثمانمائة':800,'ثمانمئة':800,'تمنمية':800,
    'تسعمائة':900,'تسعمئة':900,'تسعمية':900
  };
  // multiplicateurs : [facteur, compteEnCentimes]
  const SCALES = {
    'mille':[1e3,false],'milles':[1e3,false],
    'ألف':[1e3,false],'الف':[1e3,false],'آلاف':[1e3,false],'الاف':[1e3,false],'ألاف':[1e3,false],
    'million':[1e6,true],'millions':[1e6,true],
    'مليون':[1e6,true],'ملايين':[1e6,true],'ملاين':[1e6,true],'ملاين':[1e6,true],'مليونات':[1e6,true],
    'milliard':[1e9,true],'milliards':[1e9,true],'مليار':[1e9,true],'ملايير':[1e9,true],'مليارات':[1e9,true]
  };
  const DUALS = { 'ألفين':[2,1e3,false],'الفين':[2,1e3,false],'ألفان':[2,1e3,false],
                  'مليونين':[2,1e6,true],'مليونان':[2,1e6,true],'مليارين':[2,1e9,true] };
  const HALF = new Set(['demi','demie','نص','نصف','ونص','ونصف']);
  const AND = new Set(['و','et']);
  const CENTIME_WORDS = /\b(centimes?)\b|سنتيم|سانتيم|صوردي/;

  const CATEGORIES = [
    { id:'carburant', fr:'Carburant', ar:'وقود', keys:['carburant','essence','gasoil','gazole','diesel','plein','station','naftal','بنزين','مازوت','ليصانص','قازوال','وقود','محطة','نفطال','ديزل'] },
    { id:'repas', fr:'Repas', ar:'أكل', keys:['repas','déjeuner','dejeuner','dîner','diner','resto','restaurant','café','cafe','pizza','sandwich','petit-déjeuner','غداء','غدا','عشاء','عشا','فطور','قهوة','مطعم','أكل','اكل','ماكلة','كاسكروط','بيتزا'] },
    { id:'courses', fr:'Courses', ar:'مشتريات', keys:['courses','supérette','superette','marché','marche','pain','lait','légumes','legumes','fruits','viande','épicerie','سوق','خبز','حليب','خضرة','خضار','فواكه','لحم','حانوت','مشتريات','قضيان','قضية'] },
    { id:'transport', fr:'Transport', ar:'نقل', keys:['taxi','bus','transport','billet','avion','train','péage','peage','parking','vtc','yassir','طاكسي','تاكسي','نقل','حافلة','كار','تذكرة','طيارة','قطار','باركينغ'] },
    { id:'atelier', fr:'Atelier & matériel', ar:'ورشة وعتاد', keys:['matériel','materiel','outil','outils','pièce','pièces','piece','pieces','atelier','soudure','électrode','electrode','disque','vis','boulon','acier','tôle','tole','huile','pneu','pneus','réparation','reparation','mécanicien','mecanicien','عتاد','أدوات','ادوات','قطع','قطعة','ورشة','لحام','حديد','زيت','عجلة','روطار','بنوة','تصليح','ميكانيك'] },
    { id:'factures', fr:'Factures', ar:'فواتير', keys:['facture','factures','électricité','electricite','sonelgaz','eau','internet','téléphone','telephone','flexy','recharge','loyer','abonnement','فاتورة','فواتير','كهرباء','سونلغاز','ماء','انترنت','أنترنت','فليكسي','تعبئة','كراء','اشتراك','هاتف'] },
    { id:'sante', fr:'Santé', ar:'صحة', keys:['pharmacie','médicament','medicament','médecin','medecin','docteur','analyse','clinique','صيدلية','دواء','دوا','طبيب','دكتور','تحاليل','عيادة'] },
    { id:'personnel', fr:'Personnel & salaires', ar:'عمال وأجور', keys:['salaire','salaires','ouvrier','ouvriers','avance','prime','journée','journee','أجرة','اجرة','خلصة','راتب','عامل','عمال','تسبيق','منحة'] },
    { id:'autre', fr:'Autre', ar:'أخرى', keys:[] }
  ];

  const FILLER = new Set([
    // fr
    "j'ai","jai","j","ai","dépensé","depense","dépensée","dépenses","dépense","payé","paye","payée","acheté","achete",
    "ça","ca","fait","fais","pour","de","du","des","le","la","les","l","d","un","une","en","au","aux","à","a","sur","dans","avec",
    "dinars","dinar","da","dzd","centimes","centime","total","c'est","cest","coûté","coute","coûte","aujourd'hui","euros",
    // ar
    "صرفت","صرف","خلصت","دفعت","شريت","اشتريت","بـ","ب","في","على","عل","ل","لل","من","دينار","دنانير","دج","دورو","دوراو",
    "سنتيم","مصروف","اليوم","هذا","هاد","تاع","ديال","نتاع","حق","انا","أنا","مصاريف"
  ]);

  function normalize(text) {
    let t = String(text || '').toLowerCase();
    t = t.replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d]);
    t = t.replace(/[ً-ْـ]/g, '');          // tashkeel + tatweel
    t = t.replace(/[   ]/g, ' ');            // espaces insécables
    t = t.replace(/[٬]/g, ' ').replace(/٫/g, ',');
    // 10 000 / 10.000 / 10,000 → 10000 (groupes de 3 chiffres)
    for (let i = 0; i < 4; i++) t = t.replace(/(\d)[ .,](\d{3})(?!\d)/g, '$1$2');
    t = t.replace(/(\d)\s*(da|dzd)\b/g, '$1 $2');
    t = t.replace(/(\d)(دج|دينار)/g, '$1 $2');
    t = t.replace(/[!?؟،;:"«»()]/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }

  function tokenize(t) {
    const out = [];
    for (let w of t.split(' ')) {
      if (!w) continue;
      // préfixe arabe "و" collé à un nombre : وعشرين → و + عشرين
      if (w.length > 2 && w[0] === 'و' && !(w in WORDS) && !(w in SCALES) && !(w in DUALS) && !HALF.has(w)) {
        const rest = w.slice(1);
        if (rest in WORDS || rest in SCALES || rest in DUALS || HALF.has(rest)) { out.push('و', rest); continue; }
      }
      // préfixe "ب" collé : بعشرة → ب + عشرة
      if (w.length > 2 && w[0] === 'ب' && !(w in WORDS)) {
        const rest = w.slice(1);
        if (rest in WORDS || rest in SCALES || rest in DUALS || /^\d/.test(rest)) { out.push('ب', rest); continue; }
      }
      // "quatre-vingt", "dix-huit" …
      if (w.includes('-') && w.split('-').every(p => p in WORDS || p === 'et')) { out.push(...w.split('-')); continue; }
      out.push(w);
    }
    return out;
  }

  function numOf(tok) {
    if (/^\d+([.,]\d+)?$/.test(tok)) return parseFloat(tok.replace(',', '.'));
    if (tok in WORDS) return WORDS[tok];
    return null;
  }

  /** Renvoie { amount (DA), label, category, centimes, raw } ou null si aucun montant. */
  function parseExpense(text, opts) {
    const centimesMode = !opts || opts.millionAsCentimes !== false;
    const norm = normalize(text);
    const toks = tokenize(norm);

    let start = -1, end = -1;
    let total = 0, current = 0, usedCentimes = false, lastScale = 0, started = false;
    let pendingTensFr = 0;

    for (let i = 0; i < toks.length; i++) {
      const tk = toks[i];
      const n = numOf(tk);
      const isScale = tk in SCALES, isDual = tk in DUALS, isHalf = HALF.has(tk);
      if (n !== null || isScale || isDual || (started && isHalf)) {
        if (!started) { started = true; start = i; }
        end = i;
        if (n !== null) {
          // "quatre vingt" → 80, "soixante dix" → 70
          if (current % 100 >= 20 && n < 20 && current % 10 === 0 && /^[a-zé]/.test(tk)) current += n;
          else if (tk === 'vingt' && current % 100 === 4) current = current - 4 + 80;
          else if (n === 100 && current % 100 > 0 && current % 100 < 10 && /^[a-zé]/.test(tk)) current = current - (current % 100) + (current % 100) * 100;
          else if (n === 100 && current === 0) current = 100;
          else if (current && n < current && n < 100) current += n;            // vingt-deux, مية و خمسين
          else if (current % 100 > 0 && current % 100 < 10 && n >= 20 && n < 100 && n % 10 === 0) current += n; // خمسة و عشرين
          else if (current && n >= 100 && WORDS[tk] === n) current += n;      // mille cinq-cents
          else { if (current) { total += current; } current = n; }
        } else if (isDual) {
          const [k, s, c] = DUALS[tk];
          total += k * s; current = 0; lastScale = s; usedCentimes = usedCentimes || c;
        } else if (isScale) {
          const [s, c] = SCALES[tk];
          total += (current || 1) * s; current = 0; lastScale = s; usedCentimes = usedCentimes || c;
        } else if (isHalf) {
          total += (lastScale || 1) * 0.5;
        }
        continue;
      }
      if (started && AND.has(tk)) {
        const nx = toks[i + 1];
        if (nx && (numOf(nx) !== null || nx in SCALES || nx in DUALS || HALF.has(nx))) { end = i; continue; }
      }
      if (started) break;
    }
    if (!started) return null;
    let value = total + current;
    if (!value) return null;

    const centWord = CENTIME_WORDS.test(norm);
    const isCent = centimesMode ? (usedCentimes || centWord) : centWord;
    const amount = Math.round((isCent ? value / 100 : value) * 100) / 100;

    const rest = toks.filter((_, i) => i < start || i > end)
      .filter(w => !FILLER.has(w) && !/^\d+$/.test(w) && w.length > 1)
      .join(' ').replace(/^(et|و)\s+/, '').trim();

    return { amount, label: prettyLabel(rest), category: guessCategory(norm), centimes: isCent, raw: String(text || '').trim() };
  }

  function prettyLabel(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function guessCategory(norm) {
    const words = new Set(tokenize(norm));
    for (const c of CATEGORIES) {
      for (const k of c.keys) {
        if (words.has(k) || (k.length > 4 && norm.includes(k))) return c.id;
        // arabe : mot avec article "ال" ou préfixe "ل"/"ب"
        if (/[؀-ۿ]/.test(k) && (words.has('ال' + k) || words.has('لل' + k) || words.has('ب' + k) || words.has('ل' + k))) return c.id;
      }
    }
    return 'autre';
  }

  const api = { parseExpense, guessCategory, normalize, CATEGORIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MasroufParse = api;
})(typeof self !== 'undefined' ? self : this);
