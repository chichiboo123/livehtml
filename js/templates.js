/* ============================================================
 * Live HTML — 템플릿 라이브러리
 * 테마(색·글꼴·장식·문구) × 포맷(카드뉴스/포스터/PPT)을 조합해
 * 같은 테마로 통일된 콘텐츠 세트를 만들 수 있다.
 *
 * 카드뉴스: 표지 → 목차 → 텍스트 → 이미지 → 마무리 멘트 → 아웃트로 (6장)
 * PPT:     표지 → 목차 → 텍스트 → 이미지 → 끝인사 (5장)
 * 포스터:  1장
 *
 * 영감의 원천(오마주): 동화·판타지·명화·음악 등에서 '감성'만 빌려오고
 * 실제 작품의 글·캐릭터·상표는 사용하지 않는다.
 * ============================================================ */
(function () {
  "use strict";

  // k: 1080 기준으로 디자인된 글자/여백 크기의 배율
  const FORMATS = {
    cardnews: { id: "cardnews", name: "카드뉴스", w: 1920, h: 1920, icon: "crop_square", k: 1.78 },
    poster:   { id: "poster",   name: "포스터",   w: 794,  h: 1123, icon: "description", k: 0.8 },
    slides:   { id: "slides",   name: "PPT 슬라이드", w: 1920, h: 1080, icon: "slideshow", k: 1.1 },
  };

  /* ---------- 장식 헬퍼 ---------- */
  const dot = (x, y, s, c, extra = "") =>
    `<div style="position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s}px;border-radius:50%;background:${c};${extra}"></div>`;
  const blob = (x, y, w, h, c, blur = 30, extra = "") =>
    `<div style="position:absolute;left:${x}%;top:${y}%;width:${w}px;height:${h}px;border-radius:50%;background:${c};filter:blur(${blur}px);${extra}"></div>`;

  /* ============================================================
   * 테마 정의
   *  page: 페이지 배경 / pageSolid: 장식용 단색(행성·달 등에 사용)
   *  surface: 본문 카드 배경 / ink: 글자색 / sub: 보조 글자색
   * ============================================================ */
  const THEMES = [
    {
      id: "littleprince", emoji: "🌹", name: "어린왕자",
      desc: "파스텔 사막의 노을, 작은 별과 장미 한 송이",
      tags: ["어린왕자", "동화", "파스텔", "별"],
      page: "linear-gradient(180deg,#FDF2E0 0%,#FBE3C9 60%,#F6D7BC 100%)", pageSolid: "#FCEBD3",
      ink: "#5A4632", sub: "#9A8569", primary: "#F2B33D", accent: "#8FB8DE", badgeInk: "#5A4400",
      surface: "rgba(255,255,255,.62)", radius: "22px",
      headFont: "'Gowun Batang', serif", bodyFont: "'Gowun Dodum', sans-serif",
      fonts: ["Gowun Batang", "Gowun Dodum"],
      sample: {
        badge: "B-612에서 온 편지", title: "가장 중요한 건<br>눈에 보이지 않아",
        sub: "마음으로 읽어 주길 바라는 이야기를<br>여기에 적어 보세요.",
        outro: "네 장미가 소중한 건,<br>네가 들인 시간 때문이야",
      },
      decor: (t) =>
        dot(12, 14, 7, t.primary, "opacity:.9;") + dot(22, 8, 4, t.primary, "opacity:.7;") +
        dot(80, 10, 5, t.accent, "opacity:.8;") + dot(88, 30, 4, t.primary, "opacity:.7;") +
        dot(7, 38, 4, t.accent, "opacity:.6;") +
        // 파스텔 행성과 고리
        `<div style="position:absolute;top:7%;right:8%;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#FBD9A8,#F2B97E);"></div>` +
        `<div style="position:absolute;top:10.4%;right:5%;width:150px;height:30px;border:3px solid ${t.accent};border-radius:50%;transform:rotate(-16deg);opacity:.75;"></div>` +
        // 장미 한 송이
        `<div style="position:absolute;left:9%;bottom:9%;width:3px;height:64px;background:#9DBA8B;"></div>` +
        `<div style="position:absolute;left:9%;bottom:14.5%;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#E08E8E;transform:translateX(-9px) rotate(-45deg);"></div>`,
    },
    {
      id: "ballpark", emoji: "⚾", name: "야구장",
      desc: "초록 잔디와 워닝트랙 — 9회말의 설렘",
      tags: ["야구", "스포츠", "잔디", "응원"],
      page: "linear-gradient(180deg,#2E7D46 0%,#3C9457 78%,#3C9457 100%)", pageSolid: "#338A4E",
      ink: "#FFFFFF", sub: "rgba(255,255,255,.82)", primary: "#D9483B", accent: "#A4702F", badgeInk: "#FFFFFF",
      surface: "rgba(255,255,255,.14)", radius: "16px",
      headFont: "'Black Han Sans', sans-serif", bodyFont: "'Gothic A1', sans-serif",
      fonts: ["Black Han Sans", "Gothic A1"],
      sample: {
        badge: "PLAY BALL", title: "9회말,<br>우리의 이야기가 시작된다",
        sub: "응원하고 싶은 내용을 적어 보세요.<br>오늘의 선발은 바로 당신!",
        outro: "끝날 때까지<br>끝난 게 아니다",
      },
      decor: (t) =>
        // 워닝트랙(갈색 띠) + 파울 라인
        `<div style="position:absolute;left:0;right:0;bottom:0;height:10%;background:${t.accent};"></div>` +
        `<div style="position:absolute;left:0;right:0;bottom:10%;height:5px;background:#FFFFFF;opacity:.9;"></div>` +
        // 베이스
        `<div style="position:absolute;left:8%;top:10%;width:30px;height:30px;background:#F8F4EA;transform:rotate(45deg);opacity:.92;box-shadow:0 2px 4px rgba(0,0,0,.2);"></div>` +
        // 야구공 (실밥 두 줄)
        `<div style="position:absolute;top:7%;right:8%;width:76px;height:76px;border-radius:50%;background:#F8F4EA;overflow:hidden;box-shadow:0 3px 8px rgba(0,0,0,.3);">` +
        `<div style="position:absolute;left:-48px;top:-9px;width:94px;height:94px;border-radius:50%;border:3px dashed ${t.primary};"></div>` +
        `<div style="position:absolute;right:-48px;top:-9px;width:94px;height:94px;border-radius:50%;border:3px dashed ${t.primary};"></div>` +
        `</div>`,
    },
    {
      id: "wizard", emoji: "🪄", name: "마법 아카데미",
      desc: "촛불 켜진 도서관과 황금 문장 — 클래식 판타지",
      tags: ["판타지", "마법", "클래식", "학교"],
      page: "linear-gradient(165deg,#11271F 0%,#1E3D31 100%)", pageSolid: "#163026",
      ink: "#F3E9D2", sub: "rgba(243,233,210,.75)", primary: "#C9A227", badgeInk: "#241B00",
      surface: "rgba(243,233,210,.08)", radius: "14px",
      headFont: "'Song Myung', serif", bodyFont: "'Gowun Dodum', sans-serif",
      fonts: ["Song Myung", "Gowun Dodum"],
      sample: {
        badge: "비밀의 수업", title: "오늘 밤,<br>마법 수업이 열립니다",
        sub: "신비한 주제를 소개하는 문장을 적어 보세요.<br>지팡이는 준비되었나요?",
        outro: "주문은 단 하나,<br>꾸준함 ✨",
      },
      decor: (t) =>
        `<div style="position:absolute;inset:22px;border:1.5px solid ${t.primary};outline:1.5px solid ${t.primary};outline-offset:5px;opacity:.55;pointer-events:none;"></div>` +
        `<div style="position:absolute;top:3.2%;left:50%;transform:translateX(-50%);color:${t.primary};font-size:22px;">✦</div>` +
        `<div style="position:absolute;bottom:3.2%;left:50%;transform:translateX(-50%);color:${t.primary};font-size:22px;">✦</div>`,
    },
    {
      id: "waterlily", emoji: "🪷", name: "수련 연못",
      desc: "빛과 물결의 인상주의 파스텔 — 명화 감성",
      tags: ["명화", "모네", "수채", "파스텔"],
      page: "linear-gradient(160deg,#DCE9E2 0%,#CBD8EC 55%,#E8D9E6 100%)", pageSolid: "#D5E2E6",
      ink: "#3C4A5A", sub: "#6C7A8C", primary: "#7E96C4", badgeInk: "#FFFFFF",
      surface: "rgba(255,255,255,.6)", radius: "26px",
      headFont: "'Nanum Myeongjo', serif", bodyFont: "'Gowun Dodum', sans-serif",
      fonts: ["Nanum Myeongjo", "Gowun Dodum"],
      sample: {
        badge: "오늘의 그림", title: "빛이 머무는<br>연못가에서",
        sub: "잔잔한 주제를 부드럽게 소개해 보세요.<br>물결처럼 천천히, 색처럼 은은하게.",
        outro: "오늘도 한 폭의<br>그림 같은 하루 🎨",
      },
      decor: (t) =>
        blob(-6, 62, 260, 180, "rgba(217,143,165,.5)", 36) +
        blob(70, -8, 280, 200, "rgba(126,150,196,.4)", 40) +
        blob(58, 70, 220, 150, "rgba(151,191,168,.55)", 34),
    },
    {
      id: "moonwalk", emoji: "🕺", name: "문워크",
      desc: "블랙 & 레드, 무대 위의 한 걸음 — 팝의 전설 감성",
      tags: ["음악", "팝", "블랙", "무대"],
      page: "#101010", pageSolid: "#101010",
      ink: "#FFFFFF", sub: "rgba(255,255,255,.7)", primary: "#E4002B", badgeInk: "#FFFFFF",
      surface: "rgba(255,255,255,.07)", radius: "0",
      headFont: "'Black Han Sans', sans-serif", bodyFont: "'IBM Plex Sans KR', sans-serif",
      fonts: ["Black Han Sans", "IBM Plex Sans KR"],
      sample: {
        badge: "STAGE 01", title: "무대는 준비됐다,<br>이제 너의 차례",
        sub: "리듬감 있는 주제를 강렬하게 던져 보세요.<br>한 걸음이면 충분합니다.",
        outro: "Beat it,<br>그리고 시작해 🎤",
      },
      decor: (t) =>
        `<div style="position:absolute;left:-12%;top:64%;width:130%;height:16px;background:${t.primary};transform:rotate(-7deg);"></div>` +
        `<div style="position:absolute;left:-12%;top:64%;width:130%;height:4px;background:#fff;transform:rotate(-7deg) translateY(26px);opacity:.65;"></div>` +
        dot(84, 10, 10, "#fff", "opacity:.9;") + dot(90, 16, 5, "#fff", "opacity:.6;"),
    },
    {
      id: "neon", emoji: "🌃", name: "네온 시티",
      desc: "밤거리의 네온사인 — 사이버 감성",
      tags: ["네온", "미래", "게임", "야간"],
      page: "linear-gradient(180deg,#0D0221 0%,#1A0B3B 100%)", pageSolid: "#120631",
      ink: "#EAF6FF", sub: "rgba(234,246,255,.7)", primary: "#00E5FF", accent: "#FF2E92", badgeInk: "#001318",
      surface: "rgba(0,229,255,.08)", radius: "12px",
      headFont: "'Orbit', sans-serif", bodyFont: "'IBM Plex Sans KR', sans-serif",
      fonts: ["Orbit", "IBM Plex Sans KR"],
      sample: {
        badge: "NIGHT CITY", title: "도시의 밤은<br>지금부터 시작",
        sub: "반짝이는 아이디어를 네온처럼 켜 보세요.<br>어두울수록 더 빛납니다.",
        outro: "내일 밤,<br>또 만나요 ⚡",
      },
      decor: (t) =>
        `<div style="position:absolute;inset:26px;border:2px solid ${t.primary};border-radius:14px;box-shadow:0 0 18px ${t.primary},inset 0 0 18px rgba(0,229,255,.35);opacity:.5;pointer-events:none;"></div>` +
        blob(64, 4, 220, 130, "rgba(255,46,146,.45)", 46) +
        blob(-4, 70, 200, 140, "rgba(0,229,255,.35)", 46),
    },
    {
      id: "hanji", emoji: "🖌️", name: "조선의 서재",
      desc: "한지와 먹, 붉은 낙관 — 단정한 전통미",
      tags: ["전통", "한국", "서예", "차분함"],
      page: "#F5EFE3", pageSolid: "#F5EFE3",
      ink: "#2B2B2B", sub: "#6B6457", primary: "#B5402C", badgeInk: "#FFF7ED",
      surface: "rgba(43,43,43,.05)", radius: "6px",
      headFont: "'Gowun Batang', serif", bodyFont: "'Gowun Batang', serif",
      fonts: ["Gowun Batang"],
      sample: {
        badge: "기록", title: "오늘의 마음을<br>붓끝에 담다",
        sub: "정갈한 주제를 차분히 적어 보세요.<br>여백이 곧 멋이 됩니다.",
        outro: "쓰는 만큼<br>깊어집니다 🖋️",
      },
      decor: (t) =>
        `<div style="position:absolute;top:26px;left:8%;right:8%;height:0;border-top:1.5px solid ${t.ink};opacity:.5;"></div>` +
        `<div style="position:absolute;top:33px;left:8%;right:8%;height:0;border-top:.5px solid ${t.ink};opacity:.4;"></div>` +
        `<div style="position:absolute;bottom:26px;left:8%;right:8%;height:0;border-bottom:1.5px solid ${t.ink};opacity:.5;"></div>` +
        `<div style="position:absolute;right:7%;bottom:6%;width:52px;height:52px;background:${t.primary};color:#FFF7ED;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;border-radius:6px;">글</div>`,
    },
    {
      id: "popart", emoji: "🎪", name: "팝아트 스튜디오",
      desc: "쨍한 원색과 도트 — 유쾌한 팝아트",
      tags: ["팝아트", "비비드", "유쾌", "도트"],
      page: "#FFD93B", pageSolid: "#FFD93B",
      ink: "#1E2124", sub: "#4A4632", primary: "#FF3B30", accent: "#2D6CDF", badgeInk: "#FFFFFF",
      surface: "rgba(255,255,255,.78)", radius: "16px",
      headFont: "'Black Han Sans', sans-serif", bodyFont: "'Jua', sans-serif",
      fonts: ["Black Han Sans", "Jua"],
      sample: {
        badge: "WOW!", title: "심심한 하루에<br>색을 입히자!",
        sub: "톡톡 튀는 주제를 신나게 소개해 보세요.<br>망설이면 늦어요!",
        outro: "오늘도<br>팝하게! 🎉",
      },
      decor: (t) =>
        `<div style="position:absolute;right:-40px;top:-40px;width:240px;height:240px;border-radius:50%;background:${t.accent};opacity:.9;"></div>` +
        `<div style="position:absolute;left:0;bottom:0;width:46%;height:34%;background-image:radial-gradient(${t.ink} 2.5px, transparent 3px);background-size:18px 18px;opacity:.16;"></div>`,
    },
    {
      id: "space", emoji: "🚀", name: "우주 정거장",
      desc: "성운과 행성 사이 — 깊고 신비로운 우주",
      tags: ["우주", "과학", "신비", "탐험"],
      page: "linear-gradient(180deg,#0B0F2B 0%,#2B1055 100%)", pageSolid: "#181243",
      ink: "#ECEAFF", sub: "rgba(236,234,255,.72)", primary: "#8E7CFF", accent: "#4ADEDE", badgeInk: "#120E33",
      surface: "rgba(142,124,255,.12)", radius: "22px",
      headFont: "'Black Han Sans', sans-serif", bodyFont: "'Gothic A1', sans-serif",
      fonts: ["Black Han Sans", "Gothic A1"],
      sample: {
        badge: "MISSION LOG", title: "지구를 떠나<br>아이디어 궤도로",
        sub: "넓고 깊은 주제를 탐사하듯 적어 보세요.<br>3, 2, 1… 발사!",
        outro: "다음 행성에서<br>만나요 🪐",
      },
      decor: (t) =>
        dot(10, 10, 3, "#fff", "opacity:.8;") + dot(20, 30, 2, "#fff", "opacity:.6;") +
        dot(82, 12, 3, "#fff", "opacity:.8;") + dot(90, 44, 2, "#fff", "opacity:.6;") +
        dot(6, 60, 2, "#fff", "opacity:.5;") +
        `<div style="position:absolute;right:6%;top:8%;width:92px;height:92px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#B7AFFF,#5E4DC9);"></div>` +
        `<div style="position:absolute;right:3.2%;top:11.4%;width:140px;height:26px;border:3px solid ${t.accent};border-radius:50%;transform:rotate(-18deg);opacity:.8;"></div>`,
    },
    {
      id: "watercolor", emoji: "🌸", name: "봄날의 수채화",
      desc: "번지는 분홍과 민트 — 포근한 봄",
      tags: ["수채화", "봄", "파스텔", "포근함"],
      page: "#FFF9F5", pageSolid: "#FFF9F5",
      ink: "#5B5147", sub: "#8C8177", primary: "#E58FA6", badgeInk: "#FFFFFF",
      surface: "rgba(229,143,166,.1)", radius: "26px",
      headFont: "'Gowun Dodum', sans-serif", bodyFont: "'Gowun Dodum', sans-serif",
      fonts: ["Gowun Dodum", "Nanum Pen Script"],
      sample: {
        badge: "봄 편지", title: "마음이 몽글몽글<br>피어나는 계절",
        sub: "따뜻한 소식을 수채화처럼 번지게 적어 보세요.",
        outro: "활짝 핀 하루<br>보내세요 🌷",
      },
      decor: (t) =>
        blob(-8, -8, 260, 200, "rgba(249,200,211,.8)", 42) +
        blob(72, 66, 240, 190, "rgba(205,235,221,.9)", 44) +
        blob(78, -10, 180, 150, "rgba(255,236,179,.8)", 40),
    },
    {
      id: "jazz", emoji: "🎷", name: "미드나잇 재즈",
      desc: "황동빛 아르데코와 짙은 남색 — 어른의 밤",
      tags: ["재즈", "아르데코", "고급", "밤"],
      page: "#101820", pageSolid: "#101820",
      ink: "#F4EFE6", sub: "rgba(244,239,230,.7)", primary: "#C8A95B", badgeInk: "#1E1809",
      surface: "rgba(200,169,91,.1)", radius: "8px",
      headFont: "'Noto Serif KR', serif", bodyFont: "'Gowun Dodum', sans-serif",
      fonts: ["Noto Serif KR", "Gowun Dodum"],
      sample: {
        badge: "TONIGHT", title: "오늘 밤의 무드는<br>느린 스윙으로",
        sub: "깊고 우아한 주제를 잔처럼 천천히 채워 보세요.",
        outro: "음악이 끝나도<br>여운은 남도록 🥂",
      },
      decor: (t) =>
        `<div style="position:absolute;inset:24px;border:1px solid ${t.primary};opacity:.6;pointer-events:none;"></div>` +
        `<div style="position:absolute;inset:32px;border:1px solid ${t.primary};opacity:.35;pointer-events:none;"></div>` +
        `<div style="position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:180px;height:10px;background:repeating-linear-gradient(90deg,${t.primary} 0 8px,transparent 8px 16px);opacity:.7;"></div>`,
    },
    {
      id: "mint", emoji: "🍀", name: "민트 클래스",
      desc: "깔끔한 민트와 화이트 — 교육·정보 기본형",
      tags: ["교육", "깔끔", "기본", "정보"],
      page: "#F2FBF8", pageSolid: "#F2FBF8",
      ink: "#1E2124", sub: "#5F6B66", primary: "#1FA67A", accent: "#FFD66B", badgeInk: "#FFFFFF",
      surface: "#FFFFFF", radius: "18px",
      headFont: "'Jua', sans-serif", bodyFont: "'Gothic A1', sans-serif",
      fonts: ["Jua", "Gothic A1"],
      sample: {
        badge: "오늘의 배움", title: "쉽고 단단하게<br>핵심만 쏙쏙",
        sub: "배울 내용을 한 줄로 정리해 보세요.<br>심플할수록 잘 보여요.",
        outro: "오늘도<br>한 뼘 성장! 🌱",
      },
      decor: (t) =>
        `<div style="position:absolute;left:0;top:0;width:100%;height:14px;background:${t.primary};"></div>` +
        dot(86, 78, 90, t.accent, "opacity:.5;filter:blur(2px);"),
    },
    {
      id: "newsprint", emoji: "🗞️", name: "오늘의 신문",
      desc: "가판대 신문의 활자 냄새 — 빈티지 정보형",
      tags: ["신문", "빈티지", "정보", "활자"],
      page: "#F4F1E8", pageSolid: "#F4F1E8",
      ink: "#181818", sub: "#5E5A50", primary: "#B3001B", badgeInk: "#FFFFFF",
      surface: "rgba(24,24,24,.04)", radius: "0",
      headFont: "'Noto Serif KR', serif", bodyFont: "'Noto Serif KR', serif",
      fonts: ["Noto Serif KR"],
      sample: {
        badge: "EXTRA", title: "호외! 오늘의<br>소식을 전합니다",
        sub: "전하고 싶은 뉴스를 헤드라인처럼 적어 보세요.",
        outro: "다음 호도<br>기대하세요 📮",
      },
      decor: (t) =>
        `<div style="position:absolute;top:22px;left:6%;right:6%;border-top:3px double ${t.ink};opacity:.8;"></div>` +
        `<div style="position:absolute;bottom:22px;left:6%;right:6%;border-bottom:3px double ${t.ink};opacity:.8;"></div>` +
        `<div style="position:absolute;right:6%;top:5%;padding:6px 12px;border:2px solid ${t.primary};color:${t.primary};font-weight:800;font-size:18px;transform:rotate(8deg);">제1호</div>`,
    },
    {
      id: "forest", emoji: "🌿", name: "초록 숲의 아침",
      desc: "이슬 맺힌 잎사귀와 햇살 — 자연 힐링",
      tags: ["자연", "숲", "힐링", "초록"],
      page: "linear-gradient(180deg,#E8F3E2 0%,#CFE8CF 100%)", pageSolid: "#DBEDD8",
      ink: "#2F4A3C", sub: "#5F7A6B", primary: "#4C8C5C", accent: "#F2B264", badgeInk: "#FFFFFF",
      surface: "rgba(255,255,255,.66)", radius: "24px",
      headFont: "'Gowun Dodum', sans-serif", bodyFont: "'Gothic A1', sans-serif",
      fonts: ["Gowun Dodum", "Gothic A1"],
      sample: {
        badge: "숲의 인사", title: "잠시 쉬어 가도<br>괜찮아요",
        sub: "마음이 편안해지는 이야기를 적어 보세요.<br>숲은 서두르지 않습니다.",
        outro: "초록처럼<br>무성한 하루 🌳",
      },
      decor: (t) =>
        blob(-6, -10, 240, 200, "rgba(76,140,92,.25)", 30) +
        blob(74, 70, 220, 180, "rgba(242,178,100,.3)", 34) +
        dot(12, 74, 14, t.primary, "opacity:.5;") + dot(18, 80, 8, t.primary, "opacity:.35;"),
    },
  ];

  /* ============================================================
   * 빌더
   * ============================================================ */
  const px = (n, k) => Math.round(n * k) + "px";

  function fontLinks(families) {
    return families
      .map((f) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${f.replace(/ /g, "+")}&display=swap">`)
      .join("\n");
  }

  function baseCss(t, fmt) {
    const k = fmt.k;
    return `
  :root {
    --primary: ${t.primary};
    --accent: ${t.accent || t.primary};
    --ink: ${t.ink};
    --sub: ${t.sub};
    --surface: ${t.surface};
  }
  body { margin: 0; padding: 40px; background: #E9EDF2; display: flex; flex-direction: column; align-items: center; gap: 40px; font-family: ${t.bodyFont}; }
  .page { width: ${fmt.w}px; height: ${fmt.h}px; box-sizing: border-box; position: relative; overflow: hidden; background: ${t.page}; color: var(--ink); display: flex; flex-direction: column; justify-content: center; padding: ${px(100, k)}; }
  .badge { align-self: flex-start; background: var(--primary); color: ${t.badgeInk || "#fff"}; font-weight: 700; font-size: ${px(26, k)}; padding: ${px(10, k)} ${px(26, k)}; border-radius: 999px; letter-spacing: .08em; }
  h1 { font-family: ${t.headFont}; font-size: ${px(84, k)}; font-weight: 800; line-height: 1.28; letter-spacing: -0.01em; margin: ${px(34, k)} 0 ${px(20, k)}; }
  .sub { font-size: ${px(30, k)}; line-height: 1.65; color: var(--sub); margin: 0; }
  .center { align-items: center; text-align: center; }
  .center .badge { align-self: center; }
  h2 { font-family: ${t.headFont}; font-size: ${px(52, k)}; font-weight: 800; margin: 0 0 ${px(40, k)}; }
  .toc-row { display: flex; align-items: baseline; gap: ${px(24, k)}; font-size: ${px(34, k)}; padding: ${px(24, k)} ${px(6, k)}; border-bottom: 1.5px dashed var(--sub); }
  .toc-row .num { font-family: ${t.headFont}; font-size: ${px(30, k)}; font-weight: 800; color: var(--primary); }
  .body-text { font-size: ${px(28, k)}; line-height: 1.85; margin: 0 0 ${px(22, k)}; }
  .hl { background: var(--surface); border-left: ${px(8, k)} solid var(--primary); border-radius: ${t.radius}; padding: ${px(24, k)} ${px(30, k)}; font-size: ${px(27, k)}; line-height: 1.7; margin-top: ${px(10, k)}; }
  .imgph { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${px(12, k)}; height: 52%; border: 3px dashed var(--sub); border-radius: ${t.radius}; background: var(--surface); color: var(--sub); font-size: ${px(26, k)}; text-align: center; line-height: 1.6; }
  .imgph .ph-ic { font-size: ${px(64, k)}; line-height: 1; }
  .caption { margin-top: ${px(18, k)}; font-size: ${px(23, k)}; color: var(--sub); text-align: center; }
  .quote-mark { font-family: ${t.headFont}; font-size: ${px(96, k)}; line-height: .8; color: var(--primary); }
  .quote { font-family: ${t.headFont}; font-size: ${px(60, k)}; font-weight: 800; line-height: 1.5; margin: ${px(18, k)} 0 ${px(22, k)}; }
  .cta { display: flex; gap: ${px(14, k)}; justify-content: center; flex-wrap: wrap; margin-top: ${px(34, k)}; }
  .cta span { background: var(--surface); border-radius: 999px; padding: ${px(12, k)} ${px(26, k)}; font-size: ${px(25, k)}; font-weight: 700; }
  .foot { position: absolute; left: ${px(100, k)}; bottom: ${px(56, k)}; font-size: ${px(22, k)}; font-weight: 700; color: var(--sub); }
  .pagenum { position: absolute; right: ${px(60, k)}; bottom: ${px(48, k)}; font-size: ${px(21, k)}; font-weight: 700; color: var(--sub); }
  .info { background: var(--surface); border-radius: ${t.radius}; padding: ${px(30, k)} ${px(36, k)}; margin-top: ${px(40, k)}; }
  .row { display: flex; gap: ${px(18, k)}; font-size: ${px(26, k)}; line-height: 1.6; margin: ${px(8, k)} 0; }
  .row b { flex: none; width: ${px(96, k)}; color: var(--primary); }
  .decor { position: absolute; inset: 0; pointer-events: none; }`;
  }

  const head = (t, fmt, title) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${title}</title>
${fontLinks(t.fonts)}
<style>${baseCss(t, fmt)}
</style>
</head>
<body>`;

  /** 장식은 1080 기준 px로 그려졌으므로 포맷 배율(k)에 맞춰 통째로 확대/축소 */
  function decorOf(t, k) {
    const inv = (100 / k).toFixed(4);
    return `<div class="decor"><div style="position:absolute;left:0;top:0;width:${inv}%;height:${inv}%;transform:scale(${k});transform-origin:top left;">${t.decor(t)}</div></div>`;
  }

  /* ---------- 페이지들 ---------- */
  const coverPage = (t, fmt) => `  <div class="page center">
    ${decorOf(t, fmt.k)}
    <span class="badge">${t.sample.badge}</span>
    <h1>${t.sample.title}</h1>
    <p class="sub">${t.sample.sub}</p>
    <div class="foot" style="left:50%;transform:translateX(-50%);">@내이름</div>
  </div>`;

  const tocPage = (t, fmt, total) => `  <div class="page">
    <h2>목차</h2>
    <div class="toc-row"><span class="num">01</span><span>첫 번째 이야기 — 제목을 적어 주세요</span></div>
    <div class="toc-row"><span class="num">02</span><span>두 번째 이야기 — 제목을 적어 주세요</span></div>
    <div class="toc-row"><span class="num">03</span><span>세 번째 이야기 — 제목을 적어 주세요</span></div>
    <div class="toc-row" style="border-bottom:none;"><span class="num">04</span><span>마무리하며</span></div>
    <span class="pagenum">2 / ${total}</span>
  </div>`;

  const textPage = (t, fmt, total) => `  <div class="page">
    <h2>01. 첫 번째 이야기</h2>
    <p class="body-text">본문 내용을 입력하세요. 두 번 누르면 바로 고칠 수 있어요.
    문장은 짧게, 줄은 여유 있게 쓰면 읽기 편한 카드가 됩니다.</p>
    <p class="body-text">이어지는 내용을 적어 보세요. 숫자나 사례를 곁들이면
    설득력이 높아져요.</p>
    <div class="hl">💡 꼭 기억할 한 문장을 여기에 강조해 보세요.</div>
    <span class="pagenum">3 / ${total}</span>
  </div>`;

  const imagePage = (t, fmt, total) => `  <div class="page">
    <h2>02. 두 번째 이야기</h2>
    <div class="imgph"><span class="ph-ic">🖼️</span>이 상자를 지우고, 오른쪽 아래 + 버튼으로<br>이미지를 넣어 주세요</div>
    <p class="caption">이미지 설명(캡션)을 적어 주세요.</p>
    <span class="pagenum">4 / ${total}</span>
  </div>`;

  const closingPage = (t, fmt, total) => `  <div class="page center">
    ${decorOf(t, fmt.k)}
    <div class="quote-mark">“</div>
    <div class="quote">${t.sample.outro}</div>
    <p class="sub">마음에 남길 한 문장으로 마무리해 보세요.</p>
    <span class="pagenum">5 / ${total}</span>
  </div>`;

  const outroPage = (t, fmt) => `  <div class="page center">
    ${decorOf(t, fmt.k)}
    <span class="badge">@내이름</span>
    <h1>함께 읽어 주셔서<br>고마워요</h1>
    <p class="sub">다음 이야기로 또 만나요!</p>
    <div class="cta"><span>❤️ 좋아요</span><span>📌 저장</span><span>✈️ 공유</span></div>
  </div>`;

  const thanksPage = (t, fmt) => `  <div class="page center">
    ${decorOf(t, fmt.k)}
    <h1>감사합니다</h1>
    <p class="sub">질문은 언제든 환영해요 · @내이름</p>
  </div>`;

  const posterPage = (t, fmt) => `  <div class="page">
    ${decorOf(t, fmt.k)}
    <span class="badge">${t.sample.badge}</span>
    <h1>${t.sample.title}</h1>
    <p class="sub">${t.sample.sub}</p>
    <div class="info">
      <div class="row"><b>일시</b><span>0000년 00월 00일 (요일) 00:00</span></div>
      <div class="row"><b>장소</b><span>장소를 입력하세요</span></div>
      <div class="row"><b>대상</b><span>누구나 환영해요</span></div>
    </div>
    <div class="foot">주최 · 주관 | 단체 이름</div>
  </div>`;

  function buildTemplate(themeId, formatId) {
    const t = THEMES.find((x) => x.id === themeId);
    const fmt = FORMATS[formatId] || FORMATS.cardnews;
    if (!t) return buildBlank(formatId);
    let body;
    if (fmt.id === "poster") {
      body = posterPage(t, fmt);
    } else if (fmt.id === "slides") {
      // 표지 → 목차 → 텍스트 → 이미지 → 끝인사 (5장)
      body = [coverPage(t, fmt), tocPage(t, fmt, 5), textPage(t, fmt, 5), imagePage(t, fmt, 5), thanksPage(t, fmt)].join("\n\n");
    } else {
      // 표지 → 목차 → 텍스트 → 이미지 → 마무리 멘트 → 아웃트로 (6장)
      body = [coverPage(t, fmt), tocPage(t, fmt, 6), textPage(t, fmt, 6), imagePage(t, fmt, 6), closingPage(t, fmt, 6), outroPage(t, fmt)].join("\n\n");
    }
    return `${head(t, fmt, `${t.name} ${fmt.name}`)}
${body}
</body>
</html>`;
  }

  function buildBlank(formatId) {
    const fmt = FORMATS[formatId] || FORMATS.cardnews;
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>새 ${fmt.name}</title>
<style>
  body { margin: 0; padding: 40px; background: #E9EDF2; font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; display: flex; flex-direction: column; align-items: center; gap: 40px; }
  .page { width: ${fmt.w}px; height: ${fmt.h}px; background: #ffffff; box-shadow: 0 4px 24px rgba(0,0,0,.08); position: relative; box-sizing: border-box; }
</style>
</head>
<body>
  <div class="page"><!-- 오른쪽 아래 + 버튼으로 글자·도형·이미지를 추가하세요 --></div>
</body>
</html>`;
  }

  window.LiveHTMLTemplates = { FORMATS, THEMES, buildTemplate, buildBlank };
})();
