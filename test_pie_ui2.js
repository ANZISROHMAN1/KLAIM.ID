const result = require('/tmp/api_response.json');

function formatRupiah(amount) { return 'Rp' + amount; }
window = { currentGlobalSaldo: 1000000 };

function getPlanningByUnit() {
    return {};
}

function renderJagoPieChartAndTable(data) {
    let totalAmount = 0;
    let totalCount = 0;
    let totalEstimasi = 0;
    const labels = [];
    const amounts = [];

    data.sort((a, b) => b.total - a.total); // Sort descending by total
    
    const planningByUnit = getPlanningByUnit();

    data.forEach(item => {
        totalAmount += item.total;
        totalCount += item.count;
        let estimasiUnit = planningByUnit[item.unit.toUpperCase()] || 0;
        totalEstimasi += estimasiUnit;
    });

    let globalSaldo = window.currentGlobalSaldo || 0;
    let prognosaGlobal = globalSaldo - totalAmount - totalEstimasi;
    let prognosaHtml = window.currentGlobalSaldo ? formatRupiah(prognosaGlobal) : '-';

    let html = '';
    data.forEach(item => {
        labels.push(item.unit);
        amounts.push(item.total);
        let estimasiUnit = planningByUnit[item.unit.toUpperCase()] || 0;
        html += `<tr><td>${item.unit}</td></tr>`;
    });

    let globalSaldoHtml = window.currentGlobalSaldo ? formatRupiah(window.currentGlobalSaldo) : '-';
    html += `<tr><td>Total</td></tr>`;
    
    console.log("Pie chart units length:", labels.length);
}

try {
    renderJagoPieChartAndTable(result.jago_data.data);
    console.log("SUCCESS pie chart logic");
} catch(e) {
    console.error("ERROR in renderJagoPieChartAndTable:", e);
}
