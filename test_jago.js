const result = require('/tmp/api_response.json');

function parseAmountSafeClient(val) {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    let str = val.toString().replace(/[^0-9.-]+/g, "");
    let floatVal = parseFloat(str);
    return isNaN(floatVal) ? 0 : floatVal;
}

function generateInsightsFromJago(data) {
    console.log("Generating insights... data length:", data.length);
    let parsedData = [];
    let isSplitCols = false;

    if (data.length > 0) {
        let headerRow = data[0];
        isSplitCols = (headerRow.length >= 8) || 
                      (headerRow[4] && headerRow[4].toString().toLowerCase().includes('masuk')) ||
                      (headerRow[5] && headerRow[5].toString().toLowerCase().includes('keluar'));
    }
    console.log("isSplitCols:", isSplitCols);

    for (let i = 1; i < data.length; i++) {
        let dateVal = data[i][0];
        if (!dateVal || dateVal === "") continue;

        let rowDate = new Date(dateVal);
        if (isNaN(rowDate.getTime())) {
            let strMatch = dateVal.toString().match(/(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})/);
            if (strMatch) {
                let d = new Date(strMatch[1].replace('Mei', 'May').replace('Agu', 'Aug').replace('Okt', 'Oct').replace('Des', 'Dec'));
                if (!isNaN(d.getTime())) rowDate = d;
            }
        }
        if (isNaN(rowDate.getTime())) continue;

        let monthYear = rowDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

        let masuk = 0, keluar = 0;
        let unit = 'Tanpa Unit';
        let categoryRaw = '';

        if (isSplitCols) {
            masuk = parseAmountSafeClient(data[i][4]);
            keluar = parseAmountSafeClient(data[i][5]);
            if (masuk < 0) {
                keluar = Math.abs(masuk);
                masuk = 0;
            }
            unit = data[i][7] || 'Tanpa Unit';
            categoryRaw = (data[i][2] || '').toString().toLowerCase();
        } else {
            let amount = parseAmountSafeClient(data[i][4]);
            if (amount > 0) masuk = amount;
            else if (amount < 0) keluar = Math.abs(amount);
            unit = data[i][6] || 'Tanpa Unit';
            categoryRaw = (data[i][2] || '').toString().toLowerCase();
        }
        parsedData.push({ date: rowDate, monthYear: monthYear, masuk: masuk, keluar: keluar, unit: unit });
    }
    console.log("Parsed Data Length:", parsedData.length);
    console.log("generateInsightsFromJago SUCCESS");
}

try {
    generateInsightsFromJago(result.debug_jago.data);
} catch(e) {
    console.error("ERROR in generateInsightsFromJago:", e);
}
