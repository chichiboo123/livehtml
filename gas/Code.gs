/**
 * Live HTML — 디자인 클라우드 저장용 Google Apps Script (v3)
 *
 * ============================================================
 * [처음 설치]
 * 1. https://script.google.com → [새 프로젝트], 이 코드 전체를 붙여넣고 저장
 * 2. 왼쪽 [프로젝트 설정(⚙️)] → 아래 [스크립트 속성] → [스크립트 속성 추가]
 *      속성: SECRET   값: 내가 정한 비밀번호(예: myclass-2026!)
 *    (이 비밀번호를 아는 사람만 백업/복원할 수 있어요. URL이 노출돼도 안전합니다.)
 * 3. [배포] → [새 배포] → 유형 '웹 앱'
 *      - 실행: 나 / 액세스 권한: '모든 사용자'
 * 4. [배포] → 권한 승인 → 발급된 '…/exec' 주소 복사
 * 5. Live HTML 관리자 모드 → [클라우드]에 '주소'와 '비밀번호'를 한 번만 입력
 *    (브라우저에 저장되어 다시 입력할 필요가 없어요)
 *
 * [코드를 수정(업데이트)한 경우 — 중요]
 *   저장만으로는 반영되지 않습니다.
 *   [배포] → [배포 관리] → ✏️수정 → 버전 '새 버전' → [배포] 를 해야
 *   같은 주소에 새 코드가 적용됩니다.
 *
 * [데이터 저장 위치]
 *   - 디자인 본문(이미지 포함): 내 Drive의 'livehtml-designs.json' 파일 1개
 *     (항상 같은 파일을 쓰도록 파일 ID를 스크립트 속성에 고정 → 복원 안정화)
 *   - 보기용 목록(이름/수정일/크기): 'Live HTML 디자인 목록' 스프레드시트 (자동)
 * ============================================================
 */

var PROP = PropertiesService.getScriptProperties();
var FILE_NAME = "livehtml-designs.json";
var INDEX_SS_NAME = "Live HTML 디자인 목록";

/** 항상 동일한 파일을 사용하도록 파일 ID를 스크립트 속성에 고정 */
function getFile_() {
  var id = PROP.getProperty("FILE_ID");
  if (id) {
    try { return DriveApp.getFileById(id); } catch (e) { /* 삭제됨 → 아래에서 재선택 */ }
  }
  // 같은 이름 파일이 여러 개면(이전 백업 흔적) 가장 큰(=데이터가 있는) 파일을 고름
  var it = DriveApp.getFilesByName(FILE_NAME);
  var best = null, bestSize = -1;
  while (it.hasNext()) {
    var f = it.next();
    var size = f.getSize();
    if (size > bestSize) { best = f; bestSize = size; }
  }
  if (best) { PROP.setProperty("FILE_ID", best.getId()); return best; }
  var nf = DriveApp.createFile(FILE_NAME, "[]", "application/json");
  PROP.setProperty("FILE_ID", nf.getId());
  return nf;
}

/** 비밀번호 검증: SECRET을 설정해 두면 일치할 때만 허용 */
function authOk_(token) {
  var secret = PROP.getProperty("SECRET");
  if (!secret) return true;            // 미설정이면 통과(하위호환). 보안을 위해 설정 권장!
  return String(token || "") === String(secret);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === "restore") {
    if (!authOk_(p.token)) return out_(JSON.stringify({ ok: false, error: "auth" }));
    var text = getFile_().getBlob().getDataAsString();
    return out_(text && text.length ? text : "[]");
  }
  // 연결 확인용
  return out_(JSON.stringify({
    ok: true,
    service: "livehtml-gas",
    version: 3,
    secretRequired: !!PROP.getProperty("SECRET")
  }));
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!authOk_(body.token)) return out_(JSON.stringify({ ok: false, error: "auth" }));

    if (body.action === "backup") {
      var designs = body.designs || [];
      getFile_().setContent(JSON.stringify(designs));
      updateIndexSheet_(designs);
      return out_(JSON.stringify({ ok: true, count: designs.length }));
    }
    return out_(JSON.stringify({ ok: false, error: "unknown action" }));
  } catch (err) {
    return out_(JSON.stringify({ ok: false, error: String(err) }));
  }
}

/** 보기용 목록 스프레드시트 갱신 (실패해도 백업 자체는 완료됨) */
function updateIndexSheet_(designs) {
  try {
    var ssId = PROP.getProperty("INDEX_SS_ID");
    var ss = null;
    if (ssId) { try { ss = SpreadsheetApp.openById(ssId); } catch (e) {} }
    if (!ss) {
      var it = DriveApp.getFilesByName(INDEX_SS_NAME);
      while (it.hasNext()) {
        var f = it.next();
        if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { ss = SpreadsheetApp.open(f); break; }
      }
      if (!ss) ss = SpreadsheetApp.create(INDEX_SS_NAME);
      PROP.setProperty("INDEX_SS_ID", ss.getId());
    }
    var sh = ss.getSheets()[0];
    sh.clear();
    sh.getRange(1, 1, 1, 5)
      .setValues([["이름", "수정일", "만든 날", "HTML 크기(자)", "ID"]])
      .setFontWeight("bold");
    if (designs.length) {
      var rows = designs.map(function (d) {
        return [
          d.name || "",
          d.updatedAt ? new Date(d.updatedAt) : "",
          d.createdAt ? new Date(d.createdAt) : "",
          (d.html || "").length,
          d.id || ""
        ];
      });
      sh.getRange(2, 1, rows.length, 5).setValues(rows);
    }
    sh.autoResizeColumns(1, 5);
  } catch (err) { /* 목록 갱신 실패는 무시 */ }
}

function out_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}
