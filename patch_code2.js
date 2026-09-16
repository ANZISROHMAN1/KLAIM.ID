const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

// 1. Revert isNaN(parseAmountSafe) to isNaN(parseFloat)
code = code.replace(/isNaN\(parseAmountSafe\(colG\)\)/g, 'isNaN(parseFloat(colG))');

// 2. Rewrite the aggregation and saldoAwal logic
// We need to replace from `// 2. Tentukan Saldo Awal MTD` to `saldoAkhir = saldoAwal + totalPemasukan - totalPengeluaran;`
const searchStart = '// 2. Tentukan Saldo Awal MTD';
const searchEnd = 'saldoAkhir = saldoAwal + totalPemasukan - totalPengeluaran;';

const idxStart = code.indexOf(searchStart);
const idxEnd = code.indexOf(searchEnd) + searchEnd.length;

const replacement = `// 2. Aggregasi Transaksi
  var units = {};
  var totalDebit = 0;
  var totalKredit = 0;
  var totalPemasukan = 0;
  var totalPengeluaran = 0;
  
  for (var i = 0; i < filteredData.length; i++) {
    var amount = filteredData[i].rawAmount;
    var unit = filteredData[i].unit;
    if (!unit || unit.toString().trim() === '') {
      unit = 'Tanpa Unit';
    } else {
      unit = unit.toString().trim();
    }
    
    if (!units[unit]) {
      units[unit] = { debit: 0, kredit: 0 };
    }
    
    if (amount > 0) {
      units[unit].debit += amount;
      totalKredit += amount;
      totalPemasukan += amount;
    } else if (amount < 0) {
      var absAmount = Math.abs(amount);
      units[unit].kredit += absAmount;
      totalDebit += absAmount;
      totalPengeluaran += absAmount;
    }
  }

  // 3. Tentukan Saldo Akhir riil, lalu hitung mundur Saldo Awal agar selalu cocok
  var finalBalance = 0;
  for (var k = 0; k < filteredData.length; k++) {
      if (filteredData[k].balance && filteredData[k].balance !== 0) {
          finalBalance = filteredData[k].balance;
      } else if (finalBalance !== 0) {
          // Terapkan penyesuaian dari baris manual yang tidak punya kolom balance
          finalBalance += filteredData[k].rawAmount;
      }
  }
  
  var saldoAwal = 0;
  if (finalBalance === 0) {
      // Fallback jika tidak ada balance sama sekali
      if (selectedFilter === "Semua Bulan") {
          saldoAwal = filteredData.length > 0 ? (filteredData[0].balance - filteredData[0].rawAmount) : 0;
          finalBalance = saldoAwal + totalPemasukan - totalPengeluaran;
      } else {
          saldoAwal = lastBalanceBeforeMTD !== 0 ? lastBalanceBeforeMTD : (filteredData.length > 0 ? (filteredData[0].balance - filteredData[0].rawAmount) : 0);
          finalBalance = saldoAwal + totalPemasukan - totalPengeluaran;
      }
  } else {
      // Hitung mundur saldo awal agar laporan keuangan selalu akurat dan balance
      saldoAwal = finalBalance - totalPemasukan + totalPengeluaran;
  }
  
  neracaSheet.getRange("A:D").clear();
  
  var neracaData = [];
  neracaData.push(["Nama Akun", "Debit (Pemasukan)", "Kredit (Pengeluaran)"]);
  
  // --- BAGIAN PEMASUKAN ---
  neracaData.push(["PEMASUKAN", "", ""]);
  neracaData.push(["Saldo Awal", saldoAwal > 0 ? saldoAwal : 0, saldoAwal < 0 ? Math.abs(saldoAwal) : ""]);
  
  for (var u in units) {
    if (units[u].debit > 0) {
      var prefix = (u === 'Tanpa Unit') ? "" : "Pemasukan / BODP ";
      neracaData.push([prefix + u, units[u].debit, ""]);
    }
  }
  
  neracaData.push(["Total Pemasukan", totalPemasukan, ""]);
  neracaData.push(["", "", ""]);
  
  // --- BAGIAN PENGELUARAN ---
  neracaData.push(["PENGELUARAN", "", ""]);
  for (var u in units) {
    if (units[u].kredit > 0) {
      var prefix = (u === 'Tanpa Unit') ? "" : "Operasional / BODP ";
      neracaData.push([prefix + u, "", units[u].kredit]);
    }
  }
  
  neracaData.push(["Total Pengeluaran", "", totalPengeluaran]);
  neracaData.push(["", "", ""]);
  
  // --- SALDO AKHIR ---
  saldoAkhir = finalBalance;`;

code = code.slice(0, idxStart) + replacement + code.slice(idxEnd);

fs.writeFileSync('Code.gs', code);
