/**
 * Skill N Success — lead capture for Google Sheets.
 * Paste into the sheet's Extensions → Apps Script, then Deploy → New deployment → Web app
 * (Execute as: Me, Who has access: Anyone). Put the /exec URL in LEADS_WEBHOOK_URL on Render.
 *
 * Optional: Project Settings → Script properties → add SECRET with the same value as
 * LEADS_WEBHOOK_SECRET on Render, so only your server can add rows.
 */
var NOTIFY_EMAIL = 'debasis.panda1985@gmail.com';
var SHEET_NAME = 'Leads';
var HEADERS = ['Received (IST)', 'Email', 'Product', 'Page', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'Status', 'Notes'];

function doPost(e) {
  var data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }

  var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (secret && data.secret !== secret) return out_({ ok: false, error: 'forbidden' });

  var email = String(data.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out_({ ok: false, error: 'bad email' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    }
    var when = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm');
    sh.appendRow([when, email, clean_(data.product), clean_(data.page), clean_(data.utm_source),
      clean_(data.utm_medium), clean_(data.utm_campaign), clean_(data.utm_content), 'New', clean_(data.notes, 3000)]);
  } finally {
    lock.releaseLock();
  }

  try {
    MailApp.sendEmail(NOTIFY_EMAIL, 'New lead: ' + (clean_(data.product) || 'website') + ' — ' + email,
      'New sign-up on skillnsuccess.com\n\nEmail: ' + email +
      '\nProduct: ' + clean_(data.product) +
      '\nAd: ' + (clean_(data.utm_content) || '(not from an ad)') +
      (data.notes ? '\n\nFeedback: ' + clean_(data.notes, 3000) : '') +
      '\n\nAll leads: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
  } catch (err) { /* daily mail quota reached; the row is still saved */ }

  return out_({ ok: true });
}

// Run once from the editor (select "testSetup" → Run) to grant permissions and add a test row.
function testSetup() {
  doPost({ postData: { contents: JSON.stringify({ email: 'test@example.com', product: 'setup-test', secret: PropertiesService.getScriptProperties().getProperty('SECRET') }) } });
}

// Strips leading = + - @ so a crafted value can't run as a spreadsheet formula.
function clean_(v, max) { return String(v || '').slice(0, max || 300).replace(/^[=+\-@]+/, ''); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
