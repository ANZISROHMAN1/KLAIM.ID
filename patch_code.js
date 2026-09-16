const fs = require('fs');

let code = fs.readFileSync('Code.gs', 'utf8');

// Add parseAmountSafe at the bottom
code += `\n
function parseAmountSafe(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    var str = val.toString().trim();
    if (str === '-' || str === '') return 0;
    str = str.replace(/rp/gi, '').replace(/\\s/g, '');
    var isNegative = false;
    if (str.startsWith('-') || str.startsWith('(')) {
       isNegative = true;
       str = str.replace(/[-\\(\\)]/g, '');
    }
    var lastComma = str.lastIndexOf(',');
    var lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
        str = str.replace(/\\./g, '').replace(/,/g, '.');
    } else if (lastDot > lastComma) {
        str = str.replace(/,/g, '');
    } else {
        str = str.replace(/[.,]/g, '');
    }
    var amount = parseFloat(str) || 0;
    return isNegative ? -amount : amount;
}
`;

// Replace in insights
code = code.replace('var keluar = parseFloat(jagoData[k][5]) || 0;', 'var keluar = parseAmountSafe(jagoData[k][5]);');
code = code.replace('var amount = parseFloat(jagoData[k][4]) || 0;', 'var amount = parseAmountSafe(jagoData[k][4]);');

// Replace in updateNeracaKeuangan
code = code.replace('var masuk = parseFloat(data[i][4]) || 0;', 'var masuk = parseAmountSafe(data[i][4]);');
code = code.replace('var keluar = parseFloat(data[i][5]) || 0;', 'var keluar = parseAmountSafe(data[i][5]);');
code = code.replace('isNaN(parseFloat(colG))', 'isNaN(parseAmountSafe(colG))');
code = code.replace('balance = parseFloat(data[i][5]) || 0;', 'balance = parseAmountSafe(data[i][5]);');
code = code.replace('balance = parseFloat(data[i][6]) || 0;', 'balance = parseAmountSafe(data[i][6]);');
code = code.replace('rawAmount = parseFloat(data[i][4]) || 0;', 'rawAmount = parseAmountSafe(data[i][4]);');
code = code.replace('balance = parseFloat(data[i][5]) || 0;', 'balance = parseAmountSafe(data[i][5]);');

fs.writeFileSync('Code.gs', code);
