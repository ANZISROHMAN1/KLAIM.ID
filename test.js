const jago = require('/tmp/jago_new.json').data;
const CUTOFF_DATE = new Date(2026, 8, 1);

function parseAmountSafe(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    var str = val.toString().trim();
    if (str === '-' || str === '') return 0;
    str = str.replace(/rp/gi, '').replace(/\s/g, '');
    var isNegative = false;
    if (str.startsWith('-') || str.startsWith('(')) {
       isNegative = true;
       str = str.replace(/[-\(\)]/g, '');
    }
    var lastComma = str.lastIndexOf(',');
    var lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
        str = str.replace(/\./g, '').replace(/,/g, '.');
    } else if (lastDot > lastComma) {
        str = str.replace(/,/g, '');
    } else {
        str = str.replace(/[.,]/g, '');
    }
    var amount = parseFloat(str) || 0;
    return isNegative ? -amount : amount;
}

var headerRow = jago[0] || [];
var isSplitCols = (headerRow.length >= 8) || 
                  (headerRow[4] && headerRow[4].toString().toLowerCase().includes('masuk')) ||
                  (headerRow[5] && headerRow[5].toString().toLowerCase().includes('keluar'));

var filteredData = [];
for (var i = 1; i < jago.length; i++) {
    var rawDate = jago[i][0];
    if (!rawDate) continue;
    var dt = new Date(rawDate.replace(' ', 'T'));
    if (isNaN(dt)) dt = new Date(rawDate.split('\n')[0]);
    if (dt < CUTOFF_DATE) continue;

    var unit = 'Tanpa Unit';
    var balance = 0;
    var rawAmount = 0;

    if (isSplitCols) {
        var masuk = parseAmountSafe(jago[i][4]);
        var keluar = parseAmountSafe(jago[i][5]);
        if (jago[i][2] && jago[i][2].toString().toLowerCase().includes('transfer fee')) {
            keluar = masuk;
            masuk = 0;
        }
        rawAmount = masuk > 0 ? masuk : (keluar > 0 ? -keluar : 0);
        
        var colG = jago[i][6];
        if (typeof colG === 'string' && isNaN(parseFloat(colG)) && colG.length > 1) {
            unit = colG;
            balance = parseAmountSafe(jago[i][5]);
        } else {
            balance = parseAmountSafe(jago[i][6]);
            unit = jago[i][7] || 'Tanpa Unit';
        }
    } else {
        rawAmount = parseAmountSafe(jago[i][4]);
        balance = parseAmountSafe(jago[i][5]);
        unit = jago[i][6] || 'Tanpa Unit';
    }
    
    // Add logic for manual rows if they don't have unit
    if (!unit || unit.toString().trim() === '') unit = 'Tanpa Unit';
    if (jago[i][6] === 'DISTRICT') {
        console.log('MANUAL ROW DETECTED:', {
           colG: colG,
           typeofColG: typeof colG,
           parseFloatColG: parseFloat(colG),
           isNaNColG: isNaN(parseFloat(colG)),
           colGLength: colG.length,
           unitAssigned: unit,
           balanceAssigned: balance
        });
    }

    filteredData.push({ rawAmount: rawAmount, balance: balance, unit: unit.toString().trim() });
}

console.log('Filtered Data Count:', filteredData.length);
var units = {};
var totalPemasukan = 0;
var totalPengeluaran = 0;

for (var i = 0; i < filteredData.length; i++) {
    var amount = filteredData[i].rawAmount;
    var unit = filteredData[i].unit;
    
    if (!units[unit]) units[unit] = { debit: 0, kredit: 0 };
    
    if (amount > 0) {
      units[unit].debit += amount;
      totalPemasukan += amount;
    } else if (amount < 0) {
      units[unit].kredit += Math.abs(amount);
      totalPengeluaran += Math.abs(amount);
    }
}
console.log('Units:', units);

var finalBalance = 0;
for (var k = 0; k < filteredData.length; k++) {
    if (filteredData[k].balance && filteredData[k].balance !== 0) {
        finalBalance = filteredData[k].balance;
    } else if (finalBalance !== 0) {
        finalBalance += filteredData[k].rawAmount;
    }
}
var saldoAwal = finalBalance - totalPemasukan + totalPengeluaran;
console.log('Final Balance:', finalBalance);
console.log('Saldo Awal:', saldoAwal);

