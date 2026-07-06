const xlsx = require('xlsx');

// ── 1. Parse DB data ────────────────────────────────────────────────────────
const DB_RAW = `A01|3904690|3904690|ANUP SINGH
A10|2350080|2350100|ANOOP KUMAR
A11|2350080|2349920|VIJAY CHAUDHARY
A12|2350080|0|REENA
A12|2350080|2350080|
A13|2764310|0|
A14|3592710|0|
A15|2480640|0|
A16|2454528|0|MAMTA
A16|2454528|0|MAMTA
A17|2454528|711000|PANKAJ KUMAR
A18|2480640|0|VIPIN KUMAR
A18|2480640|205000|VIPIN KUMAR
A19|2350080|2350000|RAVINDRA PANWAR
A2|2480640|1200000|RISHAB BHARDWAJ
A20|4653000|4653000|VIPUL KANSAL
A20|4653000|0|VIPUL KANSAL
A21|4465000|0|PRAVENDRA LILON
A21|4465000|4465000|SAGAR MALIK
A22|2350080|2316500|RAMAN MALIK
A22|2350080|0|RAMAN MALIK
A23|2480640|1010000|VIJAY PANWAR
A23|2480640|0|VIJAY PANWAR
A24|2428416|0|SANJIV BHARDWAJ
A24|2428416|2428000|SANJIV BHARDWAJ
A25|2376192|2375552|YASHPAL SINGH
A25|2376192|0|YASHPAL SINGH
A26|2480640|2487000|SANJAY KUMAR
A26|2480640|-4000|SANJAY KUMAR
A27|2415360|0|RUMA
A27|2415360|1310000|RUMA
A28|2472090|0|
A29|3396440|0|
A3|2545920|1700000|PRAVENDRA KUMAR
A30|2480640|0|
A31|2480640|0|
A32|2480640|0|
A33|2585088|1168000|DEV CHAUDHARY
A33|2585088|1417000|RAVI
A34|2611200|2716200|ROHIT KUMAR
A35|2578560|0|PRITI DEVI
A35|2578560|2578100|
A36|2480640|2480552|BIJENDRA SINGH
A37|2350080|0|URMILA SHARMA
A37|2350080|2349720|
A38|2350080|0|AMITESH VASHISTHA
A38|2350080|1000000|AMITESH VASHISTHA
A39|2480640|1230000|ANUJ KUMAR BANSAL
A39|2480640|0|ANUJ KUMAR BANSAL
A4|2454528|2454500|MANISH
A40|2480640|0|SUBHASANA DEVI
A40|2480640|2480280|
A41|2454528|0|ANKUR KUMAR
A41|2454528|2454500|
A42|2350080|2350000|ANKUR KUMAR
A43|2815610|0|
A45|3996840|0|
A46|2480640|0|
A47|2480640|0|
A48|2480640|0|
A49|2480640|0|
A5|2441472|920000|CHETAN
A50|2480640|0|
A51|2480640|0|
A52|2480640|0|
A53|4817500|0|SANDEEP KUMAR
A53|4817500|4817500|SANDEEP KUMAR
A54|4700000|0|SATYAM
A54|4700000|4705000|
A55|2389248|2389000|JITENDRA KUMAR
A56|5500001|200000|SOURAV MALIK
A57|2550000|2550000|PANKAJ KUMAR
A58|2545920|2545900|MANOJ BALIYAN
A59|2480640|800000|VISHAL
A6|4629500|4629500|KAVITA
A6|4629500|0|DHAWAL MALHOTRA
A60|2480640|0|
A61|2480640|0|
A62|2480640|0|
A63|3196750|0|
A7|4465000|1800000|CHANDRA MOHAN ADV
A7|4465000|2000100|VIKRANT TOMAR
A8|2519808|2519873|SURAJ CHAUDHARY
A9|2350080|2350080|PRAVENDRA KUMAR
B1|4465000|4465000|BHAGAT SINGH
B1|4465000|0|AMIT BALIYAN
B10|2415360|241000|HARSHIT RANA
B10|2415360|2174000|KULDEEP RANA
B11|2350080|403900|PRADEEP RANA
B11|2350080|1924000|PRADEEP RANA
B12|2350080|1077000|PRADEEP RANA
B12|2350080|1664000|SUNITA
B13|2428416|2428021|ANSHU RANI
B14|2350080|2350060|SUDHIR KUMAR
B15|2350080|2350080|SHIPRA CHAUDHARY
B16|4465000|4465000|RAVINDRA KUMAR
B17|4653000|4653000|RAGHAV KANSAL
B17|4653000|0|RAGHAV KANSAL
B18|2480640|1600000|VINAY KUAMR TOMAR SHIVANI
B19|2480640|0|
B2|2350080|150000|SATYAM
B2|2350080|1975040|MUNNA
B20|2480640|0|
B21|2480640|0|
B22|2480640|0|
B23|2480640|0|
B24|2480640|0|
B25|2558976|1311000|MONU TOMAR
B26|2611200|500000|PRAVENDRA LILON
B27|2480640|2559000|VISHU KUMAR
B27|2480640|-78336|VISHU KUMAR
B28|2611200|0|
B29|2676480|10000|SANDEEP KUMAR
B3|2448000|2448000|NARENDRA
B3|2448000|0|NARENDRA
B30|2428416|1215000|VIKASH KUMAR
B31|2558976|2559000|ANKIT KAUSHIK
B32|4700000|4700000|RADHA
B33|2578560|2567533|VIVEK KUMAR
B33|2578560|11001|VIVEK KUMAR
B34|2454528|2454528|JAGPAL SINGH
B35|2415360|11000|YASHPAL SINGH
B36|611200|0|
B37|2611200|0|
B38|2611200|0|
B39|2611200|0|
B4|2448000|2448000|NARENDRA
B40|2545920|1555000|RAJKUMAR TAYAL
B41|2441472|2441400|SWATI TYAL W/F RAJKUMAR TYAL
B42|2350080|2350000|KOMAL YADAV
B43|2454528|2454500|YASHVEER SINGH
B44|5800000|5000|
B45|2350080|2350100|SHIVI
B46|2480640|2480600|ANIL KUMAR
B47|4465000|4465000|SHAILENDRA KUMAR
B48|2598144|2598100|SUMIT CHOUDHARY
B49|2611200|0|
B5|2480640|0|SURENDRA SINGH
B50|2611200|0|
B51|2611200|0|
B52|2611200|0|
B53|2611200|0|
B54|2611200|0|
B55|2611200|0|
B56|2611200|2611200|SHOKINDRA FARMER
B57|2611200|2611200|SHOKINDRA FARMER
B58|2611200|0|
B59|2480640|2480640|PRAVENDRA LILON
B6|2480640|0|SONIKA
B60|2480640|2480640|
B61|2350080|2350100|DEEPAK KUMAR
B62|4625035|4625000|RENU BALA
B7|2480640|0|
B8|2480640|0|
B9|2415360|2415000|KAMLESH
C1|3345770|2210000|PARDEEP KADIYAN
C10|1128000|355100|SUMIT
C11|1281740|0|
C12|1289160|0|
C13|1364220|0|
C14|1439100|0|
C15|1514520|0|
C16|1634475|1634475|REENA
C17|1735688|1735500|PRAMOD KUMARI
C18|3644640|0|
C19|4485900|0|
C2|1495980|1495995|ROOPAKSHI THAKUR
C20|2499300|0|
C21|2597220|0|
C22|2694780|0|
C23|2792520|0|
C24|2890080|0|
C25|2988000|0|
C26|3085920|0|
C27|3183840|0|
C28|3281940|0|
C29|6215580|0|
C3|1471047|715000|SAVITA MALIK
C30|2039220|0|
C31|1435640|456100|MANOJ MALIK
C32|1329856|1329856|MANOJ MALIK
C33|1329856|1329856|SHIVI TYAL
C34|1360080|795000|HARIOM SHARMA
C35|1397860|1397800|KAPIL TOMAR
C36|1344968|601001|SONU KUMAR
C37|1344968|400000|ROHIT KUMAR
C38|1322300|1322000|KAVITA
C39|1352524|1352500|RAVITA CHAUDHARY
C4|1495980|971000|NEELU
C40|1360080|1020000|CHARAN SINGH
C41|1360080|1095000|RAJ SINGH
C42|3315000|3315000|ASHISH KUMAR
C5|1495980|1495950|MANOJ KUMAR
C6|1462736|1016000|RANBIR SINGH
C7|1562468|61000|ANUJ SHARMA
C8|1462736|528500|VIKASH KUMAR
C9|1574312|1575000|SIKHA
S1|3460000|3460000|ANUP SINGH
S10|2300000|0|
S11|2300000|0|
S12|2300000|0|
S13|2300000|0|
S14|2300000|0|
S15|2300000|0|
S16|1950000|1900000|FULVA
S17|2700000|0|
S18|3300000|0|
S19|2300000|0|
S2|1800000|1800000|ANUP SINGH
S20|2300000|0|
S21|2300000|0|
S22|2300000|0|
S23|2300000|0|
S24|2300000|0|
S25|2300000|0|
S26|2300000|0|
S27|2300000|0|
S28|2300000|0|
S29|2300000|0|
S3|1800000|21000|NEERAJ CHAUDHARY
S30|2300000|0|
S31|2300000|0|
S32|2300000|0|
S33|2300000|0|
S34|2300000|0|
S4|1800000|1800000|OMPAL SINGH
S5|2300000|0|
S6|2300000|0|
S7|2300000|0|
S8|2300000|0|
S9|2300000|0|`;

// Normalise plot key: "A01" -> "A1", "B02" -> "B2", etc.
function normKey(raw) {
  if (!raw) return '';
  const s = String(raw).trim().toUpperCase();
  return s.replace(/^([A-Z]+)0*(\d+)$/, '$1$2');
}

// ── Build DB map ─────────────────────────────────────────────────────────────
// key -> { sale_price (max), total_received (sum), rawKeys[], buyers[] }
const dbMap = {};
for (const line of DB_RAW.trim().split('\n')) {
  const parts = line.split('|');
  const rawKey = parts[0].trim();
  const key = normKey(rawKey);
  const salePrice = Number(parts[1]) || 0;
  const received = Number(parts[2]) || 0;
  const buyer = (parts[3] || '').trim();

  if (!dbMap[key]) {
    dbMap[key] = { sale_price: salePrice, total_received: 0, buyers: [], rawKeys: [], rows: 0 };
  }
  dbMap[key].total_received += received;
  dbMap[key].rows += 1;
  dbMap[key].rawKeys.push(rawKey);
  if (salePrice > dbMap[key].sale_price) dbMap[key].sale_price = salePrice;
  if (buyer) dbMap[key].buyers.push(buyer);
}

// ── Parse Excel ──────────────────────────────────────────────────────────────
const workbook = xlsx.readFile('two.xlsx');
const sheet = workbook.Sheets['RIVER'];
if (!sheet) {
  console.error('Sheet "RIVER" not found. Available sheets:', workbook.SheetNames);
  process.exit(1);
}
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

// Column indices
const COL_PLOT       = 0;
const COL_BLOCK      = 1;
const COL_PARTY      = 2;
const COL_SALE_VALUE = 7;
const COL_CASH_BAL   = 15;  // CASH BALANCE — non-null on summary row
const COL_TOTAL_REC  = 18;  // TOTAL RECEIVED (authoritative)

// Build excelMap by scanning plot-by-plot.
// A "plot header" row: COL_BLOCK non-null AND COL_SALE_VALUE non-null (and not the column header row).
// A "summary row" (carries final totals): COL_CASH_BAL non-null.
//   - For single-row plots, the header IS the summary (col15 and col18 both on header row).
//   - For multi-row plots, the summary row comes after all payment rows.
//   - For resale plots, there are TWO header rows for the same plot key; each has its own summary.
//     We take the LAST summary row's col18 as the final state. (But since DB also sums across
//     entries, we should use the last summary's col18 which represents current total.)
// Grand total row at sheet end has no plot context — we simply stop after all valid plots.

const excelMap = {};  // normKey -> { sale_price, total_received, party_name, raw_plot }

let currentPlot = null;
let currentSalePrice = 0;
let currentParty = '';
let currentRawPlot = '';

// We also need to handle resale: same plot appears twice. The LAST summary row's col18
// is the current total received (covers both buyers cumulatively).
// Since DB sums both entries, we want the Excel final total too.

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;

  const plotCell   = row[COL_PLOT];
  const blockCell  = row[COL_BLOCK];
  const saleCell   = row[COL_SALE_VALUE];
  const cashBalCell= row[COL_CASH_BAL];
  const totalRec   = row[COL_TOTAL_REC];

  // Skip column header row
  if (plotCell === 'PLOT NO.') continue;

  // Detect plot header: BLOCK non-null AND SALE VALUE non-null
  const isPlotHeader = (blockCell !== null && blockCell !== '') &&
                       (saleCell !== null && saleCell !== '');

  // Detect summary row: CASH BALANCE col non-null
  const isSummary = (cashBalCell !== null && cashBalCell !== '');

  if (isPlotHeader) {
    const rawPlot = String(plotCell).trim();
    const key = normKey(rawPlot);
    currentPlot = key;
    currentSalePrice = Number(saleCell) || 0;
    currentParty = row[COL_PARTY] ? String(row[COL_PARTY]).trim() : '';
    currentRawPlot = rawPlot;
  }

  // A row can be BOTH a plot header AND a summary (single-row plot entries like S5-S34)
  if (isSummary && currentPlot) {
    const key = currentPlot;
    const rec = Number(totalRec) || 0;

    if (!excelMap[key]) {
      excelMap[key] = {
        sale_price: currentSalePrice,
        total_received: rec,
        party_name: currentParty,
        raw_plot: currentRawPlot
      };
    } else {
      // Resale or second summary: update to latest values
      if (currentSalePrice > excelMap[key].sale_price) {
        excelMap[key].sale_price = currentSalePrice;
      }
      // For resale plots, the second summary's col18 is the cumulative total
      // (it includes the first buyer's payments too). So we REPLACE (not add):
      excelMap[key].total_received = rec;
      if (currentParty) excelMap[key].party_name = currentParty;
    }
  }
}

// ── Compare ───────────────────────────────────────────────────────────────────
const excelKeys = new Set(Object.keys(excelMap));
const dbKeys    = new Set(Object.keys(dbMap));

console.log('══════════════════════════════════════════════════════');
console.log('  OM ASSOCIATES — PLOT DATA COMPARISON  (Excel vs DB)');
console.log('══════════════════════════════════════════════════════\n');
console.log(`Excel plots: ${excelKeys.size}   |   DB plots (unique after normalisation): ${dbKeys.size}\n`);

// ─── CHECK 1: A1/A01 naming ──────────────────────────────────────────────────
console.log('━━━ CHECK 1: A1/A01 NAMING ISSUE ━━━');
const a1Ex = excelMap['A1'];
const a1DB = dbMap['A1'];
if (a1Ex && a1DB) {
  const diff = Math.abs(a1Ex.total_received - a1DB.total_received);
  console.log(`  A1 present in both after normalisation (DB stored as "A01").`);
  console.log(`  Excel: sale=${a1Ex.sale_price}  received=${a1Ex.total_received}`);
  console.log(`  DB   : sale=${a1DB.sale_price}  received=${a1DB.total_received}`);
  console.log(`  => Diff=${diff}  ${diff <= 500 ? '✓ AMOUNTS MATCH (within 500)' : '✗ MISMATCH'}\n`);
} else {
  console.log(`  A1 in Excel: ${!!a1Ex}  |  A1 in DB: ${!!a1DB}\n`);
}

// ─── CHECK 2: Plots in Excel but missing from DB ──────────────────────────────
console.log('━━━ CHECK 2: PLOTS IN EXCEL BUT MISSING FROM DB ━━━');
const missingInDB = [...excelKeys].filter(k => !dbKeys.has(k)).sort();
if (missingInDB.length === 0) {
  console.log('  None.\n');
} else {
  for (const k of missingInDB) {
    const e = excelMap[k];
    console.log(`  ${k.padEnd(8)} raw="${e.raw_plot}"  party="${e.party_name}"  sale=${e.sale_price}  received=${e.total_received}`);
  }
  console.log();
}

// ─── CHECK 3: Plots in DB but missing from Excel ──────────────────────────────
console.log('━━━ CHECK 3: PLOTS IN DB BUT MISSING FROM EXCEL ━━━');
const missingInExcel = [...dbKeys].filter(k => !excelKeys.has(k)).sort();
if (missingInExcel.length === 0) {
  console.log('  None.\n');
} else {
  for (const k of missingInExcel) {
    const d = dbMap[k];
    console.log(`  ${k.padEnd(8)} db_sale=${d.sale_price}  db_received=${d.total_received}  buyers=[${[...new Set(d.buyers)].join(', ')}]`);
  }
  console.log();
}

// ─── CHECK 4: Amount mismatch > 500 ──────────────────────────────────────────
console.log('━━━ CHECK 4: AMOUNT MISMATCH > 500 (Excel TOTAL RECEIVED vs DB total_received) ━━━');
const amtMismatch = [];
for (const k of [...excelKeys].sort()) {
  if (!dbKeys.has(k)) continue;
  const e = excelMap[k];
  const d = dbMap[k];
  const diff = e.total_received - d.total_received;
  if (Math.abs(diff) > 500) {
    amtMismatch.push({ key: k, exRec: e.total_received, dbRec: d.total_received, diff });
  }
}
if (amtMismatch.length === 0) {
  console.log('  None.\n');
} else {
  const h = (s, w) => String(s).padStart(w);
  console.log(`  ${'Plot'.padEnd(8)} ${'Excel Recv'.padStart(12)} ${'DB Recv'.padStart(12)} ${'Diff'.padStart(12)}`);
  console.log('  ' + '─'.repeat(48));
  for (const m of amtMismatch) {
    console.log(`  ${m.key.padEnd(8)} ${h(m.exRec,12)} ${h(m.dbRec,12)} ${h(m.diff,12)}`);
  }
  console.log();
}

// ─── CHECK 5: Sale price mismatch > 10 ───────────────────────────────────────
console.log('━━━ CHECK 5: SALE PRICE MISMATCH > 10 ━━━');
const saleMismatch = [];
for (const k of [...excelKeys].sort()) {
  if (!dbKeys.has(k)) continue;
  const e = excelMap[k];
  const d = dbMap[k];
  const diff = Math.round(e.sale_price) - d.sale_price;
  if (Math.abs(diff) > 10) {
    saleMismatch.push({ key: k, exSale: e.sale_price, dbSale: d.sale_price, diff });
  }
}
if (saleMismatch.length === 0) {
  console.log('  None.\n');
} else {
  const h = (s, w) => String(Math.round(s)).padStart(w);
  console.log(`  ${'Plot'.padEnd(8)} ${'Excel Sale'.padStart(12)} ${'DB Sale'.padStart(12)} ${'Diff'.padStart(12)}`);
  console.log('  ' + '─'.repeat(48));
  for (const m of saleMismatch) {
    console.log(`  ${m.key.padEnd(8)} ${h(m.exSale,12)} ${String(m.dbSale).padStart(12)} ${String(m.diff).padStart(12)}`);
  }
  console.log();
}

// ─── CHECK 6: Other anomalies ─────────────────────────────────────────────────
console.log('━━━ CHECK 6: OTHER ANOMALIES ━━━');
let anyAnomaly = false;

// 6a. DB overpayment (total_received > sale_price + 500)
const dbOverpaid = [];
for (const k of Object.keys(dbMap).sort()) {
  const d = dbMap[k];
  if (d.sale_price > 0 && d.total_received > d.sale_price + 500) {
    dbOverpaid.push({ key: k, sale: d.sale_price, received: d.total_received, excess: d.total_received - d.sale_price });
  }
}
if (dbOverpaid.length > 0) {
  anyAnomaly = true;
  console.log('  DB plots where total_received > sale_price (overpayment):');
  for (const m of dbOverpaid) {
    console.log(`    ${m.key.padEnd(8)} sale=${m.sale}  received=${m.received}  EXCESS=${m.excess}`);
  }
  console.log();
}

// 6b. Excel overpayment
const exOverpaid = [];
for (const k of Object.keys(excelMap).sort()) {
  const e = excelMap[k];
  if (e.sale_price > 0 && e.total_received > e.sale_price + 500) {
    exOverpaid.push({ key: k, sale: e.sale_price, received: e.total_received, excess: e.total_received - e.sale_price });
  }
}
if (exOverpaid.length > 0) {
  anyAnomaly = true;
  console.log('  Excel plots where total_received > sale_price (overpayment):');
  for (const m of exOverpaid) {
    console.log(`    ${m.key.padEnd(8)} sale=${Math.round(m.sale)}  received=${m.received}  EXCESS=${Math.round(m.excess)}`);
  }
  console.log();
}

// 6c. DB plots with negative net received
const dbNeg = [];
for (const k of Object.keys(dbMap).sort()) {
  const d = dbMap[k];
  if (d.total_received < 0) {
    dbNeg.push({ key: k, received: d.total_received });
  }
}
if (dbNeg.length > 0) {
  anyAnomaly = true;
  console.log('  DB plots with negative net received (possible reversal/error):');
  for (const m of dbNeg) {
    console.log(`    ${m.key}: total_received=${m.received}`);
  }
  console.log();
}

// 6d. B36 suspicious sale price
if (dbMap['B36']) {
  anyAnomaly = true;
  console.log(`  B36: DB sale_price=${dbMap['B36'].sale_price} — likely data entry error (missing leading "2", should be 2611200?)`);
  if (excelMap['B36']) console.log(`    Excel sale_price=${Math.round(excelMap['B36'].sale_price)}`);
  console.log();
}

// 6e. S3: DB shows only 21000 received but Excel shows large value
if (excelMap['S3'] && dbMap['S3']) {
  const e = excelMap['S3'], d = dbMap['S3'];
  if (Math.abs(e.total_received - d.total_received) > 500) {
    anyAnomaly = true;
    console.log(`  S3: Excel received=${e.total_received}  DB received=${d.total_received}  (diff=${e.total_received - d.total_received})`);
    console.log(`    DB may be missing payments — only 21000 recorded vs Excel shows ${e.total_received}`);
    console.log();
  }
}

// 6f. S4: DB shows 1800000 but Excel shows tiny value
if (excelMap['S4'] && dbMap['S4']) {
  const e = excelMap['S4'], d = dbMap['S4'];
  if (Math.abs(e.total_received - d.total_received) > 500) {
    anyAnomaly = true;
    console.log(`  S4: Excel received=${e.total_received}  DB received=${d.total_received}  (diff=${e.total_received - d.total_received})`);
    console.log();
  }
}

// 6g. Plots where Excel shows payments but DB shows 0
const exHasDBZero = [];
for (const k of [...excelKeys].sort()) {
  if (!dbKeys.has(k)) continue;
  const e = excelMap[k];
  const d = dbMap[k];
  if (d.total_received === 0 && e.total_received > 500) {
    exHasDBZero.push({ key: k, exRec: e.total_received, dbRec: d.total_received });
  }
}
if (exHasDBZero.length > 0) {
  anyAnomaly = true;
  console.log('  Plots where Excel shows payments received but DB shows 0:');
  for (const m of exHasDBZero) {
    console.log(`    ${m.key.padEnd(8)} Excel=${m.exRec}  DB=${m.dbRec}`);
  }
  console.log();
}

if (!anyAnomaly) console.log('  None beyond items already reported above.\n');

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('━━━ SUMMARY ━━━');
console.log(`  Excel plots found             : ${excelKeys.size}`);
console.log(`  DB plots (unique normalised)  : ${dbKeys.size}`);
console.log(`  In Excel, missing from DB     : ${missingInDB.length}`);
console.log(`  In DB, missing from Excel     : ${missingInExcel.length}`);
console.log(`  Amount mismatches > 500       : ${amtMismatch.length}`);
console.log(`  Sale price mismatches > 10    : ${saleMismatch.length}`);
