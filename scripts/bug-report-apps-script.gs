/**
 * FantaF1 – Webhook segnalazioni bug → Google Sheet
 *
 * Ricevе le segnalazioni inviate da src/components/BugReportModal.jsx e le
 * aggiunge come nuova riga nel foglio attivo.
 *
 * Setup e pubblicazione: vedi docs/bug-report-google-sheet.md
 */

// Nome del foglio (tab) in cui scrivere. Se non esiste, viene creato.
var SHEET_NAME = 'Bug Reports';

// Facoltativo: email a cui inoltrare ogni segnalazione (lascia '' per disattivare).
var NOTIFY_EMAIL = '';

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    var sheet = getSheet_();

    // Se il foglio è vuoto, scrivi l'intestazione una volta sola.
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Ricevuto il', 'Messaggio', 'Pagina', 'Versione', 'User agent', 'Timestamp client'
      ]);
    }

    sheet.appendRow([
      new Date(),
      data.message || '',
      data.page || '',
      data.appVersion || '',
      data.userAgent || '',
      data.timestamp || ''
    ]);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(
        NOTIFY_EMAIL,
        'Nuova segnalazione FantaF1',
        'Messaggio: ' + (data.message || '') +
        '\nPagina: ' + (data.page || '') +
        '\nVersione: ' + (data.appVersion || '') +
        '\nUser agent: ' + (data.userAgent || '')
      );
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Utile per un test veloce aprendo l'URL /exec nel browser.
function doGet() {
  return json_({ ok: true, message: 'FantaF1 bug-report webhook attivo' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
