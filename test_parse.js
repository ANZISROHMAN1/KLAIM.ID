const fs = require('fs');
const json = JSON.parse(fs.readFileSync('jago_data.json', 'utf8'));
const data = json.data;

var CUTOFF_DATE = new Date(2026, 6, 30); 
function parseDateSafe(val) {
    if (!val) return null;
    var dStr = val.toString();
    var dateMatch = dStr.match(/(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})/);
    if (dateMatch) {
      var englishDateStr = dateMatch[1].replace('Mei', 'May').replace('Agu', 'Aug').replace('Okt', 'Oct').replace('Des', 'Dec');
      var d = new Date(englishDateStr);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
}

var allValidData = [];
for (var i = 1; i < data.length; i++) {
    if (!data[i][0] || data[i][0] === "") continue;
    var rowDate = parseDateSafe(data[i][0]);
    if (rowDate && rowDate >= CUTOFF_DATE) {
      var masuk = parseFloat(data[i][4]) || 0;
      var keluar = parseFloat(data[i][5]) || 0;
      var rawAmount = masuk > 0 ? masuk : (keluar > 0 ? -keluar : 0);
      var balance = parseFloat(data[i][6]) || 0;
      var unit = data[i][7] || 'Tanpa Unit';
      allValidData.push({
        date: rowDate,
        rawAmount: rawAmount,
        balance: balance,
        unit: unit,
        rowIdx: i
      });
    }
}

var monthsData = {};
allValidData.forEach(d => {
    var key = d.date.getFullYear() + "-" + (d.date.getMonth()+1);
    if (!monthsData[key]) monthsData[key] = { masuk: 0, keluar: 0 };
    if (d.rawAmount > 0) monthsData[key].masuk += d.rawAmount;
    if (d.rawAmount < 0) monthsData[key].keluar += Math.abs(d.rawAmount);
});
console.log(monthsData);
