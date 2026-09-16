const result = require('/tmp/api_response.json');

function parseAmountSafeClient(val) {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    let str = val.toString().replace(/[^0-9.-]+/g, "");
    let floatVal = parseFloat(str);
    return isNaN(floatVal) ? 0 : floatVal;
}

function renderTrendChart(data) {
    console.log("Rendering trend chart...");
    if (!data || data.length === 0) return;

    let isSplitCols = false;
    let headerRow = data[0];
    isSplitCols = (headerRow.length >= 8) || 
                  (headerRow[4] && headerRow[4].toString().toLowerCase().includes('masuk')) ||
                  (headerRow[5] && headerRow[5].toString().toLowerCase().includes('keluar'));

    let monthlyData = {};

    for (let i = 1; i < data.length; i++) {
        let dateVal = data[i][0];
        if (!dateVal) continue;
        let rowDate = new Date(dateVal);
        if (isNaN(rowDate.getTime())) {
            let strMatch = dateVal.toString().match(/(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})/);
            if (strMatch) {
                let d = new Date(strMatch[1].replace('Mei', 'May').replace('Agu', 'Aug').replace('Okt', 'Oct').replace('Des', 'Dec'));
                if (!isNaN(d.getTime())) rowDate = d;
            }
        }
        if (isNaN(rowDate.getTime())) continue;

        let monthYear = rowDate.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
        
        if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = { timestamp: rowDate.getTime(), masuk: 0, keluar: 0 };
        }

        if (isSplitCols) {
            let masuk = parseAmountSafeClient(data[i][4]);
            let keluar = parseAmountSafeClient(data[i][5]);
            if (masuk < 0) {
                keluar = Math.abs(masuk);
                masuk = 0;
            }
            monthlyData[monthYear].masuk += masuk;
            monthlyData[monthYear].keluar += keluar;
        } else {
            let amount = parseAmountSafeClient(data[i][4]);
            if (amount > 0) monthlyData[monthYear].masuk += amount;
            else if (amount < 0) monthlyData[monthYear].keluar += Math.abs(amount);
        }
    }
    console.log("Trend chart success. Monthly data size:", Object.keys(monthlyData).length);
}

try {
    renderTrendChart(result.debug_jago.data);
} catch(e) {
    console.error("ERROR in renderTrendChart:", e);
}
