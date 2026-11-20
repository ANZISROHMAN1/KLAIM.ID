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
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'status' || action === 'list') {
    var sheet = getFormUserSheet(ss);
    if (!sheet) {
      sheet = ss.insertSheet('FORM USER');
    }
    var data = sheet.getDataRange().getValues();
    
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
    }
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
        if ((!unit || unit === 'Tanpa Unit') && jagoData[k][6] && isNaN(parseFloat(jagoData[k][6])) && !String(jagoData[k][6]).includes("NUM")) {
          unit = jagoData[k][6];
        }
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
    var filterMonth = e.parameter.month || "Semua Bulan";
    if (neracaSheet) {
      neracaSheet.getRange("E2").setNumberFormat("@");
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
  } else if (action === 'debug_neraca_filter') {
    var jagoSheet = ss.getSheetByName('REKAPAN JAGO');
    var data = jagoSheet.getDataRange().getValues();
    var CUTOFF_DATE = new Date(2026, 6, 30);
    var monthsSet = {};
    for (var i = 1; i < data.length; i++) {
        if (!data[i][0] || data[i][0] === "") continue;
        var rowDate = parseDateSafe(data[i][0]);
        if (rowDate && rowDate >= CUTOFF_DATE) {
            var monthYear = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "MMMM yyyy");
            monthYear = monthYear.replace('January', 'Januari').replace('February', 'Februari').replace('March', 'Maret').replace('May', 'Mei').replace('June', 'Juni').replace('July', 'Juli').replace('August', 'Agustus').replace('October', 'Oktober').replace('December', 'Desember');
            monthsSet[monthYear] = true;
        }
    }
    var neracaSheet = ss.getSheetByName('Neraca Keuangan');
    var selectedFilter = e.parameter.month || "September 2026";
    var isSet = !!monthsSet[selectedFilter];
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      monthsSet: Object.keys(monthsSet),
      requestedFilter: selectedFilter,
      isFoundInSet: isSet
    })).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'get_planning') {
    var planSheet = ss.getSheetByName('PLANNING_SALDO');
    if (!planSheet) {
      return ContentService.createTextOutput(JSON.stringify({success: true, data: ''})).setMimeType(ContentService.MimeType.JSON);
    }
    var planData = planSheet.getDataRange().getValues();
    var textFound = '';
    if (planData.length > 1) {
      textFound = planData[1][2]; // Selalu ambil dari baris pertama (GLOBAL)
    }
    return ContentService.createTextOutput(JSON.stringify({success: true, data: textFound})).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'dashboard_data') {
    var result = {};
    
    // 1. list
    try {
      var sheetForm = getFormUserSheet(ss);
      if (!sheetForm) sheetForm = ss.insertSheet('FORM USER');
      var dataForm = sheetForm.getDataRange().getValues();
      var headersForm = dataForm[0];
      var rowsForm = [];
      for (var i = 1; i < dataForm.length; i++) {
        var row = {};
        for (var j = 0; j < headersForm.length; j++) {
          row[headersForm[j]] = dataForm[i][j];
        }
        row['row_index'] = i + 1;
        rowsForm.push(row);
      }
      rowsForm.reverse();
      result.list_data = {success: true, data: rowsForm};
    } catch(err) {}

    // 2. jago_data
    try {
      var jagoSheet = ss.getSheetByName('REKAPAN JAGO');
      if (jagoSheet) {
        var filterMonth = e.parameter.month;
        var CUTOFF_DATE = new Date(2026, 6, 30);
        function parseDateSafeDash(val) {
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
          var rowDate = parseDateSafeDash(jagoData[k][0]);
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
            if ((!unit || unit === 'Tanpa Unit') && jagoData[k][6] && isNaN(parseFloat(jagoData[k][6])) && !String(jagoData[k][6]).includes("NUM")) {
              unit = jagoData[k][6];
            }
          } else {
            var amount = parseFloat(jagoData[k][4]) || 0;
            if (amount < 0) expense = Math.abs(amount);
            unit = jagoData[k][6] || 'Tanpa Unit';
          }
          
          if (expense > 0) {
            var absAmount = expense;
            if (!summaryData[unit]) summaryData[unit] = { count: 0, total: 0 };
            summaryData[unit].count += 1;
            summaryData[unit].total += absAmount;
          }
        }
        var resultDataJago = [];
        for (var u in summaryData) {
          resultDataJago.push({ unit: u, count: summaryData[u].count, total: summaryData[u].total });
        }
        var availableMonths = ["Semua Bulan"].concat(Object.keys(monthsSet));
        var currentMonth = filterMonth || "Semua Bulan";
        result.jago_data = {success: true, data: resultDataJago, months: availableMonths, currentMonth: currentMonth};
        
        // Also supply debug_jago which is just raw jagoData
        result.debug_jago = {success: true, data: jagoData};
      }
    } catch(err) {}

    // 3. neraca_data
    try {
      var filterMonthN = e.parameter.month || "Semua Bulan";
      var neracaRes = updateNeracaKeuangan(filterMonthN);
      if (neracaRes) {
        var availableMonthsN = ["Semua Bulan"].concat(neracaRes.months);
        result.neraca_data = {success: true, data: neracaRes.data, months: availableMonthsN, currentMonth: filterMonthN};
      }
    } catch(err) {}

    // 4. get_planning
    try {
      var planSheet = ss.getSheetByName('PLANNING_SALDO');
      if (planSheet) {
        var planData = planSheet.getDataRange().getValues();
        var textFound = '';
        if (planData.length > 1) {
          textFound = planData[1][2];
        }
        result.planning_data = {success: true, data: textFound};
      } else {
        result.planning_data = {success: true, data: ''};
      }
    } catch(err) {}

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
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
    var sheet = getFormUserSheet(ss);
    if (!sheet) {
      sheet = ss.insertSheet('FORM USER');
    }
    
    // ID FOLDER SUDAH OTOMATIS SAYA MASUKKAN DI SINI! (TIDAK PERLU DIUBAH LAGI)
    var FOLDER_ID = '1GRHerfG8UMcQol4TY5HBvGS7NPXKYuL_'; 
    var folder = DriveApp.getFolderById(FOLDER_ID);
    
    if (action === 'submit') {
      var fileUrl = '';
      var fileHash = '';
      if (requestData.fileData && requestData.fileName) {
        var mimeType = requestData.mimeType || 'image/jpeg';
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
        
        var blob = Utilities.newBlob(byteData, mimeType, requestData.fileName);
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
      if (requestData.fileData && requestData.fileName) {
        var mimeType = requestData.mimeType || 'image/jpeg';
        var base64Data = requestData.fileData.split(',')[1] || requestData.fileData;
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, "TF_" + requestData.fileName);
        var file = folder.createFile(blob);
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(e) {}
        tfUrl = file.getUrl();
      }
      
      var rowIndex = parseInt(requestData.row_index);
      sheet.getRange(rowIndex, 8).setValue(requestData.status);
      if (tfUrl) sheet.getRange(rowIndex, 12).setValue(tfUrl);
      return ContentService.createTextOutput(JSON.stringify({success: true, tfUrl: tfUrl})).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'save_planning') {
      var planSheet = ss.getSheetByName('PLANNING_SALDO');
      if (!planSheet) {
        planSheet = ss.insertSheet('PLANNING_SALDO');
        planSheet.getRange(1, 1, 1, 3).setValues([['Timestamp', 'Bulan', 'Teks Planning']]);
        planSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f3f4f6");
      }
      var filterMonth = requestData.month || 'Semua Bulan';
      var textData = requestData.text || '';
      var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      
      var planData = planSheet.getDataRange().getValues();
      if (planData.length > 1) {
          planSheet.getRange(2, 1).setValue(now);
          planSheet.getRange(2, 2).setValue("GLOBAL");
          planSheet.getRange(2, 3).setValue(textData);
      } else {
          planSheet.appendRow([now, "GLOBAL", textData]);
      }
      
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
      .requireValueInList(["District", "BGES & MBB", "OSP", "ISP", "FBB", "HAI"])
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
      .addItem('🔄 Rapikan & Luruskan Kolom REKAPAN JAGO', 'pisahkanKasMasukKeluar')
      .addItem('📄 Import Rekapan Jago (PDF)', 'showImportDialog')
      .addItem('🧹 Bersihkan Data Klaim dari REKAPAN JAGO', 'bersihkanKlaimDariJago')
      .addToUi();
}

function cleanNumJago(s) {
  if (s === null || s === undefined) return null;
  if (typeof s === "number") return isNaN(s) ? null : s;
  var str = s.toString().trim().replace(/www\.jago\.com/gi, "").replace(/rp\.?/gi, "").trim();
  if (!str || str === "#NUM!" || str === "#VALUE!" || str === "#N/A" || str === "-") return null;
  var isNeg = str.startsWith("-") || str.startsWith("(") || str.endsWith("-");
  var clean = str.replace(/[-+–—−\(\)\s]/g, "");
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(clean) && !/^\d+(?:,\d{1,2})?$/.test(clean) && !/^\d+$/.test(clean)) {
    return null;
  }
  var num = parseFloat(clean.replace(/\./g, "").replace(/,/g, "."));
  return isNeg ? -num : num;
}

function guessUnitJago(details, notes) {
  var text = ((details || "") + " " + (notes || "")).toLowerCase();
  if (text.includes("district")) return "District";
  if (text.includes("osp")) return "OSP";
  if (text.includes("isp")) return "ISP";
  if (text.includes("hai") || text.includes("hi")) return "HAI";
  if (text.includes("bges") || text.includes("mbb")) return "BGES & MBB";
  if (text.includes("fbb")) return "FBB";
  return "";
}

function realignSingleRow(row) {
  var date = row[0] || "";
  var source = (row[1] || "").toString().replace(/PT Bank Jago Tbk.*$/is, "").trim();
  var details = row[2] || "";
  var notes = (row[3] || "").toString().replace(/www\.jago\.com/gi, "").trim();
  var colE = row[4];
  var colF = row[5];
  var colG = row[6];
  var colH = row[7];

  var kasMasuk = "";
  var kasKeluar = "";
  var balance = 0;
  var unit = "";

  // Deteksi kasus baris bergeser akibat footer www.jago.com (seperti baris 25 di sheet)
  var isBrokenNumRow = (colG === "#NUM!" || String(colG).includes("NUM")) && 
                       (notes.match(/[-+–—−]?\s*\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/));

  if (isBrokenNumRow) {
    var noteMatch = notes.match(/[-+–—−]?\s*\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/);
    var amtStr = noteMatch[0].trim();
    notes = notes.slice(0, noteMatch.index).trim();
    var amt = cleanNumJago(amtStr) || 0;
    kasMasuk = amt > 0 ? amt : "";
    kasKeluar = amt < 0 ? Math.abs(amt) : "";
    balance = cleanNumJago(colE) || 0;
    unit = colH ? colH.toString().trim() : guessUnitJago(details, notes);
    return [date, source, details, notes, kasMasuk, kasKeluar, balance, unit];
  }

  var numE = cleanNumJago(colE);
  var numF = cleanNumJago(colF);
  var numG = cleanNumJago(colG);

  // Case 1: Col G berisi teks unit (format lama 7 kolom)
  if (colG && typeof colG === "string" && isNaN(Number(colG)) && numG === null && colG !== "#NUM!") {
    var amt = numE || 0;
    kasMasuk = amt > 0 ? amt : "";
    kasKeluar = amt < 0 ? Math.abs(amt) : "";
    balance = numF || 0;
    unit = colG.trim();
  }
  // Case 2: Data 6 kolom (Col G kosong, Col E adalah amount, Col F adalah saldo)
  else if (numG === null && numF !== null && numE !== null) {
    kasMasuk = numE > 0 ? numE : "";
    kasKeluar = numE < 0 ? Math.abs(numE) : "";
    balance = numF;
    unit = (colH && typeof colH === "string" && isNaN(Number(colH))) ? colH.trim() : guessUnitJago(details, notes);
  }
  // Case 3: Col E bernilai minus (pengeluaran yang salah tempat di Kas Masuk)
  else if (numE !== null && numE < 0) {
    kasMasuk = "";
    kasKeluar = Math.abs(numE);
    balance = numG || numF || 0;
    unit = colH ? colH.toString().trim() : guessUnitJago(details, notes);
  }
  // Case 4: Format normal 8 kolom
  else {
    kasMasuk = numE !== null && numE > 0 ? numE : "";
    kasKeluar = numF !== null && numF > 0 ? numF : "";
    balance = numG || 0;
    unit = colH ? colH.toString().trim() : guessUnitJago(details, notes);
  }

  return [date, source, details, notes, kasMasuk, kasKeluar, balance, unit];
}

// Fungsi untuk merapikan dan meluruskan kolom pada sheet REKAPAN JAGO secara otomatis
function pisahkanKasMasukKeluar() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    'Konfirmasi Rapikan Rekapan Jago',
    'Apakah Anda ingin merapikan dan meluruskan kolom Kas Masuk, Kas Keluar, Saldo, dan Unit di sheet REKAPAN JAGO secara otomatis?',
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

  var newHeaders = ["Date & Time", "Source/Destination", "Transaction Details", "Notes", "Kas Masuk", "Kas Keluar", "Balance", "Unit"];
  var newRows = [];
  var fixedCount = 0;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[1] && !row[2] && !row[4]) continue;

    var cleanedRow = realignSingleRow(row);
    newRows.push(cleanedRow);
    fixedCount++;
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

  ui.alert('Berhasil! ' + fixedCount + ' baris transaksi pada REKAPAN JAGO telah dirapikan dan diluruskan ke format 8 kolom.');
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
          body { font-family: sans-serif; padding: 20px; color: #333; }
          .container { display: flex; flex-direction: column; gap: 15px; }
          button { background: #1a73e8; color: white; border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer; font-weight: 500; }
          button:hover { background: #1557b0; }
          #status { font-size: 14px; margin-top: 10px; line-height: 1.5; }
          .hint { font-size: 12px; color: #666; }
        </style>
        <!-- Load pdf.js -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
      </head>
      <body>
        <div class="container">
          <h3 style="margin: 0;">Upload PDF Rekapan Jago</h3>
          <p style="margin: 0; font-size: 14px;">Pilih file PDF mutasi dari Bank Jago untuk di-import otomatis ke sheet REKAPAN JAGO.</p>
          <input type="file" id="fileInput" accept="application/pdf" />
          <button onclick="uploadFile()">Import Data</button>
          <div class="hint">Catatan: Header tabel, footer (lisensi LPS/OJK & website www.jago.com), dan nomor halaman difilter otomatis agar saldo tidak bergeser.</div>
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
                var width = viewport.width;
                
                // Group by Y coordinate (tolerate 4px difference)
                var rows = {};
                textContent.items.forEach(function(item) {
                  var text = item.str.trim();
                  if (!text) return;
                  
                  var y = Math.round(item.transform[5]);
                  var x = item.transform[4];
                  
                  // Filter batas margin atas & bawah (footer & header margin)
                  if (y < 50 || y > 790) return;
                  
                  // Filter header & footer teks PDF Jago
                  var lowerText = text.toLowerCase();
                  if (lowerText === "date & time" || 
                      lowerText === "source/destination" || 
                      lowerText === "transaction details" || 
                      lowerText === "notes" || 
                      lowerText === "amount" || 
                      lowerText === "balance" || 
                      lowerText === "tanggal & waktu" || 
                      lowerText === "pengirim/penerima" || 
                      lowerText === "detail transaksi" || 
                      lowerText === "catatan" || 
                      lowerText === "saldo" || 
                      lowerText.includes("bank jago") || 
                      lowerText.includes("jago.com") || 
                      lowerText.includes("licensed and supervised") || 
                      lowerText.includes("berizin dan diawasi") || 
                      lowerText.includes("financial services authority") || 
                      lowerText.includes("deposit insurance") || 
                      lowerText.includes("penjaminan lps") || 
                      lowerText === "ojk" || 
                      lowerText === "lps" || 
                      lowerText.match(/^page\\s+\\d+/i) || 
                      lowerText.match(/pocket(s)?\\s+transaction(s)?\\s+history/i) || 
                      lowerText.match(/riwayat\\s+transaksi/i) || 
                      lowerText === "jago") {
                      return;
                  }
                  
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
                  // Sort strictly from left to right (X ascending)
                  items.sort(function(a, b) { return a.x - b.x; });
                  
                  var col1=[], col2=[], col3=[], col4=[], col5=[], col6=[];
                  
                  // Distribute to columns based on X percentage of width
                  items.forEach(function(it) {
                    var pct = it.x / width;
                    if (pct < 0.15) col1.push(it.text); // Date & Time
                    else if (pct < 0.33) col2.push(it.text); // Source/Destination
                    else if (pct < 0.50) col3.push(it.text); // Transaction Details
                    else if (pct < 0.68) col4.push(it.text); // Notes
                    else if (pct < 0.84) col5.push(it.text); // Amount
                    else col6.push(it.text); // Balance
                  });
                  
                  var rowData = [
                    col1.join(' ').trim(), col2.join(' ').trim(), col3.join(' ').trim(), 
                    col4.join(' ').trim(), col5.join(' ').trim(), col6.join(' ').trim()
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
                var hasDate = row[0].match(/\\d{1,2}\\s+[A-Za-z]{3}\\s+\\d{4}/);
                var hasTime = row[0].match(/\\d{2}:\\d{2}/);
                
                var rowStr = row.join(' ').toLowerCase();
                if (rowStr.includes('bank jago') || rowStr.includes('jago.com') || rowStr.includes('lps') || rowStr.includes('ojk')) {
                  return; // Skip footer leakage
                }
                
                if (hasDate) {
                  if (currentTx) finalTransactions.push(currentTx);
                  currentTx = [...row];
                } else if (currentTx && (hasTime || row[1] || row[2] || row[3] || row[4] || row[5])) {
                  // Merge multi-line into current transaction
                  for (var c = 0; c < 6; c++) {
                    if (row[c]) {
                      currentTx[c] = currentTx[c] ? (currentTx[c] + "\\n" + row[c]) : row[c];
                    }
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
  .setWidth(520)
  .setHeight(420);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Rekapan Jago');
}

function extractTrxMoneyAndNotes(notesCol, amountCol, balanceCol) {
  var directBal = cleanNumJago(balanceCol);
  var directAmt = cleanNumJago(amountCol);
  if (directBal !== null && directAmt !== null) {
    var cNotes = (notesCol || "").toString().replace(/www\.jago\.com/gi, "").trim();
    return { notes: cNotes, amount: directAmt, balance: Math.abs(directBal) };
  }
  
  var rawText = (notesCol + " " + amountCol + " " + balanceCol)
                .replace(/www\.jago\.com/gi, "")
                .replace(/pt bank jago.*/gis, "")
                .replace(/page \d+.*/gi, "")
                .trim();
  var tokens = rawText.split(/\s+/).filter(Boolean);
  var bal = null, balIdx = -1;
  for (var i = tokens.length - 1; i >= 0; i--) {
    var v = cleanNumJago(tokens[i]);
    if (v !== null && v >= 0) { bal = v; balIdx = i; break; }
  }
  var amt = null, amtIdx = -1;
  if (balIdx > 0) {
    for (var j = balIdx - 1; j >= 0; j--) {
      var cand = tokens[j];
      if (j > 0 && /^[-+–—−]$/.test(tokens[j - 1])) cand = tokens[j - 1] + cand;
      var va = cleanNumJago(cand);
      if (va !== null) {
        amt = va;
        amtIdx = (j > 0 && /^[-+–—−]$/.test(tokens[j - 1])) ? j - 1 : j;
        break;
      }
    }
  }
  var nTokens = [];
  if (amtIdx !== -1) nTokens = tokens.slice(0, amtIdx);
  else if (balIdx !== -1) nTokens = tokens.slice(0, balIdx);
  else nTokens = tokens;
  
  return {
    notes: nTokens.join(" "),
    amount: amt || 0,
    balance: bal || 0
  };
}

function processParsedJagoData(transactions) {
  if (!transactions || transactions.length === 0) {
    throw new Error("Tabel kosong atau gagal diproses dari PDF.");
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('REKAPAN JAGO');
  if (!sheet) throw new Error("Sheet bernama 'REKAPAN JAGO' tidak ditemukan!");
  
  // Baca Unit yang sudah pernah ada agar tidak hilang jika di-overwrite
  var existingUnits = {};
  var oldData = sheet.getDataRange().getValues();
  if (oldData.length > 1) {
    for (var k = 1; k < oldData.length; k++) {
      var oldDetails = (oldData[k][2] || "").toString().trim();
      var oldUnit = oldData[k][7] || oldData[k][6] || "";
      if (oldUnit && isNaN(Number(oldUnit))) {
        var idMatch = oldDetails.match(/ID#\s*([A-Za-z0-9-]+)/);
        if (idMatch) {
          existingUnits[idMatch[1]] = oldUnit.toString().trim();
        }
      }
    }
  }

  // HAPUS SEMUA DATA LAMA (Karena kita akan timpa sepenuhnya dari PDF yang sudah bersih)
  sheet.clear();
  sheet.getRange("H:H").clearDataValidations();
  
  var headers = ["Date & Time", "Source/Destination", "Transaction Details", "Notes", "Kas Masuk", "Kas Keluar", "Balance", "Unit"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
  
  var CUTOFF_DATE = new Date(2026, 6, 30); // 30 Juli 2026
  
  var newRows = [];
  var addedCount = 0;
  
  for (var i = 0; i < transactions.length; i++) {
    var trx = transactions[i];
    if (!trx || trx.length < 5) continue;
    
    var dateStr = trx[0] || "";
    
    // Filter Tanggal
    var dateMatch = dateStr.match(/(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})/);
    if (!dateMatch) continue; // Bukan baris transaksi
    
    var englishDateStr = dateMatch[1].replace('Mei', 'May').replace('Agu', 'Aug').replace('Okt', 'Oct').replace('Des', 'Dec');
    var transDate = new Date(englishDateStr);
    if (!isNaN(transDate.getTime()) && transDate < CUTOFF_DATE) {
      continue; // Lewati transaksi sebelum batas cutoff
    }
    
    // Bersihkan footer leakage dari source jika ada
    var cleanSource = (trx[1] || "").replace(/PT Bank Jago Tbk.*$/is, "").trim();
    var cleanDetails = trx[2] || "";

    // Ekstrak Catatan, Amount, dan Balance secara akurat tanpa token-popping rapuh
    var extracted = extractTrxMoneyAndNotes(trx[3], trx[4], trx[5]);
    var notes = extracted.notes;
    var amount = extracted.amount;
    var balance = extracted.balance;
    
    // Jika tidak ada amount maupun balance, abaikan (bukan baris data riil)
    if (amount === 0 && balance === 0) continue;
    
    var kasMasuk = "";
    var kasKeluar = "";
    if (amount > 0) {
      kasMasuk = amount;
    } else if (amount < 0) {
      kasKeluar = Math.abs(amount);
    }
    
    // Prioritaskan unit lama jika transaksi sudah pernah diklasifikasikan
    var autoUnit = "";
    var transIdMatch = cleanDetails.match(/ID#\s*([A-Za-z0-9-]+)/);
    if (transIdMatch && existingUnits[transIdMatch[1]]) {
      autoUnit = existingUnits[transIdMatch[1]];
    } else {
      autoUnit = guessUnitJago(cleanDetails, notes);
    }
    
    newRows.push([
      trx[0],      // Date & Time
      cleanSource, // Source/Dest
      cleanDetails,// Details
      notes,       // Notes
      kasMasuk,    // Kas Masuk
      kasKeluar,   // Kas Keluar
      balance,     // Actual Balance
      autoUnit     // Unit
    ]);
    addedCount++;
  }
  
  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
  
  formatTransactions(sheet);
  sheet.autoResizeColumns(1, 8);
  
  try {
    updateNeracaKeuangan();
  } catch(e) {}
  
  return "Berhasil! " + addedCount + " transaksi baru telah di-import ke sheet REKAPAN JAGO.";
}

function updateNeracaKeuangan(inMemoryFilter) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var jagoSheet = ss.getSheetByName('REKAPAN JAGO');
  var neracaSheet = ss.getSheetByName('Neraca Keuangan');
  
  if (!jagoSheet) return null;
  
  if (!inMemoryFilter && !neracaSheet) {
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
        if (masuk < 0) {
            keluar = Math.abs(masuk);
            masuk = 0;
        }
        rawAmount = masuk > 0 ? masuk : (keluar > 0 ? -keluar : 0);
        
        var colG = data[i][6];
        if (typeof colG === 'string' && isNaN(parseFloat(colG)) && colG.length > 1 && !colG.includes("NUM")) {
            // User likely pasted using old format: Unit is in Col G, Balance is in Col F, Amount in Col E
            unit = colG;
            balance = parseFloat(data[i][5]) || 0;
        } else {
            balance = parseFloat(data[i][6]) || 0;
            unit = data[i][7] || 'Tanpa Unit';
        }
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
        rowIdx: i,
        row: data[i]
      });
      
      var monthYear = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "MMMM yyyy");
      monthYear = monthYear.replace('January', 'Januari').replace('February', 'Februari').replace('March', 'Maret').replace('May', 'Mei').replace('June', 'Juni').replace('July', 'Juli').replace('August', 'Agustus').replace('October', 'Oktober').replace('December', 'Desember');
      monthsSet[monthYear] = true;
    }
  }
  
  var availableMonths = Object.keys(monthsSet);
  
  var selectedFilter = "Semua Bulan";
  if (inMemoryFilter) {
      selectedFilter = inMemoryFilter;
  } else {
      // Baca filter dari E2 Neraca Keuangan
      var filterRaw = neracaSheet.getRange("E2").getValue();
      
      if (filterRaw instanceof Date) {
          var monthYearFmt = Utilities.formatDate(filterRaw, Session.getScriptTimeZone(), "MMMM yyyy");
          selectedFilter = monthYearFmt.replace('January', 'Januari').replace('February', 'Februari').replace('March', 'Maret').replace('May', 'Mei').replace('June', 'Juni').replace('July', 'Juli').replace('August', 'Agustus').replace('October', 'Oktober').replace('December', 'Desember');
      } else if (filterRaw) {
          selectedFilter = filterRaw.toString().trim();
      }
      
      if (!selectedFilter || (selectedFilter !== "Semua Bulan" && !monthsSet[selectedFilter])) {
          selectedFilter = "Semua Bulan";
          neracaSheet.getRange("E2").setNumberFormat("@");
          neracaSheet.getRange("E2").setValue(selectedFilter);
      }
      
      // Setup Dropdown di E2
      var rule = SpreadsheetApp.newDataValidation().requireValueInList(["Semua Bulan"].concat(availableMonths)).build();
      neracaSheet.getRange("E1").setValue("Filter Bulan:").setFontWeight("bold");
      neracaSheet.getRange("E2").setDataValidation(rule).setBackground("#fef08a");
  }
  
  // --- MULAI PERBAIKAN LOGIKA SALDO AWAL & MTD ---
  
  // 1. Pastikan allValidData diurutkan secara KRONOLOGIS (Terlama ke Terbaru)
  var isDescending = false;
  if (allValidData.length > 1) {
     if (allValidData[0].date.getTime() > allValidData[allValidData.length - 1].date.getTime()) {
         isDescending = true;
     }
  }

  allValidData.sort(function(a, b) {
      var timeDiff = a.date.getTime() - b.date.getTime();
      if (timeDiff !== 0) return timeDiff;
      if (isDescending) return b.rowIdx - a.rowIdx;
      return a.rowIdx - b.rowIdx;
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
      if (inMemoryFilter) {
          return { data: [["Tidak ada data untuk " + selectedFilter, "", ""]], months: availableMonths };
      }
      neracaSheet.getRange("A:C").clear(); 
      neracaSheet.getRange("A1").setValue("Tidak ada data untuk " + selectedFilter);
      return; 
  }
  
  // Hitung total Pemasukan & Pengeluaran murni untuk memback-calculate Saldo Awal jika Semua Bulan
  var purePemasukan = 0;
  var purePengeluaran = 0;
  for (var i = 0; i < filteredData.length; i++) {
     if (filteredData[i].rawAmount > 0) purePemasukan += filteredData[i].rawAmount;
     if (filteredData[i].rawAmount < 0) purePengeluaran += Math.abs(filteredData[i].rawAmount);
  }
  
  // 2. Tentukan Saldo Awal MTD
  var saldoAwal = 0;
  if (selectedFilter === "Semua Bulan") {
      // Cari balance terakhir yang valid (bukan 0)
      var finalBalance = 0;
      for (var k = filteredData.length - 1; k >= 0; k--) {
          if (filteredData[k].balance && filteredData[k].balance !== 0) {
              finalBalance = filteredData[k].balance;
              break;
          }
      }
      
      if (finalBalance === 0 && filteredData.length > 0) {
          saldoAwal = filteredData[0].balance - filteredData[0].rawAmount;
      } else {
          saldoAwal = finalBalance - purePemasukan + purePengeluaran;
      }
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
  
  var neracaData = [];
  neracaData.push(["Nama Akun", "Debit (Pemasukan)", "Kredit (Pengeluaran)"]);
  
  // --- BAGIAN PEMASUKAN ---
  neracaData.push(["PEMASUKAN", "", ""]);
  neracaData.push(["Saldo Awal", saldoAwal, ""]);
  
  var totalPemasukan = 0;
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
  saldoAkhir = saldoAwal + totalPemasukan - totalPengeluaran;
  neracaData.push(["SALDO AKHIR", saldoAkhir, ""]);
  
  if (inMemoryFilter) {
      return { data: neracaData, months: availableMonths };
  }
  
  neracaSheet.getRange("A:D").clear();
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
