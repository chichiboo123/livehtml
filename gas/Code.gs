/**
 * Live HTML — 디자인 클라우드 백업용 Google Apps Script
 *
 * [설치 방법]
 * 1. https://script.google.com 접속 → [새 프로젝트]
 * 2. 기본 코드를 지우고 이 파일 내용을 전부 붙여넣기 → 저장
 * 3. [배포] → [새 배포] → 유형: '웹 앱'
 *    - 다음 사용자 인증 정보로 실행: '나'
 *    - 액세스 권한이 있는 사용자: '모든 사용자'
 * 4. [배포] 클릭 → 권한 승인 → 발급된 '웹 앱 URL'(…/exec) 복사
 * 5. Live HTML 관리자 모드(로고 5번 클릭) → [클라우드]에 URL 붙여넣기
 *
 * [코드를 수정(업데이트)했다면 — 매우 중요!]
 * 저장만 해서는 기존 URL에 반영되지 않습니다.
 * [배포] → [배포 관리] → 연필(수정) → 버전: '새 버전' → [배포]를 해야
 * 같은 URL로 새 코드가 적용됩니다. 새 권한이 필요하면 다시 승인하세요.
 *
 * [데이터가 저장되는 곳]
 * - 실제 디자인 전체(HTML 포함): 내 Drive의 'livehtml-designs.json' 파일 1개
 *   (HTML에는 이미지가 base64로 들어가 매우 길어서, 셀당 5만 자 제한이 있는
 *    스프레드시트에는 본문을 넣지 않습니다)
 * - 보기용 목록: 내 Drive의 'Live HTML 디자인 목록' 스프레드시트에
 *   이름/수정일/크기만 자동 기록됩니다 (백업할 때마다 갱신)
 *
 * ⚠️ 이 URL을 아는 사람은 누구나 백업을 읽고 쓸 수 있으니 비밀로 관리하세요.
 */

var FILE_NAME = "livehtml-designs.json";
var INDEX_SS_NAME = "Live HTML 디자인 목록";

function getFile_() {
  var it = DriveApp.getFilesByName(FILE_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFile(FILE_NAME, "[]", "application/json");
}

/** 보기용 목록 스프레드시트를 찾거나 만들어서 갱신 (실패해도 백업은 계속) */
function updateIndexSheet_(designs) {
  try {
    var ss = null;
    var it = DriveApp.getFilesByName(INDEX_SS_NAME);
    while (it.hasNext()) {
      var f = it.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
        ss = SpreadsheetApp.open(f);
        break;
      }
    }
    if (!ss) ss = SpreadsheetApp.create(INDEX_SS_NAME);
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
          d.id || "",
        ];
      });
      sh.getRange(2, 1, rows.length, 5).setValues(rows);
    }
    sh.autoResizeColumns(1, 5);
  } catch (err) {
    // 시트 기록 실패는 무시 (백업 자체는 JSON 파일로 완료됨)
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "restore") {
    return out_(getFile_().getBlob().getDataAsString());
  }
  return out_(JSON.stringify({ ok: true, service: "livehtml-gas", version: 2 }));
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
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

function out_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}
