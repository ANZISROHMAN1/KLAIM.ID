// Node.js script to mock GAS and test updateNeracaKeuangan logic
const jagoData = require('/tmp/jago.json').data;

var CUTOFF_DATE = new Date(2026, 6, 30); // month is 0-indexed, so 6 is July

function parseDateSafe(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    var dStr = val.toString();
    var dateMatch = dStr.match(/(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})/);
    if (dateMatch) {
      var englishDateStr = dateMatch[1].replace('Mei', 'May').replace('Agu', 'Aug').replace('Okt', 'Oct').replace('Des', 'Dec');
      var d = new Date(englishDateStr);
      if (!isNaN(d.getTime())) return d;
    }
    var d2 = new Date(dStr);
    if (!isNaN(d2.getTime())) return d2;
    var d3 = new Date(dStr.replace(' ', 'T'));
    if (!isNaN(d3.getTime())) return d3;
    return null;
}

var data = jagoData;
var headerRow = data[0];
var isSplitCols = true;
var allValidData = [];
var monthsSet = {};

for (var i = 1; i < data.length; i++) {
    if (!data[i][0] || data[i][0] === "") continue;
    var rowDate = parseDateSafe(data[i][0]);
    if (rowDate && rowDate >= CUTOFF_DATE) {
      var rawAmount = 0;
      var balance = 0;
      var unit = 'Tanpa Unit';
      var details = (data[i][2] || "").toString();
      var notes = (data[i][3] || "").toString();
      
      var masuk = parseFloat(data[i][4]) || 0;
      var keluar = parseFloat(data[i][5]) || 0;
      if (masuk < 0) {
          keluar = Math.abs(masuk);
          masuk = 0;
      }
      rawAmount = masuk > 0 ? masuk : (keluar > 0 ? -keluar : 0);
      
      var colG = data[i][6];
      if (typeof colG === 'string' && isNaN(parseFloat(colG)) && colG.length > 1) {
          unit = colG;
          balance = parseFloat(data[i][5]) || 0;
      } else {
          balance = parseFloat(data[i][6]) || 0;
          unit = data[i][7] || 'Tanpa Unit';
      }
      
      allValidData.push({
        date: rowDate,
        rawAmount: rawAmount,
        balance: balance,
        unit: unit,
        rowIdx: i
      });
      
      var monthStr = rowDate.toLocaleString('id-ID', { month: 'long' });
      var yearStr = rowDate.getFullYear();
      monthsSet[monthStr + ' ' + yearStr] = true;
    }
}

console.log("Months Set:", Object.keys(monthsSet));

var isDescending = false;
if (allValidData.length > 1) {
    if (allValidData[0].date.getTime() > allValidData[allValidData.length - 1].date.getTime()) {
        isDescending = true;
    }
}
allValidData.sort(function(a, b) {
    var timeDiff = a.date.getTime() - b.date.getTime();
    if (timeDiff !== 0) return timeDiff;
    if (isDescending) return b.rowIdx - a.rowIdx;
    return a.rowIdx - b.rowIdx;
});

var selectedFilter = "September 2026";
var filteredData = [];
var lastBalanceBeforeMTD = 0;
var hasFoundMTD = false;

for (var i = 0; i < allValidData.length; i++) {
    var item = allValidData[i];
    var monthStr = item.date.toLocaleString('id-ID', { month: 'long' });
    var yearStr = item.date.getFullYear();
    var monthYear = monthStr + ' ' + yearStr;
    
    // In GAS: Utilities.formatDate(..., "MMMM yyyy")
    // Let's just simulate the string match
    // 'September 2026'
    
    var isTargetMonth = (selectedFilter === "Semua Bulan" || monthYear === selectedFilter);
    if (isTargetMonth) {
        filteredData.push(item);
        hasFoundMTD = true;
    } else {
        if (!hasFoundMTD) {
            lastBalanceBeforeMTD = item.balance;
        }
    }
}

console.log("Filtered Data length:", filteredData.length);
if(filteredData.length > 0) {
    console.log("lastBalanceBeforeMTD:", lastBalanceBeforeMTD);
    var purePemasukan = 0;
    for(var i=0; i<filteredData.length; i++) {
        if(filteredData[i].rawAmount > 0) purePemasukan += filteredData[i].rawAmount;
    }
    console.log("Pure Pemasukan:", purePemasukan);
}
