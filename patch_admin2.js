const fs = require('fs');
let code = fs.readFileSync('/Users/macbook/Documents/KLAIM.ID/admin.html', 'utf8');

const newFetchReportData = `
        async function fetchReportData(isSilent = false) {
            if (SCRIPT_URL === 'GANTI_DENGAN_URL_WEB_APP_ANDA') {
                if (!isSilent) showAlert('Silakan set SCRIPT_URL terlebih dahulu', 'error');
                return;
            }

            try {
                const filterSelect = document.getElementById('global-month-filter');
                let monthParam = '';
                if (filterSelect && filterSelect.value) {
                    monthParam = \`&month=\${encodeURIComponent(filterSelect.value)}\`;
                }
                
                // Show loader if needed
                if (!isSilent) {
                    const tbody = document.getElementById('report-summary-body');
                    if (tbody) {
                        tbody.innerHTML = \`<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="ri-loader-4-line ri-spin" style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem; color: #d1d5db;"></i>Memuat data dashboard...</td></tr>\`;
                    }
                    const tableBody = document.getElementById('table-body');
                    if (tableBody) {
                        tableBody.innerHTML = \`<tr><td colspan="11" style="text-align: center; padding: 3rem; color: var(--text-muted);"><i class="ri-loader-4-line ri-spin" style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem; color: #d1d5db;"></i>Memuat data pengajuan...</td></tr>\`;
                    }
                }

                const response = await fetch(\`\${SCRIPT_URL}?action=dashboard_data\${monthParam}&t=\${new Date().getTime()}\`);
                const result = await response.json();
                
                // Process Form User Data
                if (result.list_data && result.list_data.success) {
                    const newTotal = result.list_data.data.length;

                    // Cek jika ada data baru masuk
                    if (!isFirstLoad && newTotal > lastTotalCount) {
                        const newItemsCount = newTotal - lastTotalCount;
                        showAlert(\`🔔 Ada \${newItemsCount} pengajuan klaim baru!\`, 'success');
                        playNotificationSound();

                        unreadNotifCount += newItemsCount;
                        const badge = document.getElementById('notif-badge');
                        badge.innerText = unreadNotifCount;
                        badge.style.display = 'flex';
                    }

                    lastTotalCount = newTotal;
                    isFirstLoad = false;

                    currentData = result.list_data.data || [];
                    applyFilters(); // This replaces filterTable since applyFilters calls it and filters properly
                    updateStats(currentData);
                    
                    // Call the financial update if function exists
                    if (typeof updateFinancialReport === 'function') {
                        updateFinancialReport(currentData);
                    }
                } else if (!result.list_data) {
                    if (!isSilent) showAlert('Gagal memuat data utama.', 'error');
                }

                // Process Neraca Data
                if (result.neraca_data && result.neraca_data.success) {
                    reportNeracaCache[monthParam] = result.neraca_data;
                    let nResult = result.neraca_data;
                    let saldoAkhir = 0;
                    let saldoAwal = 0;
                    let totalPemasukan = 0;
                    for (let i = 0; i < nResult.data.length; i++) {
                        let rowLabel = nResult.data[i][0] ? nResult.data[i][0].toString().toUpperCase() : "";
                        if (rowLabel === "SALDO AKHIR") {
                            saldoAkhir = parseFloat(nResult.data[i][1]) || 0;
                        } else if (rowLabel === "SALDO AWAL") {
                            saldoAwal = parseFloat(nResult.data[i][1]) || 0;
                        } else if (rowLabel === "TOTAL PEMASUKAN") {
                            totalPemasukan = parseFloat(nResult.data[i][1]) || 0;
                        }
                    }
                    window.currentAiSaldo = saldoAkhir;
                    window.currentGlobalSaldo = saldoAwal + totalPemasukan;
                    
                    let sisaSaldoCard = document.getElementById('top-card-sisa-saldo');
                    if (sisaSaldoCard) {
                        sisaSaldoCard.innerText = formatRupiah(saldoAkhir);
                    }
                    
                    if (nResult.months && nResult.months.length > 0 && filterSelect && filterSelect.options.length <= 1) {
                        const currentVal = filterSelect.value || nResult.currentMonth;
                        filterSelect.innerHTML = '';
                        nResult.months.forEach(m => {
                            const option = document.createElement('option');
                            option.value = m === 'Semua Bulan' ? '' : m;
                            option.textContent = m;
                            if (currentVal === option.value || currentVal === m) option.selected = true;
                            filterSelect.appendChild(option);
                        });
                    }
                    renderNeracaTable(nResult.data);
                }
                
                // Process Planning Data
                if (result.planning_data && result.planning_data.success) {
                    reportPlanningCache['GLOBAL'] = result.planning_data.data;
                    renderPlanningContent(result.planning_data.data, window.currentAiSaldo);
                }

                // Process Insights Data
                if (result.debug_jago && result.debug_jago.success) {
                    window.rawJagoData = result.debug_jago.data;
                    generateInsightsFromJago(window.rawJagoData);
                    renderTrendChart(window.rawJagoData);
                }

                // Process Jago Data
                if (result.jago_data && result.jago_data.success) {
                    reportJagoCache[monthParam] = result.jago_data;
                    window.aggregatedJagoData = result.jago_data.data;
                    renderJagoPieChartAndTable(window.aggregatedJagoData);
                }
                
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
                if (!isSilent) showAlert('Terjadi kesalahan jaringan.', 'error');
            }
        }
`;

// Replace the old fetchReportData block again
const startIdx = code.indexOf('async function fetchReportData() {');
const endMarker = 'function renderPlanningContent(textData, saldo) {';
const endIdx = code.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + newFetchReportData + "\n        " + code.substring(endIdx);
    
    // Now replace all `fetchData(` or `fetchData()` calls with `fetchReportData(`
    // EXCEPT the declaration `async function fetchData(isSilent = false) {`
    
    code = code.replace(/fetchData\(\);/g, 'fetchReportData();');
    code = code.replace(/fetchData\(true\);/g, 'fetchReportData(true);');
    
    fs.writeFileSync('/Users/macbook/Documents/KLAIM.ID/admin.html', code);
    console.log("Patched admin.html with new fetchReportData and replaced fetchData calls");
} else {
    console.log("Could not find start/end markers");
}
