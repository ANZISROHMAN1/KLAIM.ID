// FUNGSI INI WAJIB DI-RUN SATU KALI UNTUK MEMAKSA IZIN PENUH
function paksaIzin() {
  SpreadsheetApp.getActiveSpreadsheet();
  DriveApp.getRootFolder().getFiles();
  DriveApp.createFile("test", "test", MimeType.PLAIN_TEXT).setTrashed(true);
}

// FUNGSI AUTO-UPDATE JIKA ADA PERUBAHAN MANUAL DI SHEET
function onEdit(e) {
  if (!e) return;
  var sheet = e.range.getSheet();
  // Jika yang diedit adalah sheet REKAPAN JAGO (Kolom Unit: 7 atau 8) atau Neraca Keuangan (Filter Bulan di E2)
  if ((sheet.getName() === 'REKAPAN JAGO' && (e.range.getColumn() === 8 || e.range.getColumn() === 7)) || 
      (sheet.getName() === 'Neraca Keuangan' && e.range.getColumn() === 5 && e.range.getRow() === 2)) {
    try {
      updateNeracaKeuangan();
    } catch(err) {
      // ignore
    }
  }
}

// FUNGSI UNTUK MEMASTIKAN SHEET FORM USER DITEMUKAN DENGAN TEPAT
function getFormUserSheet(ss) {
  var sheet = ss.getSheetByName('FORM USER');
  if (!sheet) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().trim().toUpperCase() === 'FORM USER') {
        return sheets[i];
      }
    }
  }
  return sheet;
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getFormUserSheet(ss) || ss.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var action = e.parameter.action;
  
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    row['row_index'] = i + 1;
    rows.push(row);
  }
  
  if (action === 'status') {
    var reqId = e.parameter.id;
    var result = rows.find(function(r) { return r['ID'].toString() === reqId.toString(); });
    if (result) return ContentService.createTextOutput(JSON.stringify({success: true, data: result})).setMimeType(ContentService.MimeType.JSON);
    else return ContentService.createTextOutput(JSON.stringify({success: false, message: 'ID tidak ditemukan'})).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'list') {
    rows.reverse();
    return ContentService.createTextOutput(JSON.stringify({success: true, data: rows})).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'jago_data') {
    var jagoSheet = ss.getSheetByName('REKAPAN JAGO');
    if (!jagoSheet) return ContentService.createTextOutput(JSON.stringify({success: false, message: 'Sheet REKAPAN JAGO tidak ditemukan'})).setMimeType(ContentService.MimeType.JSON);
    
    var CUTOFF_DATE = new Date(2026, 6, 30);
    var filterMonth = e.parameter.month;
    
    function parseDateSafe(val) {
      if (!val) return null;
      if (val instanceof Date) return val;
      var dStr = val.toString();
      var dateMatch = dStr.match(/(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})/);
      if (dateMatch) {
        var englishDateStr = dateMatch[1].replace('Mei', 'May').replace('Agu', 'Aug').replace('Okt', 'Oct').replace('Des', 'Dec');
        var d = new Date(englishDateStr);
        if (!isNaN(d.getTime())) return d;
      }
      var d2 = new Date(dStr);
      if (!isNaN(d2.getTime())) return d2;
      var d3 = new Date(dStr.replace(' ', 'T'));
      if (!isNaN(d3.getTime())) return d3;
      return null;
    }

    var jagoData = jagoSheet.getDataRange().getValues();
    var summaryData = {};
    var monthsSet = {};
    
    var headerRow = jagoData[0] || [];
    var isSplitCols = (headerRow.length >= 8) || 
                      (headerRow[4] && headerRow[4].toString().toLowerCase().includes('masuk')) ||
                      (headerRow[5] && headerRow[5].toString().toLowerCase().includes('keluar'));
    
    for (var k = 1; k < jagoData.length; k++) {
      var rowDate = parseDateSafe(jagoData[k][0]);
      if (!rowDate || rowDate < CUTOFF_DATE) continue;
      
      var monthYear = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "MMMM yyyy");
      monthYear = monthYear.replace('January', 'Januari').replace('February', 'Februari').replace('March', 'Maret').replace('May', 'Mei').replace('June', 'Juni').replace('July', 'Juli').replace('August', 'Agustus').replace('October', 'Oktober').replace('December', 'Desember');
      monthsSet[monthYear] = true;
      
      if (filterMonth && filterMonth !== "Semua Bulan") {
          if (monthYear !== filterMonth) continue;
      }
      
      var expense = 0;
      var unit = 'Tanpa Unit';
      
      if (isSplitCols) {
        var keluar = parseFloat(jagoData[k][5]) || 0;
        if (keluar > 0) expense = keluar;
        unit = jagoData[k][7] || 'Tanpa Unit';
      } else {
        var amount = parseFloat(jagoData[k][4]) || 0;
        if (amount < 0) expense = Math.abs(amount);
        unit = jagoData[k][6] || 'Tanpa Unit';
      }
      
      if (expense > 0) { // Only count expenses
        var absAmount = expense;
        if (!summaryData[unit]) summaryData[unit] = { count: 0, total: 0 };
        summaryData[unit].count += 1;
        summaryData[unit].total += absAmount;
      }
    }
    
    var resultData = [];
    for (var u in summaryData) {
      resultData.push({ unit: u, count: summaryData[u].count, total: summaryData[u].total });
    }
    
    var availableMonths = ["Semua Bulan"].concat(Object.keys(monthsSet));
    var currentMonth = filterMonth || "Semua Bulan";
    
    return ContentService.createTextOutput(JSON.stringify({
        success: true, 
        data: resultData,
        months: availableMonths,
        currentMonth: currentMonth
    })).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'neraca_data') {
    var neracaSheet = ss.getSheetByName('Neraca Keuangan');
    var filterMonth = e.parameter.month;
    if (filterMonth && neracaSheet) {
      neracaSheet.getRange("E2").setValue(filterMonth);
    }
    
    try {
      updateNeracaKeuangan(); // Recalculate to ensure data is fresh
    } catch(e) {
      // ignore
    }
    
    neracaSheet = ss.getSheetByName('Neraca Keuangan'); // Re-fetch in case it was just created
    if (!neracaSheet) {
      return ContentService.createTextOutput(JSON.stringify({success: false, message: 'Sheet Neraca Keuangan belum ada.'})).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = neracaSheet.getDataRange().getValues();
    
    var availableMonths = ["Semua Bulan"];
    var rule = neracaSheet.getRange("E2").getDataValidation();
    if (rule) {
        availableMonths = rule.getCriteriaValues()[0];
    }
    var currentMonth = neracaSheet.getRange("E2").getValue() || "Semua Bulan";
    
    if (data.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({success: false, message: 'Data kosong'})).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
        success: true, 
        data: data,
        months: availableMonths,
        currentMonth: currentMonth
    })).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'debug_jago') {
    var jagoSheet = ss.getSheetByName('REKAPAN JAGO');
    var jagoData = jagoSheet ? jagoSheet.getDataRange().getValues() : [];
    return ContentService.createTextOutput(JSON.stringify({success: true, data: jagoData})).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({success: false, message: 'Action not found'})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
  if (typeof e !== 'undefined' && e.postData === undefined) return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.JSON);
  
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getFormUserSheet(ss) || ss.getActiveSheet();
    
    // ID FOLDER SUDAH OTOMATIS SAYA MASUKKAN DI SINI! (TIDAK PERLU DIUBAH LAGI)
    var FOLDER_ID = '1GRHerfG8UMcQol4TY5HBvGS7NPXKYuL_'; 
    var folder = DriveApp.getFolderById(FOLDER_ID);
    
    if (action === 'submit') {
      var fileUrl = '';
      var fileHash = '';
      if (requestData.fileData && requestData.fileName && requestData.mimeType) {
        var base64Data = requestData.fileData.split(',')[1] || requestData.fileData;
        var byteData = Utilities.base64Decode(base64Data);
        
        // Cek duplikasi nota menggunakan MD5 hash
        var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, byteData);
        fileHash = digest.map(function(byte) { return ('0' + (byte & 0xFF).toString(16)).slice(-2); }).join('');
        
        var sheetData = sheet.getDataRange().getValues();
        for (var i = 1; i < sheetData.length; i++) {
          if (sheetData[i][12] === fileHash && fileHash !== '') {
            return ContentService.createTextOutput(JSON.stringify({success: false, message: 'Nota sudah pernah diajukan'})).setMimeType(ContentService.MimeType.JSON);
          }
        }
        
        var blob = Utilities.newBlob(byteData, requestData.mimeType, requestData.fileName);
        var file = folder.createFile(blob);
        fileUrl = file.getUrl();
      }
      
      var newId = new Date().getTime().toString().slice(-6);
      var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      
      // Data pengajuan dari user HANYA masuk ke sheet FORM USER (tidak dicampur ke REKAPAN JAGO)
      var rowData = [newId, now, requestData.nama, requestData.kegiatan, requestData.nominal, requestData.bank, requestData.rekening, 'Pending', requestData.unit, requestData.sub_unit, fileUrl, '', fileHash];
      sheet.appendRow(rowData);
      
      return ContentService.createTextOutput(JSON.stringify({success: true, id: newId})).setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === 'update_status') {
      var tfUrl = '';
      if (requestData.fileData && requestData.fileName && requestData.mimeType) {
        var base64Data = requestData.fileData.split(',')[1] || requestData.fileData;
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), requestData.mimeType, "TF_" + requestData.fileName);
        var file = folder.createFile(blob);
        tfUrl = file.getUrl();
      }
      
      var rowIndex = parseInt(requestData.row_index);
      sheet.getRange(rowIndex, 8).setValue(requestData.status);
      if (tfUrl) sheet.getRange(rowIndex, 12).setValue(tfUrl);
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function formatTransactions(sheet) {
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  var headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 8)).getValues()[0];
  var isSplitCols = (headerRow.length >= 8) || 
                    (headerRow[4] && headerRow[4].toString().toLowerCase().includes('masuk')) ||
                    (headerRow[5] && headerRow[5].toString().toLowerCase().includes('keluar'));
                    
  var rules = sheet.getConditionalFormatRules();
  var newRules = rules.filter(function(rule) {
    var ranges = rule.getRanges();
    return !ranges.some(function(r) { return r.getColumn() === 5 || r.getColumn() === 6; });
  });

  if (isSplitCols) {
    // Kolom E (5): Kas Masuk -> Hijau
    var masukRange = sheet.getRange(2, 5, lastRow - 1, 1);
    var masukRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground("#d9ead3")
      .setFontColor("#137333")
      .setRanges([masukRange])
      .build();
    newRules.push(masukRule);
    masukRange.setNumberFormat('"Rp" #,##0');
    
    // Kolom F (6): Kas Keluar -> Merah
    var keluarRange = sheet.getRange(2, 6, lastRow - 1, 1);
    var keluarRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground("#f4cccc")
      .setFontColor("#990000")
      .setRanges([keluarRange])
      .build();
    newRules.push(keluarRule);
    keluarRange.setNumberFormat('"Rp" #,##0');
    
    // Kolom G (7): Balance -> Format Rupiah
    sheet.getRange(2, 7, lastRow - 1, 1).setNumberFormat('"Rp" #,##0');
    
    // Kolom H (8): Unit Dropdown
    var unitRange = sheet.getRange(2, 8, lastRow - 1, 1);
    var unitRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["District", "BGES MBB", "OSP", "ISP", "FBB", "HI"])
      .build();
    unitRange.setDataValidation(unitRule);
  } else {
    var range = sheet.getRange(2, 5, lastRow - 1, 1);
    var incomeRule = SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground("#d9ead3").setFontColor("#137333").setRanges([range]).build();
    var expenseRule = SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground("#f4cccc").setFontColor("#990000").setRanges([range]).build();
    newRules.push(incomeRule);
    newRules.push(expenseRule);
    range.setNumberFormat('"Rp" #,##0');
  }
  
  sheet.setConditionalFormatRules(newRules);
}

// --- TAMBAHAN UNTUK IMPORT PDF JAGO & FORMAT KAS ---
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ KLAIM.ID')
      .addItem('🔄 Pisahkan Kolom Kas Masuk & Keluar', 'pisahkanKasMasukKeluar')
      .addItem('📄 Import Rekapan Jago (PDF)', 'showImportDialog')
      .addItem('🧹 Bersihkan Data Klaim dari REKAPAN JAGO', 'bersihkanKlaimDariJago')
      .addToUi();
}

// Fungsi untuk memisahkan kolom Amount menjadi Kas Masuk & Kas Keluar secara otomatis pada sheet saat ini
function pisahkanKasMasukKeluar() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    'Konfirmasi Pemisahan Kolom',
    'Apakah Anda ingin memisahkan kolom Amount menjadi 2 kolom terpisah: "Kas Masuk" dan "Kas Keluar" di sheet REKAPAN JAGO?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('REKAPAN JAGO');
  if (!sheet) {
    ui.alert('Sheet REKAPAN JAGO tidak ditemukan!');
    return;
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    ui.alert('Sheet REKAPAN JAGO kosong atau hanya memiliki header.');
    return;
  }

  var headerRow = data[0];
  var alreadySplit = (headerRow.length >= 8 && headerRow[4] && headerRow[4].toString().toLowerCase().includes('masuk')) ||
                     (headerRow[5] && headerRow[5].toString().toLowerCase().includes('keluar'));
                     
  if (alreadySplit) {
    formatTransactions(sheet);
    sheet.autoResizeColumns(1, 8);
    try { updateNeracaKeuangan(); } catch(e) {}
    ui.alert('Kolom sudah dalam format terpisah (Kas Masuk & Kas Keluar). Format tampilan telah diperbarui!');
    return;
  }

  function parseAmountNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    var str = val.toString().trim();
    var isNeg = str.indexOf('-') !== -1 || (str.startsWith('(') && str.endsWith(')'));
    var num = parseFloat(str.replace(/[^0-9]/g, '')) || 0;
    return isNeg ? -num : num;
  }

  var newHeaders = ["Date & Time", "Source/Destination", "Transaction Details", "Notes", "Kas Masuk", "Kas Keluar", "Balance", "Unit"];
  var newRows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[1] && !row[2] && !row[4]) continue;

    var amt = parseAmountNumber(row[4]);
    var kasMasuk = amt > 0 ? amt : "";
    var kasKeluar = amt < 0 ? Math.abs(amt) : "";

    var balanceVal = row[5];
    var bal = typeof balanceVal === 'number' ? balanceVal : (parseFloat(balanceVal.toString().replace(/[^0-9]/g, '')) || 0);
    var unitVal = row[6] || "";

    newRows.push([
      row[0],    // Date & Time
      row[1],    // Source/Dest
      row[2],    // Details
      row[3],    // Notes
      kasMasuk,  // Kas Masuk (Col E)
      kasKeluar, // Kas Keluar (Col F)
      bal,       // Balance (Col G)
      unitVal    // Unit (Col H)
    ]);
  }

  sheet.clear();

  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  sheet.getRange(1, 1, 1, newHeaders.length).setFontWeight("bold").setBackground("#f3f4f6");

  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, newHeaders.length).setValues(newRows);
  }

  formatTransactions(sheet);
  sheet.autoResizeColumns(1, 8);

  try {
    updateNeracaKeuangan();
  } catch(e) {}

  ui.alert('Berhasil! ' + newRows.length + ' baris transaksi telah dipisahkan menjadi kolom "Kas Masuk" dan "Kas Keluar".');
}

// Fungsi pembantu untuk membersihkan riwayat pengajuan user yang pernah masuk ke REKAPAN JAGO
function bersihkanKlaimDariJago() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert('Konfirmasi', 'Apakah Anda ingin menghapus semua data pengajuan user (Claim ID#) dari sheet REKAPAN JAGO agar sheet bersih kembali?', ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var jagoSheet = ss.getSheetByName('REKAPAN JAGO');
  if (!jagoSheet) {
    ui.alert('Sheet REKAPAN JAGO tidak ditemukan!');
    return;
  }
  
  var data = jagoSheet.getDataRange().getValues();
  var rowsToDelete = [];
  
  for (var i = 1; i < data.length; i++) {
    var details = (data[i][2] || "").toString();
    if (details.indexOf("Claim ID#") !== -1) {
      rowsToDelete.push(i + 1);
    }
  }
  
  if (rowsToDelete.length === 0) {
    ui.alert('Tidak ditemukan data pengajuan user (Claim ID#) di sheet REKAPAN JAGO.');
    return;
  }
  
  for (var k = rowsToDelete.length - 1; k >= 0; k--) {
    jagoSheet.deleteRow(rowsToDelete[k]);
  }
  
  try {
    updateNeracaKeuangan();
  } catch(e) {}
  
  ui.alert('Berhasil! Sebanyak ' + rowsToDelete.length + ' baris pengajuan user telah dibersihkan dari sheet REKAPAN JAGO.');
}

function showImportDialog() {
  var html = HtmlService.createHtmlOutput(`
    <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          .container { display: flex; flex-direction: column; gap: 15px; }
          button { background: #1a73e8; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; }
          button:hover { background: #1557b0; }
          #status { color: #555; font-size: 14px; margin-top: 10px; }
        </style>
        <!-- Load pdf.js -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
      </head>
      <body>
        <div class="container">
          <h3>Upload PDF Rekapan Jago</h3>
          <p>Pilih file PDF mutasi dari Bank Jago untuk di-import otomatis ke sheet REKAPAN JAGO.</p>
          <input type="file" id="fileInput" accept="application/pdf" />
          <button onclick="uploadFile()">Import Data</button>
          <div id="status"></div>
        </div>
        
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          
          async function uploadFile() {
            var file = document.getElementById('fileInput').files[0];
            if (!file) {
              alert('Silakan pilih file PDF terlebih dahulu!');
              return;
            }
            
            document.getElementById('status').innerText = "Membaca tabel PDF... (Harap tunggu)";
            
            try {
              var arrayBuffer = await file.arrayBuffer();
              var pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
              var parsedData = [];
              
              for (var i = 1; i <= pdf.numPages; i++) {
                var page = await pdf.getPage(i);
                var textContent = await page.getTextContent();
                var viewport = page.getViewport({scale: 1.0});
                var width = viewport.width; // standard A4 is ~595
                
                // Group by Y coordinate (tolerate 3px difference)
                var rows = {};
                textContent.items.forEach(function(item) {
                  var text = item.str.trim();
                  if (!text) return;
                  
                  // Filter header & footer PDF Jago
                  var lowerText = text.toLowerCase();
                  if (lowerText === "date & time" || 
                      lowerText === "source/destination" || 
                      lowerText === "transaction details" || 
                      lowerText === "notes" || 
                      lowerText === "amount" || 
                      lowerText === "balance" || 
                      lowerText.match(/^page\s+\d+/) || 
                      lowerText.match(/^pockets transactions history/) ||
                      lowerText === "jago") {
                      return;
                  }
                  
                  var y = Math.round(item.transform[5]);
                  var x = item.transform[4];
                  
                  var foundY = y;
                  for (var key in rows) {
                    if (Math.abs(key - y) <= 4) { foundY = key; break; }
                  }
                  if (!rows[foundY]) rows[foundY] = [];
                  rows[foundY].push({text: text, x: x});
                });
                
                // Sort Y descending (top to bottom of page)
                var sortedY = Object.keys(rows).sort(function(a, b) { return b - a; });
                
                sortedY.forEach(function(y) {
                  var items = rows[y];
                  var col1=[], col2=[], col3=[], col4=[], col5=[], col6=[];
                  
                  // Distribute to columns based on X percentage of width
                  items.forEach(function(it) {
                    var pct = it.x / width;
                    if (pct < 0.135) col1.push(it.text); // Date & Time
                    else if (pct < 0.31) col2.push(it.text); // Source/Destination
                    else if (pct < 0.47) col3.push(it.text); // Transaction Details
                    else if (pct < 0.65) col4.push(it.text); // Notes
                    else if (pct < 0.82) col5.push(it.text); // Amount
                    else col6.push(it.text); // Balance
                  });
                  
                  var rowData = [
                    col1.join(' '), col2.join(' '), col3.join(' '), 
                    col4.join(' '), col5.join(' '), col6.join(' ')
                  ];
                  
                  // Only push rows that have some text
                  if (rowData.join('').trim() !== '') {
                    parsedData.push(rowData);
                  }
                });
              }
              
              // Process multi-line transactions
              var finalTransactions = [];
              var currentTx = null;
              
              parsedData.forEach(function(row) {
                // If col1 matches a Date format (e.g., 11 Aug 2026 or 11:52)
                var hasDate = row[0].match(/\\d{1,2} [A-Z][a-z]{2} \\d{4}/);
                var hasTime = row[0].match(/\\d{2}:\\d{2}/);
                
                if (hasDate) {
                  if (currentTx) finalTransactions.push(currentTx);
                  currentTx = [...row];
                } else if (currentTx && (hasTime || row[1] || row[2])) {
                  // Merge multi-line into current transaction
                  for (var c = 0; c < 6; c++) {
                    if (row[c]) currentTx[c] += (currentTx[c] ? "\\n" : "") + row[c];
                  }
                }
              });
              if (currentTx) finalTransactions.push(currentTx);
              
              document.getElementById('status').innerText = "Menyimpan ke Spreadsheet...";
              
              google.script.run
                .withSuccessHandler(function(res) {
                  document.getElementById('status').innerHTML = "<span style='color:green'>" + res + "</span>";
                })
                .withFailureHandler(function(err) {
                  document.getElementById('status').innerHTML = "<span style='color:red'>Error: " + err.message + "</span>";
                })
                .processParsedJagoData(finalTransactions);
                
            } catch (e) {
              document.getElementById('status').innerHTML = "<span style='color:red'>Error PDF: " + e.message + "</span>";
            }
          }
        </script>
      </body>
    </html>
  `)
  .setWidth(500)
  .setHeight(400);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Rekapan Jago');
}

function processParsedJagoData(transactions) {
  if (!transactions || transactions.length === 0) {
    throw new Error("Tabel kosong atau gagal diproses dari PDF.");
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('REKAPAN JAGO');
  if (!sheet) throw new Error("Sheet bernama 'REKAPAN JAGO' tidak ditemukan!");
  
  // HAPUS SEMUA DATA LAMA (Karena kita akan timpa / overwrite sepenuhnya dari PDF)
  sheet.clear();
  
  var headers = ["Date & Time", "Source/Destination", "Transaction Details", "Notes", "Kas Masuk", "Kas Keluar", "Balance", "Unit"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
  
  // Fungsi Cerdas untuk menebak Unit
  function guessUnit(details, notes) {
    var text = (details + " " + notes).toLowerCase();
    if (text.includes("district")) return "District";
    if (text.includes("osp")) return "OSP";
    if (text.includes("isp")) return "ISP";
    if (text.includes("hai") || text.includes("hi")) return "HI";
    if (text.includes("bges") || text.includes("mbb")) return "BGES MBB";
    if (text.includes("fbb")) return "FBB";
    return ""; // KOSONGKAN jika tidak dikenali agar tidak error validasi data
  }
  
  // --- BATAS TANGGAL IMPORT ---
  // 30 Juli 2026 (Bulan di JavaScript dimulai dari 0, jadi 6 = Juli)
  var CUTOFF_DATE = new Date(2026, 6, 30); 
  
  var newRows = [];
  var addedCount = 0;
  
  for (var i = 0; i < transactions.length; i++) {
    var trx = transactions[i];
    if (!trx || trx.length < 5) continue;
    
    var dateStr = trx[0];
    
    // Filter Tanggal (Ekstrak dari teks kotor)
    var dateMatch = dateStr.match(/(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})/);
    if (!dateMatch) continue; // Bukan baris transaksi (misal: header/footer)
    
    var englishDateStr = dateMatch[1].replace('Mei', 'May').replace('Agu', 'Aug').replace('Okt', 'Oct').replace('Des', 'Dec');
    var transDate = new Date(englishDateStr);
    if (!isNaN(transDate.getTime()) && transDate < CUTOFF_DATE) {
      continue; // Lewati transaksi sebelum 30 Juli 2026
    }
    
    // Pastikan baris ini adalah transaksi asli (harus punya ID#)
    if (!trx[1].includes("ID#") && !trx[2].includes("ID#")) {
      continue; // Abaikan header tabel
    }
    
    var notesAndMoney = (trx[3] + " " + trx[4] + " " + trx[5]).trim();
    var tokens = notesAndMoney.split(/\s+/);
    
    if (tokens.length < 2) continue; // Invalid row
    
    var balanceStr = tokens.pop();
    var amountStr = tokens.pop();
    var notes = tokens.join(" "); // Anything left over belongs to Notes
    
    if (amountStr.toLowerCase().includes('amount')) continue;
    
    var isNegative = false;
    var dashRegex = /[-–—−]/;
    
    if (notes.trim().match(/[-–—−]$/)) {
      isNegative = true;
      notes = notes.replace(/[-–—−]$/, '').trim();
    } else if (amountStr.match(/^[-–—−]/)) {
      isNegative = true;
      amountStr = amountStr.replace(/^[-–—−]/, '');
    } else if (amountStr.match(/[-–—−]$/)) {
      isNegative = true;
      amountStr = amountStr.replace(/[-–—−]$/, '');
    } else if (amountStr.startsWith('(') && amountStr.endsWith(')')) {
      isNegative = true;
      amountStr = amountStr.slice(1, -1);
    }
    
    // Clean numbers
    var amount = parseFloat(amountStr.replace(/\./g, '').replace(/,/g, '.'));
    if (isNegative) amount = -Math.abs(amount);
    var balance = parseFloat(balanceStr.replace(/\./g, '').replace(/,/g, '.'));
    
    var kasMasuk = "";
    var kasKeluar = "";
    if (amount > 0) {
      kasMasuk = amount;
    } else if (amount < 0) {
      kasKeluar = Math.abs(amount);
    }
    
    // Tebak Unit secara otomatis!
    var autoUnit = guessUnit(trx[1] + " " + trx[2], notes);
    
    newRows.push([
      trx[0],   // Date & Time
      trx[1],   // Source/Dest
      trx[2],   // Details
      notes,    // Corrected Notes
      kasMasuk, // Kas Masuk
      kasKeluar,// Kas Keluar
      balance,  // Actual Balance
      autoUnit  // Unit Cerdas Otomatis
    ]);
    addedCount++;
  }
  
  // Tulis sekaligus semua data ke Sheet (Jauh lebih cepat dari appendRow)
  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
  
  formatTransactions(sheet);
  sheet.autoResizeColumns(1, 8);
  
  try {
    updateNeracaKeuangan();
  } catch(e) {
    // Ignore error so it doesn't break import
  }
  
  return "Berhasil! " + addedCount + " transaksi baru telah di-import ke sheet REKAPAN JAGO.";
}

function updateNeracaKeuangan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var jagoSheet = ss.getSheetByName('REKAPAN JAGO');
  var neracaSheet = ss.getSheetByName('Neraca Keuangan');
  
  if (!jagoSheet) return;
  
  if (!neracaSheet) {
    neracaSheet = ss.insertSheet('Neraca Keuangan');
  }
  
  var data = jagoSheet.getDataRange().getValues();
  if (data.length < 2) return;
  
  var CUTOFF_DATE = new Date(2026, 6, 30); // 30 Juli 2026
  
  function parseDateSafe(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    var dStr = val.toString();
    var dateMatch = dStr.match(/(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})/);
    if (dateMatch) {
      var englishDateStr = dateMatch[1].replace('Mei', 'May').replace('Agu', 'Aug').replace('Okt', 'Oct').replace('Des', 'Dec');
      var d = new Date(englishDateStr);
      if (!isNaN(d.getTime())) return d;
    }
    var d2 = new Date(dStr);
    if (!isNaN(d2.getTime())) return d2;
    var d3 = new Date(dStr.replace(' ', 'T'));
    if (!isNaN(d3.getTime())) return d3;
    return null;
  }

  var headerRow = data[0];
  var isSplitCols = (headerRow.length >= 8) || 
                    (headerRow[4] && headerRow[4].toString().toLowerCase().includes('masuk')) ||
                    (headerRow[5] && headerRow[5].toString().toLowerCase().includes('keluar'));

  var allValidData = [];
  var monthsSet = {};
  
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0] || data[i][0] === "") continue;
    var rowDate = parseDateSafe(data[i][0]);
    if (rowDate && rowDate >= CUTOFF_DATE) {
      var rawAmount = 0;
      var balance = 0;
      var unit = 'Tanpa Unit';
      var details = (data[i][2] || "").toString();
      var notes = (data[i][3] || "").toString();
      
      if (isSplitCols) {
        var masuk = parseFloat(data[i][4]) || 0;
        var keluar = parseFloat(data[i][5]) || 0;
        rawAmount = masuk > 0 ? masuk : (keluar > 0 ? -keluar : 0);
        balance = parseFloat(data[i][6]) || 0;
        unit = data[i][7] || 'Tanpa Unit';
      } else {
        rawAmount = parseFloat(data[i][4]) || 0;
        balance = parseFloat(data[i][5]) || 0;
        unit = data[i][6] || 'Tanpa Unit';
      }
      
      allValidData.push({
        date: rowDate,
        rawAmount: rawAmount,
        balance: balance,
        unit: unit,
        details: details,
        notes: notes,
        row: data[i]
      });
      
      var monthYear = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "MMMM yyyy");
      monthYear = monthYear.replace('January', 'Januari').replace('February', 'Februari').replace('March', 'Maret').replace('May', 'Mei').replace('June', 'Juni').replace('July', 'Juli').replace('August', 'Agustus').replace('October', 'Oktober').replace('December', 'Desember');
      monthsSet[monthYear] = true;
    }
  }
  
  var availableMonths = Object.keys(monthsSet);
  
  // Baca filter dari E2 Neraca Keuangan
  var selectedFilter = neracaSheet.getRange("E2").getValue();
  if (!selectedFilter || (selectedFilter !== "Semua Bulan" && !monthsSet[selectedFilter])) {
      selectedFilter = "Semua Bulan";
      neracaSheet.getRange("E2").setValue(selectedFilter);
  }
  
  // Setup Dropdown di E2
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(["Semua Bulan"].concat(availableMonths)).build();
  neracaSheet.getRange("E1").setValue("Filter Bulan:").setFontWeight("bold");
  neracaSheet.getRange("E2").setDataValidation(rule).setBackground("#fef08a");
  
  // --- MULAI PERBAIKAN LOGIKA SALDO AWAL & MTD ---
  
  // 1. Pastikan allValidData diurutkan secara KRONOLOGIS (Terlama ke Terbaru)
  allValidData.sort(function(a, b) {
      return a.date.getTime() - b.date.getTime();
  });
  
  var filteredData = [];
  var lastBalanceBeforeMTD = 0;
  var hasFoundMTD = false;
  
  for (var i = 0; i < allValidData.length; i++) {
      var item = allValidData[i];
      var monthYear = Utilities.formatDate(item.date, Session.getScriptTimeZone(), "MMMM yyyy");
      monthYear = monthYear.replace('January', 'Januari').replace('February', 'Februari').replace('March', 'Maret').replace('May', 'Mei').replace('June', 'Juni').replace('July', 'Juli').replace('August', 'Agustus').replace('October', 'Oktober').replace('December', 'Desember');
      
      var isTargetMonth = (selectedFilter === "Semua Bulan" || monthYear === selectedFilter);
      
      if (isTargetMonth) {
          filteredData.push(item);
          hasFoundMTD = true;
      } else {
          // Selama kita belum menemukan bulan MTD, update terus saldo terakhir bulan N-1
          if (!hasFoundMTD) {
              lastBalanceBeforeMTD = item.balance;
          }
      }
  }
  
  if (filteredData.length === 0) {
      neracaSheet.getRange("A:C").clear(); 
      neracaSheet.getRange("A1").setValue("Tidak ada data untuk " + selectedFilter);
      return; 
  }
  
  // 2. Tentukan Saldo Awal MTD
  var saldoAwal = 0;
  if (selectedFilter === "Semua Bulan") {
      saldoAwal = filteredData[0].balance - filteredData[0].rawAmount;
  } else {
      if (lastBalanceBeforeMTD !== 0) {
          saldoAwal = lastBalanceBeforeMTD; // Mengambil saldo akhir bulan N-1 dengan akurat
      } else {
          // Fallback jika tidak ada histori bulan N-1 di data Jago
          saldoAwal = filteredData[0].balance - filteredData[0].rawAmount;
      }
  }
  
  var units = {};
  var totalDebit = 0;
  var totalKredit = 0;
  
  // 3. Pemasukan dan Pengeluaran hanya menggunakan arus kas (rawAmount) dari bulan MTD
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
    } else if (amount < 0) {
      var absAmount = Math.abs(amount);
      units[unit].kredit += absAmount;
      totalDebit += absAmount;
    }
  }
  
  neracaSheet.getRange("A:D").clear();
  
  var neracaData = [];
  neracaData.push(["Nama Akun", "Debit (Pemasukan)", "Kredit (Pengeluaran)"]);
  
  // --- BAGIAN PEMASUKAN ---
  neracaData.push(["PEMASUKAN", "", ""]);
  neracaData.push(["Saldo Awal", saldoAwal, ""]);
  
  var totalPemasukan = saldoAwal;
  for (var u in units) {
    if (units[u].debit > 0) {
      var prefix = (u === 'Tanpa Unit') ? "" : "Pemasukan / BODP ";
      neracaData.push([prefix + u, units[u].debit, ""]);
      totalPemasukan += units[u].debit;
    }
  }
  
  neracaData.push(["Total Pemasukan", totalPemasukan, ""]);
  neracaData.push(["", "", ""]);
  
  // --- BAGIAN PENGELUARAN ---
  neracaData.push(["PENGELUARAN", "", ""]);
  var totalPengeluaran = 0;
  for (var u in units) {
    if (units[u].kredit > 0) {
      var prefix = (u === 'Tanpa Unit') ? "" : "Operasional / BODP ";
      neracaData.push([prefix + u, "", units[u].kredit]);
      totalPengeluaran += units[u].kredit;
    }
  }
  
  neracaData.push(["Total Pengeluaran", "", totalPengeluaran]);
  neracaData.push(["", "", ""]);
  
  // --- SALDO AKHIR ---
  saldoAkhir = totalPemasukan - totalPengeluaran;
  neracaData.push(["SALDO AKHIR", saldoAkhir, ""]);
  
  neracaSheet.getRange(1, 1, neracaData.length, 3).setValues(neracaData);
  
  neracaSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#f3f4f6");
  
  for (var r = 0; r < neracaData.length; r++) {
    var rowName = neracaData[r][0];
    if (rowName === "PEMASUKAN" || rowName === "PENGELUARAN") {
      neracaSheet.getRange(r + 1, 1, 1, 3).setFontWeight("bold").setBackground("#e5e7eb");
    }
    if (rowName === "Total Pemasukan" || rowName === "Total Pengeluaran" || rowName === "SALDO AKHIR") {
      neracaSheet.getRange(r + 1, 1, 1, 3).setFontWeight("bold").setBackground("#d1d5db");
    }
  }
  
  neracaSheet.getRange(2, 2, neracaData.length - 1, 2).setNumberFormat('"Rp" #,##0');
  neracaSheet.autoResizeColumns(1, 3);
}
