const result = require('/tmp/api_response.json');

function formatRupiah(amount) { return 'Rp' + amount; }

function renderJagoPieChartAndTable(data) {
    if (!data || data.length === 0) return;
    let units = data.map(d => d.unit);
    let totals = data.map(d => d.total);
    let tbody = document_getElementById_report_summary_body; // mock
    console.log("Pie chart units length:", units.length);

    let html = '';
    let overallTotal = 0;
    
    // ... we don't need to implement the whole DOM logic here, just check if it crashes.
    let globalPlanningData = [];
    if (result.planning_data && result.planning_data.data) {
        try { globalPlanningData = JSON.parse(result.planning_data.data); } catch(e){}
    }
    console.log("Global planning data length:", globalPlanningData.length);
}

try {
    renderJagoPieChartAndTable(result.jago_data.data);
    console.log("SUCCESS");
} catch(e) {
    console.error("ERROR in renderJagoPieChartAndTable:", e);
}
