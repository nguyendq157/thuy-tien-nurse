/**
 * Bridge between the nurse-shift web app and this Google Sheet.
 * Bound script: open the Sheet -> Extensions -> Apps Script -> paste this file.
 * Required script property: SECRET_TOKEN (Project Settings -> Script properties).
 */

var TAB_NAMES = ['DieuDuong', 'BenhNhan', 'Thuoc', 'Ca'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
    if (!secret || body.token !== secret) {
      return jsonResponse({ ok: false, error: 'Sai mật khẩu hoặc chưa cấu hình SECRET_TOKEN' });
    }
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (body.action === 'pull') {
      return jsonResponse({ ok: true, tabs: readTabs(spreadsheet) });
    }
    if (body.action === 'push') {
      writeTabs(spreadsheet, body.tabs || {});
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ ok: false, error: 'Hành động không hợp lệ' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function readTabs(spreadsheet) {
  var tabs = {};
  TAB_NAMES.forEach(function (name) {
    var sheet = spreadsheet.getSheetByName(name);
    tabs[name] = sheet && sheet.getLastRow() > 0 ? sheet.getDataRange().getDisplayValues() : [];
  });
  return tabs;
}

function writeTabs(spreadsheet, tabs) {
  TAB_NAMES.forEach(function (name) {
    var rows = tabs[name];
    if (!rows || !rows.length) return;
    var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    var width = rows.reduce(function (max, r) { return Math.max(max, r.length); }, 1);
    var grid = rows.map(function (r) {
      var padded = r.slice();
      while (padded.length < width) padded.push('');
      return padded;
    });
    sheet.clearContents();
    var range = sheet.getRange(1, 1, grid.length, width);
    range.setNumberFormat('@'); // keep dates and times as plain text
    range.setValues(grid);
  });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
