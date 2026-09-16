const fs = require('fs');
let code = fs.readFileSync('/Users/macbook/Documents/KLAIM.ID/Code.gs', 'utf8');

// The goal is to append a new action 'dashboard_data' which consolidates the calls.
// To avoid breaking the existing 'doGet', we can just add the new block inside 'doGet'.

const dashboardDataLogic = `
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
          var dateMatch = dStr.match(/(\\d{1,2}\\s+[a-zA-Z]{3}\\s+\\d{4})/);
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
      var neracaSheet = ss.getSheetByName('Neraca Keuangan');
      var filterMonthN = e.parameter.month || "Semua Bulan";
      if (neracaSheet) {
        neracaSheet.getRange("E2").setNumberFormat("@");
        neracaSheet.getRange("E2").setValue(filterMonthN);
      }
      try { updateNeracaKeuangan(); } catch(e) {}
      
      neracaSheet = ss.getSheetByName('Neraca Keuangan'); 
      if (neracaSheet) {
        var dataNeraca = neracaSheet.getDataRange().getValues();
        var availableMonthsN = ["Semua Bulan"];
        var rule = neracaSheet.getRange("E2").getDataValidation();
        if (rule) availableMonthsN = rule.getCriteriaValues()[0];
        var currentMonthN = neracaSheet.getRange("E2").getValue() || "Semua Bulan";
        
        result.neraca_data = {success: true, data: dataNeraca, months: availableMonthsN, currentMonth: currentMonthN};
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
`;

code = code.replace("return ContentService.createTextOutput(JSON.stringify({success: false, message: 'Action not found'})).setMimeType(ContentService.MimeType.JSON);", dashboardDataLogic + "\n  return ContentService.createTextOutput(JSON.stringify({success: false, message: 'Action not found'})).setMimeType(ContentService.MimeType.JSON);");

fs.writeFileSync('/Users/macbook/Documents/KLAIM.ID/Code_new.gs', code);
