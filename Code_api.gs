function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = String(params.action || "").trim();
  const callback = sanitizeCallback(params.callback || "");

  let result;

  try {
    if (action === "getNotices") {
      result = { ok: true, data: getNotices() };
    } else if (action === "getPartners") {
      result = { ok: true, data: getPartners() };
    } else if (action === "getMemberByCode") {
      result = { ok: true, data: getMemberByCode(params.code || "") };
    } else {
      result = { ok: false, error: "알 수 없는 action입니다." };
    }
  } catch (err) {
    result = { ok: false, error: String(err && err.message ? err.message : err) };
  }

  const json = JSON.stringify(result);

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeCallback(value) {
  const callback = String(value || "").trim();

  if (/^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
    return callback;
  }

  return "";
}

function getNotices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("공지사항");
  const values = sheet.getDataRange().getValues();

  const headers = values.shift();

  const notices = values.map(function(row) {
    let item = {};

    headers.forEach(function(header, index) {
      item[String(header).trim()] = row[index];
    });

    return item;
  });

  return notices
    .filter(function(item) {
      return String(item["제목"] || "").trim() !== "";
    })
    .reverse();
}

function getPartners() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("제휴업체");
  const values = sheet.getDataRange().getValues();

  const headers = values.shift();

  const partners = values.map(function(row) {
    let item = {};

    headers.forEach(function(header, index) {
      item[String(header).trim()] = row[index];
    });

    return item;
  });

  return partners.filter(function(item) {
    return String(item["노출"] || "").trim().toUpperCase() === "Y";
  });
}

function getMemberByCode(code) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("회원DB");
  const data = sheet.getDataRange().getValues();

  const header = data.shift();
  const targetCode = String(code || "").trim().toUpperCase();

  for (let row of data) {
    let member = {};

    header.forEach(function(h, i) {
      member[String(h).trim()] = row[i];
    });

    const memberCode = String(member["회원번호"] || "").trim().toUpperCase();

    if (memberCode === targetCode) {
      return member;
    }
  }

  return null;
}
