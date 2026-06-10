# Live HTML

HTML로 만든 **카드뉴스 · 인포그래픽 · PPT · 포스터**를 코드를 몰라도
캔바(Canva)처럼 화면에서 바로 고치고, 수정된 HTML과 PNG로 받아볼 수 있는 웹앱입니다.

## 주요 기능

- **불러오기** — HTML 파일 업로드, 클립보드 붙여넣기, 드래그 & 드롭
- **실시간 미리보기** — 코드를 수정하면 결과가 즉시 반영
- **화면에서 바로 편집 (편집 모드)**
  - 한 번 클릭: 요소 선택 → 글자 크기·굵기·기울임·색상·정렬 변경
  - 두 번 클릭: 텍스트 내용 수정
  - 드래그: 요소 위치 이동
  - 복제 / 삭제 / 위치 초기화 / 이미지 교체
  - 화면에서 수정한 내용은 HTML 코드에 자동 반영
- **실행 취소 / 다시 실행** (Ctrl+Z / Ctrl+Y)
- **내보내기** — 수정된 HTML 복사·다운로드, 페이지별 PNG 이미지 다운로드, 파일 공유(모바일)
- **PC · 모바일 반응형** — 모바일에서는 코드/미리보기 탭 전환

## 디자인

- 버튼 등 UI 컴포넌트는 [KRDS(대한민국 디자인시스템)](https://www.krds.go.kr) 가이드라인을 따릅니다.
- 아이콘은 [Google Material Symbols](https://fonts.google.com/icons)를 사용합니다.
- 글꼴은 Pretendard를 사용합니다.

## 실행 방법

빌드 과정 없이 정적 파일만으로 동작합니다.

```bash
# 아무 정적 서버로 열기 (예시)
npx http-server .
# 또는 index.html을 브라우저에서 직접 열기
```

> PNG 내보내기는 [html2canvas](https://html2canvas.hertzen.com/) CDN을 사용하므로 인터넷 연결이 필요합니다.

---

Created by. [교육뮤지컬 꿈꾸는 치수쌤](https://litt.ly/chichiboo)
