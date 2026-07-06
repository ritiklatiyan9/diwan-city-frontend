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
  // strip leading zeros after the letter prefix
  return s.replace(/^([A-Z]+)0*(\d+)$/, '$1$2');
}

// Build DB map: key -> { sale_price (max), total_received (sum), buyers[], rows }
const dbMap = {};
for (const line of DB_RAW.trim().split('\n')) {
  const parts = line.split('|');
  const rawKey = parts[0].trim();
  const key = normKey(rawKey);
  const salePrice = Number(parts[1]) || 0;
  const received = Number(parts[2]) || 0;
  const buyer = (parts[3] || '').trim();

  if (!dbMap[key]) {
    dbMap[key] = { sale_price: salePrice, total_received: 0, buyers: [], rows: 0, rawKeys: [] };
  }
  dbMap[key].total_received += received;
  dbMap[key].rows += 1;
  dbMap[key].rawKeys.push(rawKey);
  if (salePrice > dbMap[key].sale_price) dbMap[key].sale_price = salePrice;
  if (buyer) dbMap[key].buyers.push(buyer);
}

// ── 2. Parse Excel ──────────────────────────────────────────────────────────
const workbook = xlsx.readFile('two.xlsx');
const sheet = workbook.Sheets['RIVER'];
if (!sheet) {
  console.error('Sheet "RIVER" not found. Available sheets:', workbook.SheetNames);
  process.exit(1);
}

const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

// Column indices (0-based)
// 0: PLOT NO | 1: BLOCK | 2: PARTY NAME | 3: PLOT SIZE YARD | 4: RATE/YARD
// 5: PLOT SIZE MTR | 6: CIRCLE RATE | 7: TOTAL SALE VALUE | 8: REGISTRY VALUE
// 9: CASH TO BE REC | 10: DATE | 11: MODE | 12: BANK RECEIVED | 13: CASH RECEIVED
// 14: TOTAL | 15: CASH BALANCE | 16: BANK BALANCE | 17: TOTAL BALANCE
// 18: TOTAL RECEIVED | 19: BOOKING BY | 20: SHORTCUT
const COL_PLOT = 0;
const COL_BLOCK = 1;
const COL_PARTY = 2;
const COL_SALE_VALUE = 7;
const COL_TOTAL_PAID = 14;   // payment row amount
const COL_TOTAL_RECEIVED = 18; // cumulative total on header row

// Build excel map: key -> { sale_price, total_received, party_name, raw_plot }
const excelMap = {};
let currentPlot = null;

// Print first few rows for debugging
console.log('=== FIRST 10 ROWS (raw) ===');
for (let i = 0; i < Math.min(10, rows.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(rows[i]));
}
console.log('');

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;

  const plotCell = row[COL_PLOT];
  const saleCell = row[COL_SALE_VALUE];
  const totalPaidCell = row[COL_TOTAL_PAID];
  const totalReceivedCell = row[COL_TOTAL_RECEIVED];

  // Detect header / plot row: has a value in col 0 AND col 7 (total sale value)
  const hasPlotNo = plotCell !== null && plotCell !== '' && plotCell !== undefined;
  const hasSaleValue = saleCell !== null && saleCell !== '' && saleCell !== undefined;

  if (hasPlotNo && hasSaleValue) {
    // This is a plot header row
    const rawPlot = String(plotCell).trim();
    const key = normKey(rawPlot);
    if (key) {
      currentPlot = key;
      if (!excelMap[key]) {
        excelMap[key] = {
          sale_price: Number(saleCell) || 0,
          total_received: 0,
          party_name: (row[COL_PARTY] || '').toString().trim(),
          raw_plot: rawPlot,
          payment_rows: 0
        };
      } else {
        // resale — update sale price if larger, keep tracking payments
        const sp = Number(saleCell) || 0;
        if (sp > excelMap[key].sale_price) excelMap[key].sale_price = sp;
        if (row[COL_PARTY]) excelMap[key].party_name = row[COL_PARTY].toString().trim();
      }
    }
  } else if (currentPlot && totalPaidCell !== null && totalPaidCell !== '' && totalPaidCell !== undefined) {
    // Payment row
    const amt = Number(totalPaidCell) || 0;
    if (amt !== 0) {
      excelMap[currentPlot].total_received += amt;
      excelMap[currentPlot].payment_rows += 1;
    }
  }
}

// ── 3. Compare ──────────────────────────────────────────────────────────────
const excelKeys = new Set(Object.keys(excelMap));
const dbKeys = new Set(Object.keys(dbMap));

console.log(`Excel plots found: ${excelKeys.size}`);
console.log(`DB plots found (unique normalised): ${dbKeys.size}`);
console.log('');

// ── 3a. A1/A01 naming check ─────────────────────────────────────────────────
console.log('=== CHECK 1: A1/A01 NAMING ===');
// A01 in DB normalises to A1; A1 in Excel normalises to A1 — both become same key
const a1Excel = excelMap['A1'];
const a1DB = dbMap['A1'];
if (a1Excel && a1DB) {
  console.log(`A1 present in BOTH after normalisation.`);
  console.log(`  Excel sale_price: ${a1Excel.sale_price}  |  DB sale_price: ${a1DB.sale_price}`);
  console.log(`  Excel total_rec : ${a1Excel.total_received}  |  DB total_rec : ${a1DB.total_received}`);
  const diff = Math.abs(a1Excel.total_received - a1DB.total_received);
  console.log(`  Amount diff: ${diff}  => ${diff <= 500 ? 'MATCH (within 500)' : 'MISMATCH'}`);
} else {
  console.log(`  A1 in Excel: ${!!a1Excel}  |  A1 in DB: ${!!a1DB}`);
}
console.log('');

// ── 3b. Plots in Excel but missing from DB ──────────────────────────────────
console.log('=== CHECK 2: PLOTS IN EXCEL BUT MISSING FROM DB ===');
const missingInDB = [...excelKeys].filter(k => !dbKeys.has(k));
if (missingInDB.length === 0) {
  console.log('  None.');
} else {
  for (const k of missingInDB.sort()) {
    const e = excelMap[k];
    console.log(`  ${k} (raw: ${e.raw_plot})  party: ${e.party_name}  sale: ${e.sale_price}  received: ${e.total_received}`);
  }
}
console.log('');

// ── 3c. Plots in DB but missing from Excel ──────────────────────────────────
console.log('=== CHECK 3: PLOTS IN DB BUT MISSING FROM EXCEL ===');
const missingInExcel = [...dbKeys].filter(k => !excelKeys.has(k));
if (missingInExcel.length === 0) {
  console.log('  None.');
} else {
  for (const k of missingInExcel.sort()) {
    const d = dbMap[k];
    console.log(`  ${k} (raw DB keys: ${[...new Set(d.rawKeys)].join(',')})  sale: ${d.sale_price}  db_received: ${d.total_received}`);
  }
}
console.log('');

// ── 3d. Amount mismatch > 500 ───────────────────────────────────────────────
console.log('=== CHECK 4: AMOUNT MISMATCH > 500 (Excel total_received vs DB total_received) ===');
const amountMismatches = [];
for (const k of [...excelKeys].sort()) {
  if (!dbKeys.has(k)) continue;
  const e = excelMap[k];
  const d = dbMap[k];
  const diff = e.total_received - d.total_received;
  if (Math.abs(diff) > 500) {
    amountMismatches.push({ key: k, excel_rec: e.total_received, db_rec: d.total_received, diff });
  }
}
if (amountMismatches.length === 0) {
  console.log('  None.');
} else {
  console.log(`  ${'Plot'.padEnd(8)} ${'Excel Rec'.padStart(12)} ${'DB Rec'.padStart(12)} ${'Diff'.padStart(12)}`);
  console.log('  ' + '-'.repeat(48));
  for (const m of amountMismatches) {
    console.log(`  ${m.key.padEnd(8)} ${String(m.excel_rec).padStart(12)} ${String(m.db_rec).padStart(12)} ${String(m.diff).padStart(12)}`);
  }
}
console.log('');

// ── 3e. Sale price mismatch > 10 ────────────────────────────────────────────
console.log('=== CHECK 5: SALE PRICE MISMATCH > 10 ===');
const saleMismatches = [];
for (const k of [...excelKeys].sort()) {
  if (!dbKeys.has(k)) continue;
  const e = excelMap[k];
  const d = dbMap[k];
  const diff = e.sale_price - d.sale_price;
  if (Math.abs(diff) > 10) {
    saleMismatches.push({ key: k, excel_sale: e.sale_price, db_sale: d.sale_price, diff });
  }
}
if (saleMismatches.length === 0) {
  console.log('  None.');
} else {
  console.log(`  ${'Plot'.padEnd(8)} ${'Excel Sale'.padStart(12)} ${'DB Sale'.padStart(12)} ${'Diff'.padStart(12)}`);
  console.log('  ' + '-'.repeat(48));
  for (const m of saleMismatches) {
    console.log(`  ${m.key.padEnd(8)} ${String(m.excel_sale).padStart(12)} ${String(m.db_sale).padStart(12)} ${String(m.diff).padStart(12)}`);
  }
}
console.log('');

// ── 3f. Other anomalies ──────────────────────────────────────────────────────
console.log('=== CHECK 6: OTHER ANOMALIES ===');

// Plots where Excel has 0 payments but DB has received > 0
const excelZeroDBHas = [];
for (const k of [...excelKeys].sort()) {
  if (!dbKeys.has(k)) continue;
  const e = excelMap[k];
  const d = dbMap[k];
  if (e.total_received === 0 && d.total_received > 0) {
    excelZeroDBHas.push({ key: k, excel_rec: e.total_received, db_rec: d.total_received });
  }
}
if (excelZeroDBHas.length > 0) {
  console.log('  Plots where Excel shows 0 received but DB shows > 0:');
  for (const m of excelZeroDBHas) {
    console.log(`    ${m.key}: Excel=0  DB=${m.db_rec}`);
  }
} else {
  console.log('  No plots where Excel=0 but DB>0.');
}

// Plots where DB received > DB sale_price (overpayment)
const overpaid = [];
for (const k of Object.keys(dbMap).sort()) {
  const d = dbMap[k];
  if (d.total_received > d.sale_price + 500) {
    overpaid.push({ key: k, sale: d.sale_price, received: d.total_received, excess: d.total_received - d.sale_price });
  }
}
if (overpaid.length > 0) {
  console.log('\n  DB plots where total_received > sale_price (overpayment):');
  for (const m of overpaid) {
    console.log(`    ${m.key}: sale=${m.sale}  received=${m.received}  excess=${m.excess}`);
  }
}

// Plots where Excel received > Excel sale_price (overpayment)
const excelOverpaid = [];
for (const k of Object.keys(excelMap).sort()) {
  const e = excelMap[k];
  if (e.sale_price > 0 && e.total_received > e.sale_price + 500) {
    excelOverpaid.push({ key: k, sale: e.sale_price, received: e.total_received, excess: e.total_received - e.sale_price });
  }
}
if (excelOverpaid.length > 0) {
  console.log('\n  Excel plots where total_received > sale_price (overpayment):');
  for (const m of excelOverpaid) {
    console.log(`    ${m.key}: sale=${m.sale}  received=${m.received}  excess=${m.excess}`);
  }
}

// Negative DB received (suspicious)
const negativeDB = [];
for (const k of Object.keys(dbMap).sort()) {
  const d = dbMap[k];
  if (d.total_received < 0) {
    negativeDB.push({ key: k, received: d.total_received });
  }
}
if (negativeDB.length > 0) {
  console.log('\n  DB plots with negative total_received (credit/reversal):');
  for (const m of negativeDB) {
    console.log(`    ${m.key}: total_received=${m.received}`);
  }
}

// B36: suspicious sale price (611200 vs expected ~2611200)
if (dbMap['B36']) {
  console.log(`\n  B36 DB sale_price=${dbMap['B36'].sale_price} — possible data entry error (should be 2611200?)`);
}

console.log('');
console.log('=== SUMMARY ===');
console.log(`  Excel plots:               ${excelKeys.size}`);
console.log(`  DB plots (unique):         ${dbKeys.size}`);
console.log(`  In Excel, missing from DB: ${missingInDB.length}`);
console.log(`  In DB, missing from Excel: ${missingInExcel.length}`);
console.log(`  Amount mismatches >500:    ${amountMismatches.length}`);
console.log(`  Sale price mismatches >10: ${saleMismatches.length}`);
