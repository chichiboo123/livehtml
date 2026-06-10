/**
 * Live HTML — 디자인 클라우드 백업용 Google Apps Script
 *
 * [설치 방법]
 * 1. https://script.google.com 접속 → [새 프로젝트]
 * 2. 기본 코드를 지우고 이 파일 내용을 전부 붙여넣기 → 저장
 * 3. [배포] → [새 배포] → 유형: '웹 앱'
 *    - 다음 사용자 인증 정보로 실행: '나'
 *    - 액세스 권한이 있는 사용자: '모든 사용자'
 * 4. [배포] 클릭 → 권한 승인 → 발급된 '웹 앱 URL' 복사
 * 5. Live HTML 관리자 모드(로고 5번 클릭) → [클라우드]에 URL 붙여넣기
 *
 * 데이터는 내 Google Drive 루트의 'livehtml-designs.json' 파일 하나에 저장됩니다.
 * ⚠️ 이 URL을 아는 사람은 누구나 백업을 읽고 쓸 수 있으니 비밀로 관리하세요.
 */

var FILE_NAME = "livehtml-designs.json";

function getFile_() {
  var it = DriveApp.getFilesByName(FILE_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFile(FILE_NAME, "[]", "application/json");
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "restore") {
    return out_(getFile_().getBlob().getDataAsString());
  }
  return out_(JSON.stringify({ ok: true, service: "livehtml-gas" }));
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "backup") {
      var designs = body.designs || [];
      getFile_().setContent(JSON.stringify(designs));
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
