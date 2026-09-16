const fs = require('fs');
let content = fs.readFileSync('Code.gs', 'utf8');

const oldDoGet = `function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getFormUserSheet(ss);
  if (!sheet) {
    sheet = ss.insertSheet('FORM USER');
  }
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
  } else if (action === 'jago_data') {`;

const newDoGet = `function doGet(e) {
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
  } else if (action === 'jago_data') {`;

content = content.replace(oldDoGet, newDoGet);
fs.writeFileSync('Code.gs', content);
