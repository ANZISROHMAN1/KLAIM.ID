const result = require('/tmp/api_response.json');

// Mock formatRupiah
function formatRupiah(amount) { return 'Rp' + amount; }

function updateFinancialReport(data) {
    const unitSummary = {};
    let totalAmount = 0;

    data.forEach(item => {
        if (item.Status === 'Rejected') return;

        let unit = item.Unit || 'Lainnya';
        const subUnit = item.Sub_Unit || item['Sub Unit'];
        if (subUnit && subUnit.trim() !== '') {
            unit += ' - ' + subUnit;
        }
        const nominal = Number(item.Nominal) || 0;

        if (!unitSummary[unit]) {
            unitSummary[unit] = { count: 0, total: 0 };
        }

        unitSummary[unit].count += 1;
        unitSummary[unit].total += nominal;
        totalAmount += nominal;
    });
    console.log("updateFinancialReport SUCCESS");
}

try {
    updateFinancialReport(result.list_data.data);
} catch(e) {
    console.error("ERROR in updateFinancialReport:", e);
}
