const result = require('/tmp/api_response.json');

try {
    let nResult = result.neraca_data;
    if (!nResult || !nResult.data) {
        console.log("neraca_data is missing or has no data array!");
        process.exit(1);
    }
    console.log("Neraca data length:", nResult.data.length);
    for (let i = 0; i < nResult.data.length; i++) {
        let rowLabel = nResult.data[i][0] ? nResult.data[i][0].toString().toUpperCase() : "";
        if (rowLabel === "SALDO AKHIR") {
            saldoAkhir = parseFloat(nResult.data[i][1]) || 0;
        }
    }
    console.log("Neraca processed successfully");
} catch(e) {
    console.error("ERROR processing neraca:", e);
}
