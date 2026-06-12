/* ============================================================
 * Live HTML — 실시간 HTML 편집기
 * 코드 ↔ 미리보기 양방향 동기화, 캔바식 인라인 편집, PNG 내보내기
 * ============================================================ */
(() => {
  "use strict";

  /* ============================================================
   * 환경설정 — 여기에 값을 미리 넣어두면 매번 입력하지 않아도 돼요.
   * 예) GAS_URL: "https://script.google.com/macros/s/AKfy…/exec"
   *     AUTO_SYNC: true  → 디자인을 저장할 때마다 자동으로 클라우드 백업
   * (비워 두면 앱 안에서 직접 입력한 값이 브라우저에 저장돼 계속 기억됩니다.)
   * ============================================================ */
  const CONFIG = {
    GAS_URL: "",
    GAS_TOKEN: "",   // 비밀번호. 보통은 비워 두고 앱에서 한 번만 입력하세요(공개 저장소 노출 방지)
    AUTO_SYNC: false,
  };

  const $ = (sel) => document.querySelector(sel);

  const codeInput = $("#codeInput");
  const lineNumbers = $("#lineNumbers");
  const lineStat = $("#lineStat");
  const iframe = $("#preview");
  const previewCanvas = $("#previewCanvas");
  const previewViewport = $("#previewViewport");
  const editToolbar = $("#editToolbar");
  const selChip = $("#selChip");
  const editHint = $("#editHint");
  const zoomSelect = $("#zoomSelect");
  const fileInput = $("#fileInput");
  const imgInput = $("#imgInput");
  const insertImgInput = $("#insertImgInput");
  const codeStat = $("#codeStat");
  const fontBtn = $("#fontBtn");
  const fontNameEl = $("#fontName");
  const fontPanel = $("#fontPanel");
  const fontSearch = $("#fontSearch");
  const fontList = $("#fontList");
  const fontSizeInput = $("#fontSizeInput");
  const insertFab = $("#insertFab");
  const insertPanel = $("#insertPanel");
  const effectPanel = $("#effectPanel");
  const fillPanel = $("#fillPanel");
  const stylePanel = $("#stylePanel");

  const H2C_SRC = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  const JSZIP_SRC = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
  const AUTOSAVE_KEY = "livehtml:autosave";
  const SNAP_DIST = 6; // 가운데 정렬 스냅 허용 거리(px)

  let editMode = true;          // 편집 모드 / 보기 모드
  let selectedEl = null;        // iframe 안에서 선택된 요소 (다중 선택 시 대표 요소)
  let extraSel = [];            // 다중 선택된 나머지 요소들
  let editingEl = null;         // 텍스트 편집 중인 요소
  let zoomMode = "fit";
  let currentScale = 1;
  let lastContentH = 0;
  let hintShown = false;
  let pages = [];               // 감지된 페이지 요소들

  /* ---------------- 유틸 ---------------- */
  const debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  function toast(msg, icon = "check_circle", isError = false) {
    const wrap = $("#toastWrap");
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span></span>`;
    el.lastElementChild.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.classList.add("out"), 2400);
    setTimeout(() => el.remove(), 2700);
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function loadScriptOnce(src, check) {
    if (check()) return Promise.resolve(check());
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve(check());
      s.onerror = () => reject(new Error(`script load failed: ${src}`));
      document.head.appendChild(s);
    });
  }

  /* ============================================================
   * 글꼴 데이터 — Google Fonts 한글 전체 + 영문 일부 + Pretendard
   * ============================================================ */
  const PRETENDARD_CSS = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";
  const PRETENDARD_GOV_CSS = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-gov.min.css";

  // [영문 패밀리명, 한글 표시명, 폴백]
  const KOREAN_FONTS = [
    ["Noto Sans KR", "노토 산스 (본고딕)", "sans-serif"],
    ["Noto Serif KR", "노토 세리프 (본명조)", "serif"],
    ["Nanum Gothic", "나눔고딕", "sans-serif"],
    ["Nanum Myeongjo", "나눔명조", "serif"],
    ["Nanum Pen Script", "나눔손글씨 펜", "cursive"],
    ["Nanum Brush Script", "나눔손글씨 붓", "cursive"],
    ["Nanum Gothic Coding", "나눔고딕코딩", "monospace"],
    ["Gothic A1", "고딕 A1", "sans-serif"],
    ["IBM Plex Sans KR", "IBM 플렉스 산스", "sans-serif"],
    ["Gowun Dodum", "고운돋움", "sans-serif"],
    ["Gowun Batang", "고운바탕", "serif"],
    ["Hahmlet", "함렛", "serif"],
    ["Black Han Sans", "블랙 한 산스", "sans-serif"],
    ["Jua", "주아", "sans-serif"],
    ["Do Hyeon", "도현", "sans-serif"],
    ["Sunflower", "해바라기", "sans-serif"],
    ["Stylish", "스타일리시", "sans-serif"],
    ["Song Myung", "송명", "serif"],
    ["Gugi", "구기", "cursive"],
    ["Dongle", "동글", "sans-serif"],
    ["Bagel Fat One", "베이글 팻 원", "cursive"],
    ["Gasoek One", "가석 원", "sans-serif"],
    ["Orbit", "오르빗", "sans-serif"],
    ["Diphylleia", "산하엽", "serif"],
    ["Moirai One", "모이라이 원", "cursive"],
    ["Grandiflora One", "그란디플로라 원", "serif"],
    ["Gaegu", "개구", "cursive"],
    ["Gamja Flower", "감자꽃", "cursive"],
    ["Hi Melody", "하이멜로디", "cursive"],
    ["Poor Story", "푸어스토리", "cursive"],
    ["Cute Font", "큐트폰트", "cursive"],
    ["Single Day", "싱글데이", "cursive"],
    ["Yeon Sung", "연성", "cursive"],
    ["Kirang Haerang", "기랑해랑", "cursive"],
    ["Dokdo", "독도", "cursive"],
    ["East Sea Dokdo", "동해독도", "cursive"],
    ["Black And White Picture", "흑백사진", "sans-serif"],
  ];

  const ENGLISH_FONTS = [
    ["Inter", "인터", "sans-serif"],
    ["Roboto", "로보토", "sans-serif"],
    ["Open Sans", "오픈 산스", "sans-serif"],
    ["Lato", "라토", "sans-serif"],
    ["Montserrat", "몬세라트", "sans-serif"],
    ["Poppins", "포핀스", "sans-serif"],
    ["Raleway", "랄레웨이", "sans-serif"],
    ["Oswald", "오스왈드", "sans-serif"],
    ["Anton", "안톤", "sans-serif"],
    ["Bebas Neue", "베바스 노이", "sans-serif"],
    ["Playfair Display", "플레이페어", "serif"],
    ["Merriweather", "메리웨더", "serif"],
    ["Pacifico", "퍼시피코", "cursive"],
    ["Lobster", "랍스터", "cursive"],
    ["Dancing Script", "댄싱 스크립트", "cursive"],
    ["Caveat", "카베아트", "cursive"],
  ];

  // family: null → font-family 제거(원래 글꼴), css → 전용 스타일시트 주입
  const FONT_GROUPS = [
    { title: "기본", fonts: [
      { family: null, label: "원래 글꼴로", fallback: "" },
      { family: "Pretendard", label: "프리텐다드", fallback: "sans-serif", css: PRETENDARD_CSS },
      { family: "Pretendard GOV", label: "프리텐다드 GOV", fallback: "sans-serif", css: PRETENDARD_GOV_CSS },
    ]},
    { title: "한글 (Google Fonts)", fonts: KOREAN_FONTS.map(([f, l, fb]) => ({ family: f, label: l, fallback: fb })) },
    { title: "영문 (Google Fonts)", fonts: ENGLISH_FONTS.map(([f, l, fb]) => ({ family: f, label: l, fallback: fb })) },
  ];

  const googleFontHref = (family) =>
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}&display=swap`;

  function fontHref(font) {
    return font.css || googleFontHref(font.family);
  }

  /** 문서(head)에 글꼴 스타일시트를 중복 없이 주입.
   *  미리보기 iframe에 주입된 link는 그대로 직렬화되어
   *  다운로드한 HTML에서도 글꼴이 유지된다. */
  function ensureFontLink(doc, font) {
    if (!font.family) return;
    const href = fontHref(font);
    if ([...doc.querySelectorAll("link[rel='stylesheet']")].some((l) => l.getAttribute("href") === href)) return;
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    (doc.head || doc.documentElement).appendChild(link);
  }

  /* ---- 글꼴 패널 ---- */
  let fontPreviewLoaded = false;

  function loadFontPreviews() {
    if (fontPreviewLoaded) return;
    fontPreviewLoaded = true;
    const families = [...KOREAN_FONTS, ...ENGLISH_FONTS].map(([f]) => f);
    for (let i = 0; i < families.length; i += 10) {
      const chunk = families.slice(i, i + 10);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?" +
        chunk.map((f) => "family=" + f.replace(/ /g, "+")).join("&") + "&display=swap";
      document.head.appendChild(link);
    }
  }

  function buildFontList(query = "") {
    const q = query.trim().toLowerCase();
    fontList.innerHTML = "";
    const current = selectedEl ? currentFontFamily(selectedEl) : "";
    let count = 0;
    FONT_GROUPS.forEach((group) => {
      const matched = group.fonts.filter((f) => {
        if (!q) return true;
        return (f.family || "").toLowerCase().includes(q) || f.label.toLowerCase().includes(q);
      });
      if (!matched.length) return;
      const title = document.createElement("div");
      title.className = "font-group-title";
      title.textContent = group.title;
      fontList.appendChild(title);
      matched.forEach((font) => {
        count++;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "font-item" + (font.family && current === font.family ? " active" : "");
        const preview = document.createElement("span");
        preview.className = "fi-preview";
        preview.textContent = font.family ? `${font.label} 가나다 Aa` : font.label;
        if (font.family) preview.style.fontFamily = `'${font.family}', ${font.fallback}`;
        const label = document.createElement("span");
        label.className = "fi-label";
        label.textContent = font.family || "";
        btn.append(preview, label);
        btn.addEventListener("click", () => applyFont(font));
        fontList.appendChild(btn);
      });
    });
    if (!count) {
      fontList.innerHTML = `<div class="font-empty">'${query}'에 맞는 글꼴이 없어요</div>`;
    }
  }

  function currentFontFamily(el) {
    const inline = el.style.fontFamily || iframe.contentWindow.getComputedStyle(el).fontFamily || "";
    return inline.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  }

  function updateFontChip() {
    if (!selectedEl) return;
    const fam = currentFontFamily(selectedEl);
    const known = FONT_GROUPS.flatMap((g) => g.fonts).find((f) => f.family === fam);
    fontNameEl.textContent = known ? known.label : (fam || "글꼴");
  }

  function applyFont(font) {
    if (!selectedEl || guardLocked()) return;
    if (font.family) ensureFontLink(iframe.contentDocument, font);
    selEls().forEach((el) => {
      if (!font.family) el.style.removeProperty("font-family");
      else el.style.fontFamily = `'${font.family}', ${font.fallback}`;
    });
    closeFontPanel();
    updateFontChip();
    syncFromPreview();
    toast(`'${font.label}' 글꼴을 적용했어요`, "font_download");
  }

  function openFontPanel() {
    if (!selectedEl) return;
    closeInsertPanel();
    closeEffectPanel();
    closeFillPanel();
    loadFontPreviews();
    buildFontList(fontSearch.value);
    fontPanel.hidden = false;
    // 모바일에서는 키보드가 바로 올라오지 않도록 데스크톱에서만 검색창 포커스
    if (window.matchMedia("(hover: hover)").matches) fontSearch.focus();
  }
  function closeFontPanel() { fontPanel.hidden = true; }

  fontBtn.addEventListener("click", () => {
    fontPanel.hidden ? openFontPanel() : closeFontPanel();
  });
  fontSearch.addEventListener("input", () => buildFontList(fontSearch.value));
  document.addEventListener("pointerdown", (e) => {
    if (!fontPanel.hidden && !fontPanel.contains(e.target) && !fontBtn.contains(e.target)) {
      closeFontPanel();
    }
    if (!insertPanel.hidden && !insertPanel.contains(e.target) && !insertFab.contains(e.target)) {
      closeInsertPanel();
    }
    if (!effectPanel.hidden && !effectPanel.contains(e.target) &&
        !(e.target.closest && e.target.closest("[data-act='effects']"))) {
      closeEffectPanel();
    }
    if (!fillPanel.hidden && !fillPanel.contains(e.target) &&
        !(e.target.closest && e.target.closest("[data-act='fill']"))) {
      closeFillPanel();
    }
    if (!stylePanel.hidden && !stylePanel.contains(e.target) &&
        !(e.target.closest && e.target.closest("[data-act='style']"))) {
      closeStylePanel();
    }
    // 작업창(미리보기) 바깥 — 코드창·헤더 등을 누르면 요소 선택 해제
    // (iframe 내부 클릭은 부모 document 로 전달되지 않으므로 캔버스 클릭은 영향 없음)
    if (editMode && selectedEl && e.target.closest && !e.target.closest(".preview-pane")) {
      clearSelection();
    }
  });

  /* ============================================================
   * 히스토리 (실행 취소 / 다시 실행)
   * ============================================================ */
  const history = { stack: [], idx: -1 };

  function pushHistory(code) {
    if (history.stack[history.idx] === code) return;
    history.stack = history.stack.slice(0, history.idx + 1);
    history.stack.push(code);
    if (history.stack.length > 100) history.stack.shift();
    history.idx = history.stack.length - 1;
    updateHistoryButtons();
  }
  const pushHistoryDebounced = debounce(pushHistory, 600);

  function updateHistoryButtons() {
    $("#btnUndo").disabled = history.idx <= 0;
    $("#btnRedo").disabled = history.idx >= history.stack.length - 1;
  }

  function applyHistory(dir) {
    // 디바운스로 아직 기록되지 않은 최신 편집을 먼저 확정 (Ctrl+Z 가 한 박자 늦지 않도록)
    if (dir < 0 && codeInput.value !== history.stack[history.idx]) {
      pushHistory(codeInput.value);
    }
    const next = history.idx + dir;
    if (next < 0 || next >= history.stack.length) return;
    history.idx = next;
    codeInput.value = history.stack[next];
    renderPreview();
    updateHistoryButtons();
    updateStat();
  }

  /* ============================================================
   * 자동 저장 (localStorage)
   * ============================================================ */
  const autosave = debounce(() => {
    try { localStorage.setItem(AUTOSAVE_KEY, codeInput.value); } catch (_) { /* 저장 공간 부족 등 */ }
  }, 800);

  /* ============================================================
   * 코드 → 미리보기 렌더링
   * ============================================================ */
  function setCode(code, { record = true } = {}) {
    codeInput.value = code;
    renderPreview();
    updateStat();
    if (record) pushHistory(code);
  }

  let lastLineCount = -1;
  function updateLineNumbers() {
    const lines = codeInput.value.split("\n").length;
    if (lines !== lastLineCount) {
      lastLineCount = lines;
      let buf = "";
      for (let i = 1; i <= lines; i++) buf += i + "\n";
      lineNumbers.textContent = buf;
      lineStat.textContent = `${lines.toLocaleString()}줄`;
    }
    lineNumbers.scrollTop = codeInput.scrollTop;
  }
  codeInput.addEventListener("scroll", () => { lineNumbers.scrollTop = codeInput.scrollTop; });

  function updateStat() {
    codeStat.textContent = `${codeInput.value.length.toLocaleString()}자`;
    updateLineNumbers();
    autosave();
  }

  function renderPreview() {
    clearSelection();
    pages = [];
    const code = codeInput.value.trim();
    document.body.classList.toggle("has-content", !!code);
    iframe.srcdoc = code || "<!DOCTYPE html><html><body></body></html>";
  }

  const contentResizeObserver = new ResizeObserver(() => {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
    // 이미지·글꼴 로딩으로 내용 높이가 바뀌면 배율 다시 계산
    if (Math.abs(h - lastContentH) > 2) applyZoomDebounced();
  });

  iframe.addEventListener("load", () => {
    const doc = iframe.contentDocument;
    if (!doc) return;
    injectEditorStyle(doc);
    attachPreviewEvents(doc);
    try {
      contentResizeObserver.disconnect();
      if (doc.body) contentResizeObserver.observe(doc.body);
    } catch (_) {}
    requestAnimationFrame(() => { applyZoom(); setTimeout(applyZoom, 250); });
    if (editMode && codeInput.value.trim() && !hintShown) {
      hintShown = true;
      editHint.hidden = false;
      setTimeout(() => { editHint.hidden = true; }, 5000);
    }
  });

  function injectEditorStyle(doc) {
    if (doc.getElementById("__lh_style")) return;
    const st = doc.createElement("style");
    st.id = "__lh_style";
    st.textContent = `
      [data-lh-hover] { outline: 1.5px dashed rgba(36,107,235,.55) !important; outline-offset: 2px; cursor: default; }
      [data-lh-selected] { outline: 2px solid #246BEB !important; outline-offset: 2px; cursor: move; touch-action: none; }
      [data-lh-selected][contenteditable="true"] { cursor: text; outline-style: dashed !important; }
      /* 편집 모드 전용: 페이지를 카드처럼 또렷이 분리 (내보내기에는 미포함) */
      [data-lh-page] {
        outline: 1px dashed rgba(109,120,130,.55);
        outline-offset: 5px;
        box-shadow: 0 6px 24px rgba(0,0,0,.18) !important;
        margin-bottom: 64px !important;
      }
      [data-lh-lock] { cursor: default !important; }
      [data-lh-lock][data-lh-selected] { outline-style: dotted !important; }
      .__lh_guide { position: fixed; background: #FF2E92; z-index: 2147483646; pointer-events: none; }
      .__lh_guide.v { width: 1.5px; }
      .__lh_guide.h { height: 1.5px; }
      .__lh_marquee {
        position: fixed; z-index: 2147483646; pointer-events: none;
        border: 1.5px solid #246BEB; background: rgba(36,107,235,.12);
        border-radius: 2px;
      }
      .__lh_pagelabel {
        position: absolute; z-index: 2147483000; pointer-events: auto; cursor: pointer;
        background: rgba(30,33,36,.72); color: #fff;
        font: 700 11px/1 Pretendard, 'Apple SD Gothic Neo', sans-serif;
        padding: 4px 9px; border-radius: 99px;
      }
      .__lh_pagelabel:hover { background: #246BEB; }
      .__lh_handle {
        position: fixed; z-index: 2147483647;
        background: #fff; border: 2px solid #246BEB; border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,.25); touch-action: none;
      }
      .__lh_handle.nw, .__lh_handle.se { cursor: nwse-resize; }
      .__lh_handle.ne, .__lh_handle.sw { cursor: nesw-resize; }
      .__lh_handle.n, .__lh_handle.s { cursor: ns-resize; border-radius: 999px; }
      .__lh_handle.e, .__lh_handle.w { cursor: ew-resize; border-radius: 999px; }
      .__lh_handle.rot { background: #246BEB; cursor: grab; }
      .__lh_handle.rot:active { cursor: grabbing; }
      .__lh_pagebar {
        position: absolute; z-index: 2147483000; display: flex; gap: 6px;
        pointer-events: auto; flex-wrap: nowrap; align-items: center;
      }
      .__lh_pagebar button {
        border: none; cursor: pointer;
        background: rgba(30,33,36,.82); color: #fff;
        font: 700 13px/1.3 Pretendard, 'Apple SD Gothic Neo', sans-serif;
        padding: 6px 13px; border-radius: 99px;
        white-space: nowrap; display: inline-flex; align-items: center;
        box-sizing: border-box;
      }
      .__lh_pagebar button:hover { background: #246BEB; }
      .__lh_pagebar button.danger:hover { background: #EB003B; }
    `;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ============================================================
   * 미리보기 → 코드 직렬화 (편집 흔적 제거 후 추출)
   * ============================================================ */
  function getCleanHTML() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.documentElement) return "";
    const clone = doc.documentElement.cloneNode(true);
    clone.querySelectorAll("#__lh_style, script[data-lh], .__lh_ui").forEach((e) => e.remove());
    clone.querySelectorAll("[data-lh-hover], [data-lh-selected], [data-lh-page], [contenteditable]").forEach((e) => {
      e.removeAttribute("data-lh-hover");
      e.removeAttribute("data-lh-selected");
      e.removeAttribute("data-lh-page");
      e.removeAttribute("contenteditable");
      e.removeAttribute("spellcheck");
    });
    clone.querySelectorAll('[style=""]').forEach((e) => e.removeAttribute("style"));
    const dt = doc.doctype
      ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ""}${doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ""}>`
      : "<!DOCTYPE html>";
    return dt + "\n" + clone.outerHTML;
  }

  /** 미리보기에서 수정이 일어났을 때: 코드창만 갱신 (iframe은 다시 그리지 않음) */
  function syncFromPreview() {
    const html = getCleanHTML();
    codeInput.value = html;
    updateStat();
    pushHistoryDebounced(html);
    updateHandles();
    applyZoomDebounced();
  }
  const syncFromPreviewDebounced = debounce(syncFromPreview, 350);

  /* ============================================================
   * 페이지 감지 + 페이지 구분 표시
   * ============================================================ */
  function detectPages() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return [];
    const body = doc.body;
    const big = (el) => {
      const r = el.getBoundingClientRect();
      return r.width >= 150 && r.height >= 150;
    };
    const selectors = [
      "[data-page]", ".page", ".slide", ".cardnews", ".card-news",
      ".card", ".poster", ".frame", "section",
    ];
    for (const sel of selectors) {
      let els = [...body.querySelectorAll(sel)].filter(big);
      els = els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
      if (els.length >= 2) return els;
      if (els.length === 1 && sel !== "section" && sel !== ".card") return els;
    }
    const kids = [...body.children].filter(
      (el) => big(el) && !["SCRIPT", "STYLE", "LINK"].includes(el.tagName) &&
        !String(el.className).includes("__lh_")
    );
    if (kids.length >= 2) return kids;
    return [body];
  }

  function clearPageMarkers() {
    const doc = iframe.contentDocument;
    if (!doc) return;
    try {
      doc.querySelectorAll("[data-lh-page]").forEach((e) => e.removeAttribute("data-lh-page"));
      doc.querySelectorAll(".__lh_pagelabel").forEach((e) => e.remove());
    } catch (_) {}
  }

  /** 편집 모드에서 페이지마다 점선 테두리 + '페이지 N' 라벨 표시 */
  function refreshPageMarkers() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;
    clearPageMarkers();
    pages = detectPages();
    if (!editMode || !codeInput.value.trim()) return;
    const win = iframe.contentWindow;
    pages.forEach((el, i) => {
      if (el === doc.body) return;
      el.setAttribute("data-lh-page", String(i + 1));
      const r = el.getBoundingClientRect();
      const top = Math.max(2, r.top + win.scrollY - 30) + "px";

      const label = doc.createElement("div");
      label.className = "__lh_ui __lh_pagelabel";
      label.textContent = `페이지 ${i + 1}`;
      label.title = "누르면 페이지가 선택돼요 (배경색 변경 가능)";
      label.style.left = (r.left + win.scrollX) + "px";
      label.style.top = top;
      label.addEventListener("click", () => selectElement(el));
      doc.body.appendChild(label);

      // 캔바처럼 페이지마다 추가/복제/삭제 버튼
      const bar = doc.createElement("div");
      bar.className = "__lh_ui __lh_pagebar";
      bar.style.left = (r.right + win.scrollX) + "px";
      bar.style.top = top;
      bar.style.transform = "translateX(-100%)";
      const mkPB = (txt, title, fn, danger) => {
        const b = doc.createElement("button");
        b.type = "button";
        b.textContent = txt;
        b.title = title;
        if (danger) b.className = "danger";
        b.addEventListener("click", fn);
        bar.appendChild(b);
      };
      mkPB("＋ 추가", "아래에 빈 페이지 추가", () => addPageAfter(el));
      mkPB("⧉ 복제", "이 페이지 복제", () => duplicatePage(el));
      mkPB("🗑", "이 페이지 삭제", () => deletePage(el), true);
      doc.body.appendChild(bar);
    });
  }

  /* ---- 페이지 추가 / 복제 / 삭제 ---- */
  function addPageAfter(page) {
    const r = page.getBoundingClientRect();
    const np = page.cloneNode(false); // 클래스·인라인 스타일만 복사한 빈 페이지
    ["data-lh-page", "data-lh-selected", "data-lh-lock"].forEach((a) => np.removeAttribute(a));
    page.after(np);
    // 높이가 내용에 의존하던 페이지라면 원래 크기를 유지
    if (np.getBoundingClientRect().height < 60) np.style.height = Math.round(r.height) + "px";
    syncFromPreview();
    applyZoom();
    toast("빈 페이지를 추가했어요. + 버튼으로 채워 보세요!", "note_add");
  }

  function duplicatePage(page) {
    const cp = page.cloneNode(true);
    ["data-lh-page", "data-lh-selected"].forEach((a) => cp.removeAttribute(a));
    cp.querySelectorAll("[data-lh-selected], [contenteditable]").forEach((x) => {
      x.removeAttribute("data-lh-selected");
      x.removeAttribute("contenteditable");
    });
    page.after(cp);
    syncFromPreview();
    applyZoom();
    toast("페이지를 복제했어요", "content_copy");
  }

  function deletePage(page) {
    const doc = iframe.contentDocument;
    const pgs = (pages.length ? pages : detectPages()).filter((p) => p !== doc.body);
    if (pgs.length <= 1) {
      toast("마지막 페이지는 삭제할 수 없어요", "error", true);
      return;
    }
    const num = page.getAttribute("data-lh-page") || "";
    if (!confirm(`페이지 ${num}을(를) 삭제할까요?`)) return;
    if (selectedEl && (selectedEl === page || page.contains(selectedEl))) clearSelection();
    page.remove();
    syncFromPreview();
    applyZoom();
    toast("페이지를 삭제했어요", "delete");
  }

  /* ============================================================
   * 미리보기 인라인 편집 (선택 / 드래그 / 크기 조절 / 텍스트)
   * ============================================================ */
  function isEditableTarget(el) {
    if (!el || !el.tagName) return false;
    if (el.closest && el.closest(".__lh_ui")) return false;
    const tag = el.tagName.toUpperCase();
    return tag !== "HTML" && tag !== "BODY" && tag !== "SCRIPT" && tag !== "STYLE" && tag !== "LINK" && tag !== "META";
  }

  /** 페이지 요소인가 (페이지는 이동·크기 조절이 잠긴 배경 역할) */
  function isPageEl(el) {
    return !!el && el.hasAttribute && (el.hasAttribute("data-lh-page") || pages.includes(el));
  }

  /** 사용자가 잠근 요소인가 (data-lh-lock은 내보낸 HTML에도 유지) */
  function isLockedEl(el) {
    return !!el && el.hasAttribute && el.hasAttribute("data-lh-lock");
  }

  /** 잠긴 요소를 고치려 할 때 안내하고 true 반환 */
  function guardLocked() {
    if (selectedEl && isLockedEl(selectedEl)) {
      toast("잠긴 요소예요. 🔒 버튼으로 잠금을 풀어 주세요", "lock", true);
      return true;
    }
    return false;
  }

  /** 현재 선택된 모든 요소 (대표 + 추가 선택) */
  function selEls() {
    const list = [];
    if (selectedEl) list.push(selectedEl);
    extraSel.forEach((e) => { if (e && e !== selectedEl && !list.includes(e)) list.push(e); });
    return list;
  }

  function clearSelection() {
    if (editingEl) endTextEdit(false);
    try {
      iframe.contentDocument?.querySelectorAll("[data-lh-selected]")
        .forEach((e) => e.removeAttribute("data-lh-selected"));
    } catch (_) {}
    selectedEl = null;
    extraSel = [];
    editToolbar.hidden = true;
    closeFontPanel();
    closeEffectPanel();
    closeFillPanel();
    closeStylePanel();
    removeGuides();
    updateHandles();
  }

  /** 대표 선택 요소에 맞춰 도구 바 정보 갱신 */
  function refreshToolbarForSelection() {
    const el = selectedEl;
    if (!el) { editToolbar.hidden = true; return; }
    const pageSel = isPageEl(el);
    const multi = extraSel.length > 0;
    selChip.textContent = multi
      ? `${selEls().length}개 선택`
      : pageSel
        ? `페이지 ${el.getAttribute("data-lh-page") || ""}`.trim()
        : el.tagName.toLowerCase();
    $("#btnImage").hidden = multi || el.tagName.toUpperCase() !== "IMG";
    $("#btnLock").hidden = !multi && pageSel; // 페이지는 항상 고정이라 잠금 버튼 불필요
    $("#lockIcon").textContent = isLockedEl(el) ? "lock" : "lock_open";
    $("#btnLock").classList.toggle("locked", isLockedEl(el));
    editToolbar.hidden = false;
    updateFontChip();
    updateFontSizeInput();
  }

  /**
   * 요소 선택. opts.additive=true 이면 다중 선택 토글(Ctrl+클릭).
   */
  function selectElement(el, opts = {}) {
    if (editingEl && editingEl !== el) endTextEdit();

    if (opts.additive && selectedEl) {
      // Ctrl+클릭: 이미 선택된 요소면 해제, 아니면 추가
      if (el === selectedEl || extraSel.includes(el)) {
        el.removeAttribute("data-lh-selected");
        extraSel = extraSel.filter((x) => x !== el);
        if (el === selectedEl) selectedEl = extraSel.pop() || null;
        if (!selectedEl) { clearSelection(); return; }
      } else {
        if (selectedEl && !extraSel.includes(selectedEl)) extraSel.push(selectedEl);
        selectedEl = el;
        el.setAttribute("data-lh-selected", "");
      }
      refreshToolbarForSelection();
      updateHandles();
      return;
    }

    // 단일 선택(기존 선택 모두 해제)
    if (selectedEl || extraSel.length) {
      try {
        iframe.contentDocument?.querySelectorAll("[data-lh-selected]")
          .forEach((e) => e.removeAttribute("data-lh-selected"));
      } catch (_) {}
    }
    extraSel = [];
    selectedEl = el;
    el.setAttribute("data-lh-selected", "");
    closeFontPanel();
    closeEffectPanel();
    closeStylePanel();
    // 배경색 패널은 유지 — 다음 페이지를 선택해서 최근 색을 바로 쓸 수 있게
    refreshToolbarForSelection();
    updateHandles();
  }

  function updateFontSizeInput() {
    if (!selectedEl) return;
    const size = parseFloat(iframe.contentWindow.getComputedStyle(selectedEl).fontSize) || 16;
    fontSizeInput.value = Math.round(size);
  }

  function startTextEdit(el) {
    if (!el || el.tagName.toUpperCase() === "IMG") return;
    if (isLockedEl(el)) { guardLocked(); return; }
    editingEl = el;
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "false");
    el.focus();
    updateHandles();
  }

  function endTextEdit(sync = true) {
    if (!editingEl) return;
    editingEl.removeAttribute("contenteditable");
    editingEl.removeAttribute("spellcheck");
    editingEl = null;
    if (sync) syncFromPreview();
    updateHandles();
  }

  function selectAllTextIn(el) {
    try {
      const win = iframe.contentWindow;
      const range = iframe.contentDocument.createRange();
      range.selectNodeContents(el);
      const sel = win.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }

  /* ---- 이동·회전 (translate/rotate를 인라인 transform 끝에 합성) ---- */
  const XFORM_RE = /(?:\s*translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\))?(?:\s*rotate\((-?[\d.]+)deg\))?\s*$/;

  function getXform(el) {
    const s = el.style.transform || "";
    const m = s.match(XFORM_RE);
    return {
      x: m && m[1] ? parseFloat(m[1]) : 0,
      y: m && m[2] ? parseFloat(m[2]) : 0,
      r: m && m[3] ? parseFloat(m[3]) : 0,
      base: m ? s.slice(0, m.index).trim() : s.trim(),
    };
  }

  function setXform(el, x, y, r) {
    let s = getXform(el).base;
    if (Math.abs(x) >= 0.5 || Math.abs(y) >= 0.5) {
      s += ` translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
    if (Math.abs(((r % 360) + 360) % 360) >= 0.5) {
      s += ` rotate(${Math.round(r)}deg)`;
    }
    s = s.trim();
    if (s) el.style.transform = s;
    else el.style.removeProperty("transform");
  }

  function getTranslate(el) {
    const t = getXform(el);
    return { x: t.x, y: t.y };
  }

  function setTranslate(el, x, y) {
    setXform(el, x, y, getXform(el).r);
  }

  function nudgeSelected(dx, dy) {
    if (!selectedEl || editingEl) return;
    const movers = selEls().filter((el) => !isPageEl(el) && !isLockedEl(el));
    if (!movers.length) return;
    movers.forEach((el) => {
      const t = getTranslate(el);
      setTranslate(el, t.x + dx, t.y + dy);
    });
    updateHandles();
    syncFromPreviewDebounced();
  }

  /* ---- 크기 조절 핸들 (선택 요소 네 모서리) ---- */
  function updateHandles() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;
    const want = selectedEl && extraSel.length === 0 && !editingEl && editMode &&
      !isPageEl(selectedEl) && !isLockedEl(selectedEl);
    const existing = [...doc.querySelectorAll(".__lh_handle")];
    if (!want) { existing.forEach((h) => h.remove()); return; }

    const r = selectedEl.getBoundingClientRect();
    const size = Math.max(12, Math.min(28, Math.round(14 / (currentScale || 1))));
    const gap = Math.max(18, Math.round(24 / (currentScale || 1)));
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    const isImg = selectedEl.tagName.toUpperCase() === "IMG";
    const textOnly = !isImg && !selectedEl.children.length && !!selectedEl.textContent.trim();

    const pos = {
      nw: [r.left, r.top], ne: [r.right, r.top],
      sw: [r.left, r.bottom], se: [r.right, r.bottom],
      n: [cx, r.top], s: [cx, r.bottom],
      e: [r.right, cy], w: [r.left, cy],
      rot: [cx, Math.max(size, r.top - gap)],
    };
    // 텍스트는 좌우 핸들로 줄바꿈 폭을 조절 (위아래 핸들은 의미가 없어 숨김)
    const keys = textOnly
      ? ["nw", "ne", "sw", "se", "e", "w", "rot"]
      : ["nw", "ne", "sw", "se", "n", "s", "e", "w", "rot"];

    existing.forEach((h) => {
      if (!keys.some((k) => h.classList.contains(k))) h.remove();
    });
    keys.forEach((k) => {
      let h = existing.find((x) => x.classList.contains(k));
      if (!h) {
        h = doc.createElement("div");
        h.className = `__lh_ui __lh_handle ${k}`;
        doc.body.appendChild(h);
      }
      // 변(邊) 핸들은 알약 모양으로 길게
      let w = size, hh = size;
      if (k === "n" || k === "s") { w = Math.round(size * 1.9); hh = Math.round(size * 0.75); }
      if (k === "e" || k === "w") { w = Math.round(size * 0.75); hh = Math.round(size * 1.9); }
      h.style.width = w + "px";
      h.style.height = hh + "px";
      h.style.left = (pos[k][0] - w / 2) + "px";
      h.style.top = (pos[k][1] - hh / 2) + "px";
    });
  }

  /* ---- 가운데 정렬 가이드선 ---- */
  function showGuide(doc, kind, rect, center) {
    let g = doc.querySelector(`.__lh_guide.${kind}`);
    if (!g) {
      g = doc.createElement("div");
      g.className = `__lh_ui __lh_guide ${kind}`;
      doc.body.appendChild(g);
    }
    if (kind === "v") {
      g.style.left = center + "px";
      g.style.top = rect.top + "px";
      g.style.height = rect.height + "px";
    } else {
      g.style.top = center + "px";
      g.style.left = rect.left + "px";
      g.style.width = rect.width + "px";
    }
  }

  function removeGuides() {
    try {
      iframe.contentDocument?.querySelectorAll(".__lh_guide").forEach((g) => g.remove());
    } catch (_) {}
  }

  /** 사각형(뷰포트 좌표)과 겹치는 요소들을 한 번에 선택 */
  function selectInRect(rect, page) {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;
    const root = page && page !== doc.body ? page : doc.body;
    let hits = [...root.querySelectorAll("*")].filter((el) => {
      if (!isEditableTarget(el) || isPageEl(el)) return false;
      if (el.closest(".__lh_ui")) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) return false;
      return r.right > rect.left && r.left < rect.right &&
             r.bottom > rect.top && r.top < rect.bottom;
    });
    // 다른 선택 요소의 자식은 제외 (가장 바깥 요소만)
    hits = hits.filter((el) => !hits.some((o) => o !== el && o.contains(el)));
    if (!hits.length) { clearSelection(); return; }
    clearSelection();
    hits.forEach((el, i) => selectElement(el, { additive: i > 0 }));
    if (hits.length > 1) toast(`요소 ${hits.length}개를 선택했어요`, "select_all");
  }

  let suppressNextClick = false; // 마퀴 선택 직후의 click 무시용
  function attachPreviewEvents(doc) {
    let hoverEl = null;
    let drag = null;
    let resize = null;
    let rotate = null;
    let marquee = null;

    doc.addEventListener("mouseover", (e) => {
      if (!editMode || editingEl || drag || resize || rotate || marquee) return;
      if (hoverEl) hoverEl.removeAttribute("data-lh-hover");
      hoverEl = null;
      if (isEditableTarget(e.target) && e.target !== selectedEl) {
        hoverEl = e.target;
        hoverEl.setAttribute("data-lh-hover", "");
      }
    });
    doc.addEventListener("mouseout", () => {
      if (hoverEl) { hoverEl.removeAttribute("data-lh-hover"); hoverEl = null; }
    });

    // 링크 이동 차단 (작업 내용을 잃지 않도록)
    doc.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".__lh_ui")) { e.preventDefault(); return; }
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (a) e.preventDefault();
      if (!editMode) return;
      e.preventDefault();
      // 마퀴(드래그 박스) 선택 직후의 click 은 무시
      if (suppressNextClick) { suppressNextClick = false; return; }
      closeInsertPanel();
      if (editingEl) {
        if (e.target === editingEl || editingEl.contains(e.target)) return;
        endTextEdit();
      }
      const additive = e.ctrlKey || e.metaKey;
      // 페이지(배경)는 직접 선택하지 않음 → 빈 곳 클릭은 선택 해제. 페이지는 '페이지 N' 라벨로만 선택
      if (isEditableTarget(e.target) && !isPageEl(e.target)) {
        if (additive || e.target !== selectedEl || extraSel.length) {
          selectElement(e.target, { additive });
        }
      } else if (!additive) {
        clearSelection();
      }
    }, true);

    doc.addEventListener("dblclick", (e) => {
      if (!editMode || !isEditableTarget(e.target)) return;
      e.preventDefault();
      selectElement(e.target);
      startTextEdit(e.target);
    });

    doc.addEventListener("pointerdown", (e) => {
      if (!editMode || editingEl) return;

      // 1) 회전 핸들
      const handle = e.target.closest && e.target.closest(".__lh_handle");
      if (handle && selectedEl && handle.classList.contains("rot")) {
        const er = selectedEl.getBoundingClientRect();
        const cx = (er.left + er.right) / 2;
        const cy = (er.top + er.bottom) / 2;
        rotate = {
          cx, cy,
          startA: Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI,
          r0: getXform(selectedEl).r,
        };
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        return;
      }

      // 2) 크기 조절 핸들 (모서리 + 변)
      if (handle && selectedEl) {
        const dir = ["nw", "ne", "sw", "se", "n", "s", "e", "w"].find((c) => handle.classList.contains(c));
        if (!dir) return;
        const er = selectedEl.getBoundingClientRect();
        const cs = doc.defaultView.getComputedStyle(selectedEl);
        const isImg = selectedEl.tagName.toUpperCase() === "IMG";
        const textOnly = !isImg && !selectedEl.children.length && !!selectedEl.textContent.trim();
        resize = {
          kind: dir.length === 2 ? "corner" : "edge",
          corner: dir, dir,
          sx: e.clientX, sy: e.clientY,
          w: er.width, h: er.height,
          fs: parseFloat(cs.fontSize) || 16,
          t: getTranslate(selectedEl),
          isImg, textOnly,
        };
        if (cs.display === "inline") selectedEl.style.display = "inline-block";
        // 한 줄 고정(nowrap) 텍스트는 폭을 줄이면 자연스럽게 줄바꿈되도록
        if (textOnly && resize.kind === "edge" && cs.whiteSpace === "nowrap") {
          selectedEl.style.whiteSpace = "normal";
        }
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        return;
      }

      // Ctrl/⌘ + 누르기는 드래그가 아니라 다중 선택 토글 → click 에서 처리
      if (e.ctrlKey || e.metaKey) return;

      // 3) 선택된 요소(여러 개 가능) 드래그 이동
      const grabbed = selEls().find((el) => el === e.target || el.contains(e.target));
      if (grabbed && !isPageEl(grabbed)) {
        if (isLockedEl(grabbed)) { guardLocked(); return; }
        const movers = selEls().filter((el) => !isPageEl(el) && !isLockedEl(el));
        if (!movers.length) return;
        const er = grabbed.getBoundingClientRect();
        const parent = grabbed.parentElement || doc.body;
        const pr = parent.getBoundingClientRect();
        drag = {
          sx: e.clientX, sy: e.clientY,
          movers: movers.map((el) => ({ el, base: getTranslate(el) })),
          multi: movers.length > 1,
          c0x: er.left + er.width / 2, c0y: er.top + er.height / 2,
          pcx: pr.left + pr.width / 2, pcy: pr.top + pr.height / 2,
          pr,
          moved: false,
        };
        try { grabbed.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        return;
      }

      // 4) 빈 페이지 배경에서 누르기 → 마퀴(드래그 박스) 다중 선택
      if (isPageEl(e.target) || e.target === doc.body) {
        marquee = {
          sx: e.clientX, sy: e.clientY,
          page: isPageEl(e.target) ? e.target : null,
          box: null, moved: false,
        };
        try { doc.body.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        return;
      }

      // 선택된 요소가 있는데 그 바깥(다른 요소 위)을 눌렀다면 드래그 안 함 (click 이 재선택 처리)
      if (isPageEl(selectedEl) && e.target === selectedEl) {
        toast("페이지는 고정되어 있어요. 안의 요소만 움직일 수 있어요", "lock");
      }
    });

    doc.addEventListener("pointermove", (e) => {
      // 회전 (45° 근처에서 자석처럼 스냅)
      if (rotate && selectedEl) {
        const a = Math.atan2(e.clientY - rotate.cy, e.clientX - rotate.cx) * 180 / Math.PI;
        let newR = rotate.r0 + (a - rotate.startA);
        const snap = Math.round(newR / 45) * 45;
        if (Math.abs(newR - snap) < 4) newR = snap;
        const t = getXform(selectedEl);
        setXform(selectedEl, t.x, t.y, newR);
        updateHandles();
        return;
      }

      // 크기 조절 — 변 핸들: 가로/세로 한 방향만 (텍스트 여백 줄이기에 유용)
      if (resize && selectedEl && resize.kind === "edge") {
        const d = resize.dir;
        if (d === "e" || d === "w") {
          const fx = d === "e" ? 1 : -1;
          const newW = Math.max(20, resize.w + (e.clientX - resize.sx) * fx);
          selectedEl.style.width = Math.round(newW) + "px";
          if (resize.isImg) selectedEl.style.height = "auto";
          if (d === "w") {
            const x = resize.t.x + (resize.w - newW);
            setXform(selectedEl, x, resize.t.y, getXform(selectedEl).r);
          }
        } else {
          const fy = d === "s" ? 1 : -1;
          const newH = Math.max(20, resize.h + (e.clientY - resize.sy) * fy);
          selectedEl.style.height = Math.round(newH) + "px";
          if (d === "n") {
            const y = resize.t.y + (resize.h - newH);
            setXform(selectedEl, resize.t.x, y, getXform(selectedEl).r);
          }
        }
        updateHandles();
        return;
      }

      // 크기 조절 — 모서리 핸들
      if (resize && selectedEl) {
        const fx = resize.corner.includes("e") ? 1 : -1;
        const fy = resize.corner.includes("s") ? 1 : -1;
        const newW = Math.max(20, resize.w + (e.clientX - resize.sx) * fx);
        let newH = Math.max(20, resize.h + (e.clientY - resize.sy) * fy);
        if (resize.textOnly) {
          // 텍스트는 캔바처럼 모서리 조절 시 글자 크기를 비율로 변경
          selectedEl.style.fontSize = Math.max(6, Math.round(resize.fs * (newW / resize.w))) + "px";
          updateFontSizeInput();
        } else if (resize.isImg) {
          newH = newW * (resize.h / resize.w); // 이미지는 비율 유지
          selectedEl.style.width = Math.round(newW) + "px";
          selectedEl.style.height = "auto";
        } else {
          selectedEl.style.width = Math.round(newW) + "px";
          selectedEl.style.height = Math.round(newH) + "px";
        }
        if (!resize.textOnly) {
          // 서쪽/북쪽 핸들은 반대편 모서리가 고정된 것처럼 보이게 이동 보정
          let tx = resize.t.x, ty = resize.t.y;
          if (resize.corner.includes("w")) tx += resize.w - newW;
          if (resize.corner.includes("n")) ty += resize.h - newH;
          setTranslate(selectedEl, tx, ty);
        }
        updateHandles();
        return;
      }

      // 마퀴(드래그 박스) 그리기
      if (marquee) {
        const x = Math.min(marquee.sx, e.clientX), y = Math.min(marquee.sy, e.clientY);
        const w = Math.abs(e.clientX - marquee.sx), h = Math.abs(e.clientY - marquee.sy);
        if (!marquee.moved && Math.hypot(w, h) < 4) return;
        marquee.moved = true;
        if (!marquee.box) {
          marquee.box = doc.createElement("div");
          marquee.box.className = "__lh_ui __lh_marquee";
          doc.body.appendChild(marquee.box);
        }
        marquee.box.style.left = x + "px";
        marquee.box.style.top = y + "px";
        marquee.box.style.width = w + "px";
        marquee.box.style.height = h + "px";
        return;
      }

      // 이동 + 가운데 정렬 스냅
      if (!drag) return;
      let dx = e.clientX - drag.sx;
      let dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;

      let snapX = false, snapY = false;
      if (!drag.multi) {
        // 단일 선택일 때만 가운데 정렬 스냅
        const cx = drag.c0x + dx;
        const cy = drag.c0y + dy;
        if (Math.abs(cx - drag.pcx) < SNAP_DIST) { dx += drag.pcx - cx; snapX = true; }
        if (Math.abs(cy - drag.pcy) < SNAP_DIST) { dy += drag.pcy - cy; snapY = true; }
      }

      drag.movers.forEach((m) => setTranslate(m.el, m.base.x + dx, m.base.y + dy));
      updateHandles();

      if (snapX) showGuide(doc, "v", drag.pr, drag.pcx);
      else doc.querySelector(".__lh_guide.v")?.remove();
      if (snapY) showGuide(doc, "h", drag.pr, drag.pcy);
      else doc.querySelector(".__lh_guide.h")?.remove();
    });

    const endPointer = () => {
      removeGuides();
      if (rotate) { rotate = null; syncFromPreview(); }
      if (resize) { resize = null; syncFromPreview(); }
      if (drag && drag.moved) syncFromPreview();
      drag = null;
      if (marquee) {
        if (marquee.moved && marquee.box) {
          const mr = marquee.box.getBoundingClientRect();
          selectInRect(mr, marquee.page);
          suppressNextClick = true; // 직후 click 으로 선택이 풀리지 않도록
        }
        if (marquee.box) marquee.box.remove();
        marquee = null;
      }
    };
    doc.addEventListener("pointerup", endPointer);
    doc.addEventListener("pointercancel", endPointer);

    // contenteditable 입력 동기화
    doc.addEventListener("input", () => syncFromPreviewDebounced());

    doc.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      // 미리보기(iframe)에 포커스가 있을 때도 실행 취소/다시 실행이 되도록
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey && !editingEl) {
        e.preventDefault(); applyHistory(-1); return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) && !editingEl) {
        e.preventDefault(); applyHistory(1); return;
      }
      if (e.key === "Escape") {
        if (editingEl) endTextEdit();
        else clearSelection();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedEl && !editingEl) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key.startsWith("Arrow") && selectedEl && !editingEl) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const [dx, dy] = map[e.key] || [0, 0];
        nudgeSelected(dx, dy);
      }
    });
  }

  /* ---- 편집 도구 바 동작 ---- */
  function deleteSelected() {
    const list = selEls();
    if (!list.length) return;
    if (list.length === 1 && isPageEl(list[0])) { deletePage(list[0]); return; }
    const removable = list.filter((el) => !isPageEl(el) && !isLockedEl(el));
    if (!removable.length) { guardLocked(); return; }
    clearSelection();
    removable.forEach((el) => el.remove());
    syncFromPreview();
    toast(removable.length > 1 ? `요소 ${removable.length}개를 삭제했어요` : "요소를 삭제했어요", "delete");
  }

  editToolbar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn || !selectedEl) return;
    const act = btn.dataset.act;
    const el = selectedEl;
    const win = iframe.contentWindow;

    // 잠긴 요소는 잠금 해제·선택 관련 동작만 허용
    if (isLockedEl(el) && !["lock", "deselect", "select-parent"].includes(act)) {
      guardLocked();
      return;
    }

    switch (act) {
      case "lock": {
        if (isPageEl(el)) return;
        const locking = !isLockedEl(el);
        if (locking) el.setAttribute("data-lh-lock", "");
        else el.removeAttribute("data-lh-lock");
        $("#lockIcon").textContent = locking ? "lock" : "lock_open";
        $("#btnLock").classList.toggle("locked", locking);
        updateHandles();
        syncFromPreview();
        toast(locking ? "요소를 잠갔어요. 실수로 움직이지 않아요" : "잠금을 풀었어요", locking ? "lock" : "lock_open");
        return;
      }
      case "text-edit":
        startTextEdit(el);
        return;
      case "font-dec":
      case "font-inc": {
        selEls().forEach((t) => {
          const cur = parseFloat(win.getComputedStyle(t).fontSize) || 16;
          t.style.fontSize = Math.max(6, cur + (act === "font-inc" ? 2 : -2)) + "px";
        });
        updateFontSizeInput();
        break;
      }
      case "bold": {
        const w = win.getComputedStyle(el).fontWeight;
        const next = (parseInt(w, 10) >= 600 || w === "bold") ? "400" : "700";
        selEls().forEach((t) => { t.style.fontWeight = next; });
        break;
      }
      case "italic": {
        const next = win.getComputedStyle(el).fontStyle === "italic" ? "normal" : "italic";
        selEls().forEach((t) => { t.style.fontStyle = next; });
        break;
      }
      case "align-left": selEls().forEach((t) => { t.style.textAlign = "left"; }); break;
      case "align-center": selEls().forEach((t) => { t.style.textAlign = "center"; }); break;
      case "align-right": selEls().forEach((t) => { t.style.textAlign = "right"; }); break;
      case "image":
        imgInput.click();
        return;
      case "select-parent": {
        const parent = el.parentElement;
        if (parent && isEditableTarget(parent)) {
          selectElement(parent);
        } else {
          toast("더 위로 올라갈 요소가 없어요", "info", true);
        }
        return;
      }
      case "duplicate": {
        if (isPageEl(el)) { duplicatePage(el); return; }
        const targets = selEls().filter((t) => !isPageEl(t));
        const copies = [];
        targets.forEach((t) => {
          const copy = t.cloneNode(true);
          copy.removeAttribute("data-lh-selected");
          copy.removeAttribute("data-lh-page");
          copy.removeAttribute("data-lh-lock");
          t.after(copy);
          const tr = getTranslate(copy);
          setTranslate(copy, tr.x + 16, tr.y + 16);
          copies.push(copy);
        });
        clearSelection();
        copies.forEach((c, i) => selectElement(c, { additive: i > 0 }));
        toast(copies.length > 1 ? `요소 ${copies.length}개를 복제했어요` : "요소를 복제했어요", "content_copy");
        break;
      }
      case "reset-pos":
        selEls().forEach((t) => { if (!isPageEl(t)) setXform(t, 0, 0, 0); });
        updateHandles();
        toast("위치와 회전을 되돌렸어요", "restart_alt");
        break;
      case "fill":
        fillPanel.hidden ? openFillPanel() : closeFillPanel();
        return;
      case "effects":
        effectPanel.hidden ? openEffectPanel() : closeEffectPanel();
        return;
      case "style":
        stylePanel.hidden ? openStylePanel() : closeStylePanel();
        return;
      case "delete":
        deleteSelected();
        return;
      case "deselect":
        clearSelection();
        return;
    }
    syncFromPreview();
  });

  fontSizeInput.addEventListener("change", () => {
    if (!selectedEl || guardLocked()) return;
    const size = Math.min(400, Math.max(6, parseInt(fontSizeInput.value, 10) || 16));
    fontSizeInput.value = size;
    selEls().forEach((el) => { el.style.fontSize = size + "px"; });
    syncFromPreview();
  });

  $("#colorPicker").addEventListener("input", (e) => {
    if (!selectedEl || guardLocked()) return;
    selEls().forEach((el) => { el.style.color = e.target.value; });
    syncFromPreviewDebounced();
  });
  // 글자 색으로 고른 색도 '최근 사용한 색'에 모아 배경색에서 재사용
  $("#colorPicker").addEventListener("change", (e) => recordRecentColor(e.target.value));

  /* ---- 배경(채우기) 색 패널 — 최근 사용한 색 재사용 ---- */
  const RECENT_COLORS_KEY = "livehtml:recentColors";
  const BASIC_COLORS = [
    "#FFFFFF", "#1E2124", "#6D7882", "#CDD1D5",
    "#EB003B", "#FF7A2E", "#FFD338", "#2EA66A",
    "#00A5B8", "#246BEB", "#18408C", "#8A2BE2",
    "#FF7B9B", "#FFE8EE", "#ECF2FE", "#F4F5F6",
  ];
  let recentColors = [];
  try { recentColors = JSON.parse(localStorage.getItem(RECENT_COLORS_KEY)) || []; } catch (_) {}

  function recordRecentColor(color) {
    const c = color.toUpperCase();
    recentColors = [c, ...recentColors.filter((x) => x !== c)].slice(0, 16);
    try { localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(recentColors)); } catch (_) {}
    renderRecentSwatches();
  }

  function makeSwatch(color, title) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.background = color;
    b.title = title || color;
    b.addEventListener("click", () => applyFill(color));
    return b;
  }

  function renderRecentSwatches() {
    const wrap = $("#recentSwatches");
    wrap.innerHTML = "";
    if (!recentColors.length) {
      wrap.innerHTML = `<div class="swatch-empty">색을 고르면 여기에 모여요. 다음 페이지에서 바로 다시 쓸 수 있어요!</div>`;
      return;
    }
    recentColors.forEach((c) => wrap.appendChild(makeSwatch(c)));
  }

  function renderBasicSwatches() {
    const wrap = $("#basicSwatches");
    wrap.innerHTML = "";
    const none = document.createElement("button");
    none.type = "button";
    none.className = "swatch none";
    none.title = "배경 없음 (원래대로)";
    none.addEventListener("click", () => {
      if (!selectedEl || guardLocked()) return;
      selEls().forEach((el) => {
        el.style.removeProperty("background");
        el.style.removeProperty("background-color");
      });
      syncFromPreview();
    });
    wrap.appendChild(none);
    BASIC_COLORS.forEach((c) => wrap.appendChild(makeSwatch(c)));
  }

  /** 배경색 적용 — 페이지·도형·텍스트 상자 모두 (그라데이션도 단색으로 교체) */
  function applyFill(color, { record = true } = {}) {
    if (!selectedEl || guardLocked()) return;
    selEls().forEach((el) => { el.style.background = color; });
    syncFromPreviewDebounced();
    if (record) recordRecentColor(color);
  }

  function openFillPanel() {
    if (!selectedEl) return;
    closeFontPanel();
    closeEffectPanel();
    closeStylePanel();
    closeInsertPanel();
    renderRecentSwatches();
    fillPanel.hidden = false;
  }
  function closeFillPanel() { fillPanel.hidden = true; }

  renderBasicSwatches();
  // 직접 고르기: 끄는 동안은 실시간 반영만, 손을 떼면 최근 색에 기록
  $("#fillPicker").addEventListener("input", (e) => applyFill(e.target.value, { record: false }));
  $("#fillPicker").addEventListener("change", (e) => recordRecentColor(e.target.value));

  /* ---- 글자 효과 (그림자/외곽선/네온/입체) ---- */
  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  const TEXT_EFFECTS = {
    none: () => "",
    shadow: (c) => `3px 3px 8px ${hexToRgba(c, 0.55)}`,
    outline: (c) => `-2px 0 0 ${c}, 2px 0 0 ${c}, 0 -2px 0 ${c}, 0 2px 0 ${c}, -1.4px -1.4px 0 ${c}, 1.4px -1.4px 0 ${c}, -1.4px 1.4px 0 ${c}, 1.4px 1.4px 0 ${c}`,
    neon: (c) => `0 0 8px ${c}, 0 0 18px ${c}, 0 0 32px ${hexToRgba(c, 0.6)}`,
    d3: (c) => `1px 1px 0 ${c}, 2px 2px 0 ${c}, 3px 3px 0 ${c}, 4px 4px 0 ${c}`,
  };
  let lastEffect = "shadow";

  function applyTextEffect(type) {
    if (!selectedEl || guardLocked()) return;
    lastEffect = type;
    const value = TEXT_EFFECTS[type]($("#effectColor").value);
    selEls().forEach((el) => {
      if (value) el.style.textShadow = value;
      else el.style.removeProperty("text-shadow");
    });
    syncFromPreview();
  }

  function openEffectPanel() {
    if (!selectedEl) return;
    closeFontPanel();
    closeInsertPanel();
    closeFillPanel();
    closeStylePanel();
    effectPanel.hidden = false;
  }
  function closeEffectPanel() { effectPanel.hidden = true; }

  /* ---- 도형·스타일 패널 ---- */
  function rgbToHex(rgb) {
    if (!rgb || rgb === "transparent") return null;
    if (rgb.startsWith("#")) return rgb;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return "#" + [m[1], m[2], m[3]].map((n) => parseInt(n, 10).toString(16).padStart(2, "0")).join("");
  }

  function syncStylePanel(el) {
    if (!el) return;
    const win = iframe.contentWindow;
    const cs = win.getComputedStyle(el);
    const bgHex = rgbToHex(el.style.backgroundColor || cs.backgroundColor);
    if (bgHex) $("#shapeFill").value = bgHex;
    const opRaw = el.style.opacity !== "" && el.style.opacity != null ? el.style.opacity : cs.opacity;
    const opPct = isNaN(parseFloat(opRaw)) ? 100 : Math.round(parseFloat(opRaw) * 100);
    $("#shapeOpacity").value = opPct;
    $("#shapeOpacityVal").textContent = opPct + "%";
    const bsVal = el.style.borderStyle || cs.borderStyle || "none";
    const bsNorm = ["solid", "dashed", "dotted"].includes(bsVal) ? bsVal : "none";
    document.querySelectorAll(".bsb").forEach((b) => b.classList.toggle("active", b.dataset.bs === bsNorm));
    const bcHex = rgbToHex(el.style.borderColor || cs.borderColor);
    if (bcHex) $("#shapeBorderColor").value = bcHex;
    const bw = parseInt(el.style.borderWidth || cs.borderTopWidth || "0", 10) || 0;
    $("#shapeBorderWidth").value = bw;
    const br = Math.min(200, parseInt(el.style.borderRadius || cs.borderRadius || "0", 10) || 0);
    $("#shapeBorderRadius").value = br;
    $("#shapeRadiusVal").textContent = br + "px";
  }

  function openStylePanel() {
    if (!selectedEl) return;
    closeFontPanel();
    closeEffectPanel();
    closeFillPanel();
    closeInsertPanel();
    syncStylePanel(selectedEl);
    stylePanel.hidden = false;
  }
  function closeStylePanel() { stylePanel.hidden = true; }

  $("#shapeFill").addEventListener("input", (e) => {
    if (!selectedEl || guardLocked()) return;
    selEls().forEach((el) => { el.style.backgroundColor = e.target.value; });
    recordRecentColor(e.target.value);
    syncFromPreviewDebounced();
  });

  $("#shapeOpacity").addEventListener("input", (e) => {
    if (!selectedEl || guardLocked()) return;
    const v = parseInt(e.target.value, 10);
    selEls().forEach((el) => { el.style.opacity = v / 100; });
    $("#shapeOpacityVal").textContent = v + "%";
    syncFromPreviewDebounced();
  });

  document.querySelectorAll(".bsb").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!selectedEl || guardLocked()) return;
      const style = btn.dataset.bs;
      selEls().forEach((el) => {
        if (style === "none") {
          el.style.border = "none";
        } else {
          el.style.borderStyle = style;
          if (!parseInt(el.style.borderWidth || "0", 10)) el.style.borderWidth = "2px";
        }
      });
      if (style !== "none" && !parseInt(selectedEl.style.borderWidth || "0", 10)) {
        $("#shapeBorderWidth").value = 2;
      }
      document.querySelectorAll(".bsb").forEach((b) => b.classList.toggle("active", b === btn));
      syncFromPreview();
    });
  });

  $("#shapeBorderColor").addEventListener("input", (e) => {
    if (!selectedEl || guardLocked()) return;
    selEls().forEach((el) => { el.style.borderColor = e.target.value; });
    syncFromPreviewDebounced();
  });

  $("#shapeBorderWidth").addEventListener("change", (e) => {
    if (!selectedEl || guardLocked()) return;
    const w = Math.max(0, parseInt(e.target.value, 10) || 0);
    selEls().forEach((el) => {
      el.style.borderWidth = w + "px";
      if (w > 0 && (!el.style.borderStyle || el.style.borderStyle === "none")) {
        el.style.borderStyle = "solid";
      }
    });
    if (w > 0) document.querySelectorAll(".bsb").forEach((b) => b.classList.toggle("active", b.dataset.bs === (selectedEl.style.borderStyle || "solid")));
    syncFromPreview();
  });

  $("#shapeBorderRadius").addEventListener("input", (e) => {
    if (!selectedEl || guardLocked()) return;
    const r = parseInt(e.target.value, 10);
    selEls().forEach((el) => { el.style.borderRadius = r + "px"; });
    $("#shapeRadiusVal").textContent = r + "px";
    syncFromPreviewDebounced();
  });

  effectPanel.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-effect]");
    if (btn) applyTextEffect(btn.dataset.effect);
  });
  $("#effectColor").addEventListener("input", () => {
    if (lastEffect !== "none") applyTextEffect(lastEffect);
  });

  imgInput.addEventListener("change", () => {
    const file = imgInput.files[0];
    imgInput.value = "";
    if (!file || !selectedEl || selectedEl.tagName.toUpperCase() !== "IMG") return;
    if (guardLocked()) return;
    const reader = new FileReader();
    reader.onload = () => {
      selectedEl.src = reader.result;
      syncFromPreview();
      toast("이미지를 교체했어요", "image");
    };
    reader.readAsDataURL(file);
  });

  /* ============================================================
   * 삽입 (텍스트 / 도형 / 이모지 / 이미지) — 캔바식
   * ============================================================ */
  const EMOJI_CATEGORIES = [
    { name: "표정", icon: "😀", list: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","🙂","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","🥲","😋",
      "😛","😜","🤪","😝","🤗","🤭","🤫","🤔","🫡","😐","😶","🙄","😏","😌","😔","😪","🤤","😴","😷","🤒",
      "🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","🙁","😮","😯","😲","😳",
      "🥺","🥹","😦","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬",
      "😈","💀","👻","👽","🤖","💩","😺","😸","😹","😻",
    ]},
    { name: "사람", icon: "👋", list: [
      "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍",
      "👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","💪","🧠","👀","👁️","👄","🦷","👂","👃",
      "👶","🧒","👦","👧","🧑","👨","👩","🧓","👴","👵","👮","🕵️","💂","👷","🤴","👸","🦸","🦹","🧙","🧚",
      "🎅","🤶","🙇","🙋","🙆","🙅","💁","🤷","🤦","💃","🕺","🧍","🧎","🏃","🚶","🤸","🧘","👪","👫","👭",
    ]},
    { name: "하트", icon: "❤️", list: [
      "❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️",
      "💯","💢","💥","💫","💦","💨","💬","💭","💤","✨","⭐","🌟","🔥","🎉","🎊","🎈","🎁","🎀","🪄","🌈",
    ]},
    { name: "자연", icon: "🐶", list: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦",
      "🐤","🦆","🦅","🦉","🦇","🐺","🐴","🦄","🐝","🦋","🐌","🐞","🐜","🐢","🐍","🦖","🦕","🐙","🦀","🐠",
      "🐟","🐬","🐳","🦈","🐊","🐘","🦒","🦓","🦍","🐎","🐑","🐐","🦌","🐕","🐈","🕊️","🐇","🦝","🦦","🦥",
      "🌵","🎄","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🍁","🍂","🍃","🌷","🌹","🌺","🌸","🌼","🌻","🌞","🌝",
      "🌕","🌙","☀️","⛅","☁️","⚡","❄️","⛄","🌊","💧",
    ]},
    { name: "음식", icon: "🍎", list: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑",
      "🥦","🥬","🥒","🌶️","🌽","🥕","🥔","🍠","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🥞","🧇","🥓","🍗","🍖",
      "🌭","🍔","🍟","🍕","🥪","🌮","🌯","🥙","🍜","🍲","🍣","🍱","🍙","🍚","🍛","🍤","🍦","🍧","🍨","🍩",
      "🍪","🎂","🍰","🧁","🥧","🍫","🍬","🍭","🍮","🍯","🥛","🍼","☕","🍵","🧃","🥤","🧋","🍹","🍷","🥂",
    ]},
    { name: "활동", icon: "⚽", list: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🏒","⛳","🏹","🎣","🥊","🥋","🎽","⛸️",
      "🛹","🛼","🚴","🏊","⛷️","🏂","🏋️","🤺","🏇","⛹️","🏌️","🧗","🏄","🚣","🎯","🎮","🕹️","🎲","🧩","♟️",
      "🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🪕","🎻","🎪","🤹","🎳","🎰","🚗","✈️","🚀",
    ]},
    { name: "사물", icon: "📚", list: [
      "⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","📷","📸","📹","🎥","📞","☎️","📺","📻","⏰","⌛","⏳","📡","🔋",
      "🔌","💡","🔦","🕯️","🛒","💎","⚖️","🔧","🔨","⚙️","🧲","🧪","🧫","🧬","🔬","🔭","📚","📖","📒","📕",
      "📗","📘","📙","📃","📜","📄","📰","📑","🔖","🏷️","✏️","✒️","🖊️","🖍️","📝","💼","📁","📂","📅","📆",
      "📈","📉","📊","📋","📌","📍","📎","📏","📐","✂️","🔒","🔑","🎒","👑","🎓","🧸","🎺","🪅","🪩","🧮",
    ]},
    { name: "기호", icon: "✅", list: [
      "✅","❌","⭕","❗","❓","‼️","⁉️","🚫","♻️","✳️","❇️","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟥",
      "🟧","🟨","🟩","🟦","🟪","⬛","⬜","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🏁","🚩","🎌","➕","➖",
      "➗","✖️","💲","➡️","⬅️","⬆️","⬇️","↗️","↘️","↔️","🔄","🔝","🔙","🆕","🆓","🆒","🆗","🔅","🔆","📶",
      "💮","🏆","🥇","🥈","🥉","🎖️","🏅","📣","📢","🔔",
    ]},
  ];

  let emojiTabsBuilt = false;
  let emojiTabIdx = 0;

  function renderEmojiGrid() {
    const grid = $("#emojiGrid");
    grid.innerHTML = "";
    EMOJI_CATEGORIES[emojiTabIdx].list.forEach((em) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = em;
      b.title = "이모지 추가";
      b.addEventListener("click", () => insertEmoji(em));
      grid.appendChild(b);
    });
  }

  function buildEmojiGrid() {
    if (!emojiTabsBuilt) {
      emojiTabsBuilt = true;
      const tabs = $("#emojiTabs");
      EMOJI_CATEGORIES.forEach((cat, i) => {
        const t = document.createElement("button");
        t.type = "button";
        t.className = "emoji-tab" + (i === 0 ? " active" : "");
        t.textContent = `${cat.icon} ${cat.name}`;
        t.addEventListener("click", () => {
          emojiTabIdx = i;
          tabs.querySelectorAll(".emoji-tab").forEach((x, j) => x.classList.toggle("active", j === i));
          renderEmojiGrid();
        });
        tabs.appendChild(t);
      });
    }
    renderEmojiGrid();
  }

  function openInsertPanel() {
    if (!codeInput.value.trim()) {
      toast("먼저 HTML을 불러와 주세요", "info", true);
      return;
    }
    closeFontPanel();
    buildEmojiGrid();
    insertPanel.hidden = false;
  }
  function closeInsertPanel() { insertPanel.hidden = true; }

  insertFab.addEventListener("click", () => {
    insertPanel.hidden ? openInsertPanel() : closeInsertPanel();
  });
  $("#insertClose").addEventListener("click", closeInsertPanel);

  /** 삽입 대상 페이지: 선택 요소가 속한 페이지 → 화면 중앙에 보이는 페이지 → body */
  function insertTarget() {
    const doc = iframe.contentDocument;
    const pgs = (pages.length ? pages : detectPages()).filter((p) => p && p !== doc.body);
    if (selectedEl) {
      const host = pgs.find((p) => p.contains(selectedEl));
      if (host) return host;
    }
    if (pgs.length) {
      const vp = previewViewport.getBoundingClientRect();
      const cv = previewCanvas.getBoundingClientRect();
      const centerY = (vp.top + vp.height / 2 - cv.top) / (currentScale || 1);
      let best = pgs[0], bestDist = Infinity;
      pgs.forEach((p) => {
        const r = p.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - centerY);
        if (d < bestDist) { best = p; bestDist = d; }
      });
      return best;
    }
    return doc.body;
  }

  function insertIntoPage(el, { edit = false } = {}) {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;
    const target = insertTarget();
    const win = iframe.contentWindow;
    if (win.getComputedStyle(target).position === "static") target.style.position = "relative";
    target.appendChild(el);
    // 페이지 가운데에 배치
    const tr = target.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    el.style.left = Math.max(0, Math.round((tr.width - er.width) / 2)) + "px";
    el.style.top = Math.max(0, Math.round((tr.height - er.height) / 2)) + "px";
    selectElement(el);
    if (edit) {
      startTextEdit(el);
      selectAllTextIn(el);
    }
    syncFromPreview();
  }

  function makeDiv(cssText, text) {
    const div = iframe.contentDocument.createElement("div");
    div.style.cssText = cssText;
    if (text) div.textContent = text;
    return div;
  }

  const INSERTERS = {
    "heading": () => insertIntoPage(makeDiv(
      "position:absolute;margin:0;font-size:40px;font-weight:800;color:#1E2124;white-space:nowrap;",
      "제목을 입력하세요"), { edit: true }),
    "subheading": () => insertIntoPage(makeDiv(
      "position:absolute;margin:0;font-size:26px;font-weight:700;color:#1E2124;white-space:nowrap;",
      "부제목을 입력하세요"), { edit: true }),
    "body-text": () => insertIntoPage(makeDiv(
      "position:absolute;margin:0;font-size:16px;font-weight:400;color:#1E2124;width:60%;line-height:1.6;",
      "내용을 입력하세요"), { edit: true }),
    "text-box": () => insertIntoPage(makeDiv(
      "position:absolute;margin:0;padding:12px 24px;background:#246BEB;color:#ffffff;font-size:20px;font-weight:700;border-radius:10px;white-space:nowrap;",
      "텍스트 상자"), { edit: true }),
    "rect": () => insertIntoPage(makeDiv("position:absolute;width:120px;height:120px;background:#246BEB;")),
    "rounded": () => insertIntoPage(makeDiv("position:absolute;width:120px;height:120px;background:#246BEB;border-radius:16px;")),
    "circle": () => insertIntoPage(makeDiv("position:absolute;width:120px;height:120px;background:#246BEB;border-radius:50%;")),
    "triangle": () => insertIntoPage(makeDiv("position:absolute;width:130px;height:120px;background:#246BEB;clip-path:polygon(50% 0, 100% 100%, 0 100%);")),
    "line": () => insertIntoPage(makeDiv("position:absolute;width:200px;height:6px;background:#1E2124;border-radius:3px;")),
    "image": () => insertImgInput.click(),
  };

  insertPanel.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ins]");
    if (!btn) return;
    const fn = INSERTERS[btn.dataset.ins];
    if (!fn) return;
    fn();
    if (btn.dataset.ins !== "image") closeInsertPanel();
  });

  function insertEmoji(em) {
    insertIntoPage(makeDiv("position:absolute;margin:0;font-size:64px;line-height:1;", em));
    // 이모지는 연속 삽입할 수 있도록 패널을 닫지 않음
  }

  insertImgInput.addEventListener("change", () => {
    const file = insertImgInput.files[0];
    insertImgInput.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const doc = iframe.contentDocument;
      const img = doc.createElement("img");
      img.src = String(reader.result);
      img.style.cssText = "position:absolute;height:auto;";
      const apply = () => {
        const target = insertTarget();
        const tw = target.getBoundingClientRect().width || 400;
        img.style.width = Math.round(Math.min(tw * 0.5, img.naturalWidth || tw * 0.5)) + "px";
        insertIntoPage(img);
        closeInsertPanel();
        toast("이미지를 추가했어요. 모서리를 끌면 크기를 조절해요", "add_photo_alternate");
      };
      if (img.decode) img.decode().then(apply).catch(apply);
      else { img.onload = apply; }
    };
    reader.readAsDataURL(file);
  });

  /* ============================================================
   * 모드 / 배율
   * ============================================================ */
  function setEditMode(on) {
    editMode = on;
    $("#modeEdit").classList.toggle("active", on);
    $("#modeView").classList.toggle("active", !on);
    document.body.classList.toggle("mode-view", !on);
    if (!on) { clearSelection(); closeInsertPanel(); }
    refreshPageMarkers();
    updateHandles();
  }
  $("#modeEdit").addEventListener("click", () => setEditMode(true));
  $("#modeView").addEventListener("click", () => setEditMode(false));

  zoomSelect.addEventListener("change", () => {
    zoomMode = zoomSelect.value;
    applyZoom();
  });

  /** 콘텐츠에 실제로 필요한 가로 폭.
   *  가운데 정렬된 고정폭 페이지가 왼쪽으로 넘치면 scrollWidth로는
   *  그 넘침이 측정되지 않으므로 body 자식들의 바운딩 박스로 보완한다. */
  function measureNeededWidth(doc, cur) {
    let minL = 0, maxR = cur;
    [...doc.body.children].forEach((el) => {
      if (String(el.className).includes("__lh_")) return;
      const tag = el.tagName.toUpperCase();
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK") return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      minL = Math.min(minL, r.left);
      maxR = Math.max(maxR, r.right);
    });
    return Math.max(
      doc.documentElement.scrollWidth,
      doc.body ? doc.body.scrollWidth : 0,
      Math.ceil(maxR - minL)
    );
  }

  function applyZoom() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.documentElement || !doc.body || !codeInput.value.trim()) return;
    const pad = 40;
    const baseW = Math.max(320, previewViewport.clientWidth - pad);

    // 콘텐츠 실제 너비 측정 (고정폭 카드뉴스 대응) — 수렴할 때까지 넓혀가며 반복
    iframe.style.transform = "none";
    iframe.style.height = "10px";
    let contentW = baseW;
    iframe.style.width = contentW + "px";
    for (let i = 0; i < 4; i++) {
      const need = measureNeededWidth(doc, contentW);
      if (need <= contentW + 1) break;
      contentW = need;
      iframe.style.width = contentW + "px";
    }
    const contentH = Math.max(
      doc.documentElement.scrollHeight,
      doc.body ? doc.body.scrollHeight : 0,
      80
    );
    iframe.style.height = contentH + "px";
    lastContentH = contentH;

    let scale;
    if (zoomMode === "fit") {
      const baseH = Math.max(200, previewViewport.clientHeight - pad);
      let firstPageH = contentH;
      const pts = detectPages();
      if (pts.length > 0 && pts[0] !== doc.body) {
        const ph = pts[0].getBoundingClientRect().height;
        if (ph > 10) firstPageH = ph;
      }
      scale = Math.min(1, baseW / contentW, baseH / firstPageH);
    } else {
      scale = parseInt(zoomMode, 10) / 100;
    }
    currentScale = scale;
    iframe.style.transform = `scale(${scale})`;
    previewCanvas.style.width = contentW * scale + "px";
    previewCanvas.style.height = contentH * scale + "px";

    if (zoomMode === "fit") previewViewport.scrollLeft = 0;

    refreshPageMarkers();
    updateHandles();
  }
  const applyZoomDebounced = debounce(applyZoom, 300);
  window.addEventListener("resize", applyZoomDebounced);
  // 화면 회전: 일부 브라우저는 회전 후 resize가 늦거나 빠져서 배율이 어긋남
  window.addEventListener("orientationchange", () => {
    setTimeout(applyZoom, 400);
    setTimeout(applyZoom, 900);
  });
  // 미리보기 영역 자체의 크기 변화를 직접 감지 (회전·패널 크기 조절 모두 대응)
  new ResizeObserver(() => applyZoomDebounced()).observe(previewViewport);

  /* ============================================================
   * 입력: 타이핑 / 업로드 / 붙여넣기 / 지우기
   * ============================================================ */
  const renderDebounced = debounce(() => {
    renderPreview();
    pushHistoryDebounced(codeInput.value);
  }, 400);

  codeInput.addEventListener("input", () => {
    updateStat();
    renderDebounced();
  });

  // Tab 키로 들여쓰기
  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = codeInput;
      codeInput.setRangeText("  ", s, en, "end");
      updateStat();
      renderDebounced();
    }
  });

  function loadFile(file) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name) && !file.type.includes("html")) {
      toast("HTML 파일만 불러올 수 있어요", "error", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCode(String(reader.result));
      setCurrentDesign(null); // 새 파일은 기존 디자인과 연결 끊기
      toast(`'${file.name}' 파일을 불러왔어요`, "upload_file");
      switchTab("preview");
    };
    reader.readAsText(file);
  }

  fileInput.addEventListener("change", () => {
    loadFile(fileInput.files[0]);
    fileInput.value = "";
  });

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast("클립보드가 비어 있어요", "content_paste_off", true);
        return;
      }
      setCode(text);
      setCurrentDesign(null);
      toast("클립보드 내용을 불러왔어요", "content_paste");
      switchTab("preview");
    } catch (_) {
      toast("브라우저 권한이 필요해요. 코드창에 직접 붙여넣어 주세요", "info", true);
      switchTab("code");
      codeInput.focus();
    }
  }

  $("#btnUpload").addEventListener("click", () => fileInput.click());
  $("#emptyUpload").addEventListener("click", () => fileInput.click());
  $("#btnPaste").addEventListener("click", pasteFromClipboard);
  $("#emptyPaste").addEventListener("click", pasteFromClipboard);
  $("#emptySample").addEventListener("click", () => openTemplates());

  $("#btnClear").addEventListener("click", () => {
    if (!codeInput.value.trim()) return;
    if (!confirm("작성 중인 내용을 모두 지울까요?")) return;
    setCode("");
    setCurrentDesign(null);
    toast("내용을 지웠어요", "delete_sweep");
  });

  // 파일 드래그 & 드롭
  let dragDepth = 0;
  document.addEventListener("dragenter", (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) {
      dragDepth++;
      $("#dropOverlay").hidden = false;
    }
  });
  document.addEventListener("dragleave", () => {
    if (--dragDepth <= 0) { dragDepth = 0; $("#dropOverlay").hidden = true; }
  });
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    $("#dropOverlay").hidden = true;
    loadFile(e.dataTransfer.files[0]);
  });

  /* ============================================================
   * 공유 / 복사 / 다운로드
   * ============================================================ */
  function requireContent() {
    if (codeInput.value.trim()) return true;
    toast("먼저 HTML을 불러와 주세요", "info", true);
    return false;
  }

  async function copyCode() {
    if (!requireContent()) return;
    try {
      await navigator.clipboard.writeText(codeInput.value);
      toast("HTML 코드를 복사했어요", "content_copy");
    } catch (_) {
      codeInput.select();
      document.execCommand("copy");
      toast("HTML 코드를 복사했어요", "content_copy");
    }
  }

  async function shareCode() {
    if (!requireContent()) return;
    const file = new File([codeInput.value], "live-html.html", { type: "text/html" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Live HTML" });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(codeInput.value);
      toast("공유를 지원하지 않아 코드를 복사했어요", "content_copy");
    } catch (_) {
      toast("공유를 지원하지 않는 브라우저예요", "error", true);
    }
  }

  $("#btnCopyCode").addEventListener("click", copyCode);

  function downloadHTML() {
    downloadBlob(new Blob([codeInput.value], { type: "text/html;charset=utf-8" }), "live-html.html");
    toast("HTML 파일을 저장했어요", "download_done");
  }

  /* ---- 다운로드 모달 ---- */
  const downloadModal = $("#downloadModal");
  const dlPngBtn = $("#dlPng");
  const dlPngLabel = $("#dlPngLabel");
  let detectedPages = [];

  function openDownloadModal() {
    if (!requireContent()) return;
    clearSelection();
    detectedPages = detectPages();
    const list = $("#pngPages");
    list.innerHTML = "";
    detectedPages.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const label = document.createElement("label");
      label.className = "png-page";
      label.innerHTML = `
        <input type="checkbox" checked data-idx="${i}" />
        <span>페이지 ${i + 1}</span>
        <span class="dim">${Math.round(r.width)} × ${Math.round(r.height)}px</span>`;
      list.appendChild(label);
    });
    $("#pngToggleAll").textContent = "전체 해제";
    // 페이지가 1개뿐이면 '한 장으로' 모드 의미가 없으므로 숨김
    $("#dlModes").style.display = detectedPages.length > 1 ? "" : "none";
    $(".png-pages-head").style.display = detectedPages.length > 1 ? "" : "none";
    downloadModal.hidden = false;
  }

  function closeDownloadModal() { downloadModal.hidden = true; }

  $("#btnDownload").addEventListener("click", openDownloadModal);
  $("#dlClose").addEventListener("click", closeDownloadModal);
  downloadModal.addEventListener("click", (e) => {
    if (e.target === downloadModal) closeDownloadModal();
  });
  $("#dlHtml").addEventListener("click", () => {
    downloadHTML();
    closeDownloadModal();
  });
  $("#dlCopy").addEventListener("click", async () => {
    await copyCode();
    closeDownloadModal();
  });
  $("#dlShare").addEventListener("click", async () => {
    closeDownloadModal();
    await shareCode();
  });

  /* ---- 도움말 ---- */
  const helpModal = $("#helpModal");
  function openHelp() { helpModal.hidden = false; }
  function closeHelp() { helpModal.hidden = true; }
  $("#btnHelp").addEventListener("click", openHelp);
  $("#helpClose").addEventListener("click", closeHelp);
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) closeHelp();
  });
  $("#pngToggleAll").addEventListener("click", () => {
    const boxes = [...$("#pngPages").querySelectorAll("input")];
    const allChecked = boxes.every((b) => b.checked);
    boxes.forEach((b) => { b.checked = !allChecked; });
    $("#pngToggleAll").textContent = allChecked ? "전체 선택" : "전체 해제";
  });

  /* ---- PNG 내보내기 ---- */
  function ensureHtml2Canvas() {
    const win = iframe.contentWindow;
    if (win.html2canvas) return Promise.resolve(win.html2canvas);
    return new Promise((resolve, reject) => {
      const doc = iframe.contentDocument;
      const s = doc.createElement("script");
      s.src = H2C_SRC;
      s.setAttribute("data-lh", "");
      s.onload = () => resolve(win.html2canvas);
      s.onerror = () => reject(new Error("html2canvas load failed"));
      (doc.head || doc.documentElement).appendChild(s);
    });
  }

  const canvasToBlob = (canvas) =>
    new Promise((res) => canvas.toBlob(res, "image/png"));

  $("#dlPng").addEventListener("click", async () => {
    const checked = [...$("#pngPages").querySelectorAll("input:checked")]
      .map((c) => detectedPages[+c.dataset.idx])
      .filter(Boolean);
    if (!checked.length) {
      toast("저장할 페이지를 선택해 주세요", "info", true);
      return;
    }
    const mode = (document.querySelector("input[name='pngMode']:checked") || {}).value || "each";
    // 내보내기 크기: 표준이면 긴 변이 1920px가 되도록 확대 (정사각 600px → 1920×1920)
    const targetSide = parseInt($("#pngSize").value, 10) || 0;
    dlPngBtn.disabled = true;
    clearPageMarkers(); // 점선·라벨이 이미지에 찍히지 않도록 제거
    try {
      const h2c = await ensureHtml2Canvas();
      const canvases = [];
      for (let i = 0; i < checked.length; i++) {
        dlPngLabel.textContent = `변환 중… (${i + 1}/${checked.length})`;
        const r = checked[i].getBoundingClientRect();
        const maxSide = Math.max(r.width, r.height) || 1;
        const scale = targetSide ? Math.min(8, Math.max(1, targetSide / maxSide)) : 1;
        canvases.push(await h2c(checked[i], {
          scale, useCORS: true, allowTaint: false, logging: false,
        }));
      }

      if (mode === "merge" && canvases.length > 1) {
        // 세로로 이어붙여 한 장으로
        const width = Math.max(...canvases.map((c) => c.width));
        const height = canvases.reduce((sum, c) => sum + c.height, 0);
        const merged = document.createElement("canvas");
        merged.width = width;
        merged.height = height;
        const ctx = merged.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        let y = 0;
        canvases.forEach((c) => {
          ctx.drawImage(c, Math.round((width - c.width) / 2), y);
          y += c.height;
        });
        downloadBlob(await canvasToBlob(merged), "live-html.png");
        toast("한 장으로 이어붙인 PNG를 저장했어요", "photo_library");
      } else if (canvases.length === 1) {
        downloadBlob(await canvasToBlob(canvases[0]), "live-html.png");
        toast("PNG를 저장했어요", "photo_library");
      } else {
        // 여러 장은 ZIP으로 묶어 한 번에
        dlPngLabel.textContent = "압축 중…";
        try {
          const JSZip = await loadScriptOnce(JSZIP_SRC, () => window.JSZip);
          const zip = new JSZip();
          for (let i = 0; i < canvases.length; i++) {
            zip.file(`live-html_p${i + 1}.png`, await canvasToBlob(canvases[i]));
          }
          const blob = await zip.generateAsync({ type: "blob" });
          downloadBlob(blob, "live-html_png.zip");
          toast(`PNG ${canvases.length}장을 ZIP으로 저장했어요`, "folder_zip");
        } catch (_) {
          // ZIP 라이브러리를 못 불러오면 낱장으로 순차 저장
          for (let i = 0; i < canvases.length; i++) {
            downloadBlob(await canvasToBlob(canvases[i]), `live-html_p${i + 1}.png`);
            await new Promise((r) => setTimeout(r, 350));
          }
          toast(`PNG ${canvases.length}장을 저장했어요`, "photo_library");
        }
      }
      closeDownloadModal();
    } catch (err) {
      console.error(err);
      toast("이미지 변환에 실패했어요. 외부 이미지가 차단됐을 수 있어요", "error", true);
    } finally {
      dlPngBtn.disabled = false;
      dlPngLabel.textContent = "PNG 저장";
      refreshPageMarkers();
    }
  });

  /* ============================================================
   * 모바일 탭 / 패널 크기 조절 / 단축키
   * ============================================================ */
  function switchTab(name) {
    document.body.classList.toggle("view-code", name === "code");
    document.body.classList.toggle("view-preview", name === "preview");
    $("#tabCode").classList.toggle("active", name === "code");
    $("#tabPreview").classList.toggle("active", name === "preview");
    if (name === "preview") applyZoom();
  }
  $("#tabCode").addEventListener("click", () => switchTab("code"));
  $("#tabPreview").addEventListener("click", () => switchTab("preview"));

  // 데스크톱: 코드/미리보기 패널 너비 조절
  const gutter = $("#gutter");
  gutter.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    gutter.classList.add("dragging");
    gutter.setPointerCapture(e.pointerId);
    const codePane = $(".code-pane");
    const move = (ev) => {
      const rect = $(".app-main").getBoundingClientRect();
      const ratio = Math.min(0.7, Math.max(0.2, (ev.clientX - rect.left) / rect.width));
      codePane.style.flexBasis = ratio * 100 + "%";
      applyZoomDebounced();
    };
    const up = () => {
      gutter.classList.remove("dragging");
      gutter.removeEventListener("pointermove", move);
      gutter.removeEventListener("pointerup", up);
    };
    gutter.addEventListener("pointermove", move);
    gutter.addEventListener("pointerup", up);
  });

  $("#btnUndo").addEventListener("click", () => applyHistory(-1));
  $("#btnRedo").addEventListener("click", () => applyHistory(1));

  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const inField = document.activeElement === codeInput ||
      document.activeElement === fontSearch ||
      document.activeElement === fontSizeInput;
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
      if (!inField) { e.preventDefault(); applyHistory(-1); }
    } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
      if (!inField) { e.preventDefault(); applyHistory(1); }
    } else if (e.key === "Escape") {
      if (!fontPanel.hidden) closeFontPanel();
      else if (!effectPanel.hidden) closeEffectPanel();
      else if (!fillPanel.hidden) closeFillPanel();
      else if (!stylePanel.hidden) closeStylePanel();
      else if (!insertPanel.hidden) closeInsertPanel();
      else if (!downloadModal.hidden) closeDownloadModal();
      else if (!mcModal.hidden) closeMagic();
      else if (!templateModal.hidden) closeTemplates();
      else if (!helpModal.hidden) closeHelp();
      else if (!$("#adminOverlay").hidden) $("#adminClose").click();
      else clearSelection();
    } else if (e.key === "Delete" && selectedEl && !inField) {
      deleteSelected();
    } else if (e.key.startsWith("Arrow") && selectedEl && !inField && !editingEl) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const [dx, dy] = map[e.key] || [0, 0];
      nudgeSelected(dx, dy);
    } else if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (!codeInput.value.trim()) return;
      // 관리자 모드에서는 내 디자인에 저장, 아니면 HTML 파일 다운로드
      if (adminUnlocked) saveToCurrent();
      else downloadHTML();
    }
  });

  /* ============================================================
   * 예시 카드뉴스
   * ============================================================ */
  const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>예시 카드뉴스</title>
<style>
  body { margin: 0; padding: 24px; background: #f0f2f5; font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; display: flex; flex-direction: column; align-items: center; gap: 24px; }
  .page { width: 600px; height: 600px; border-radius: 24px; padding: 56px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; color: #fff; position: relative; overflow: hidden; }
  .page-1 { background: linear-gradient(135deg, #246BEB 0%, #5E8BFF 60%, #9DB9FF 100%); align-items: center; text-align: center; }
  .page-2 { background: #ffffff; color: #1E2124; }
  .page-3 { background: linear-gradient(160deg, #1E2124 0%, #3A4A66 100%); align-items: center; text-align: center; }
  .badge { background: rgba(255,255,255,.25); padding: 8px 20px; border-radius: 999px; font-size: 16px; font-weight: 700; }
  h1 { font-size: 44px; margin: 24px 0 12px; line-height: 1.3; letter-spacing: -0.02em; }
  h2 { font-size: 30px; margin: 0 0 24px; color: #246BEB; }
  .sub { font-size: 18px; opacity: .9; margin: 0; line-height: 1.6; }
  .tip { background: #ECF2FE; border-radius: 16px; padding: 20px 24px; margin-bottom: 14px; }
  .tip strong { display: block; font-size: 18px; margin-bottom: 4px; color: #18408C; }
  .tip span { font-size: 15px; color: #6D7882; }
  .big { font-size: 56px; margin: 0 0 16px; }
  .deco { position: absolute; border-radius: 50%; background: rgba(255,255,255,.12); }
</style>
</head>
<body>
  <div class="page page-1">
    <div class="deco" style="width:220px;height:220px;top:-70px;right:-70px;"></div>
    <div class="deco" style="width:140px;height:140px;bottom:-40px;left:-40px;"></div>
    <span class="badge">Live HTML 예시</span>
    <h1>화면을 눌러서<br>바로 고쳐보세요!</h1>
    <p class="sub">이 글자를 두 번 누르면 내용을 바꿀 수 있고,<br>한 번 누른 뒤 끌면 위치도 옮길 수 있어요.</p>
  </div>

  <div class="page page-2">
    <h2>이렇게 사용해요</h2>
    <div class="tip"><strong>① 한 번 클릭 = 선택</strong><span>도구 막대로 글꼴·크기·색을, 모서리 핸들로 크기를 바꿔요</span></div>
    <div class="tip"><strong>② 두 번 클릭 = 글자 수정</strong><span>코드를 몰라도 내용을 바로 고칠 수 있어요</span></div>
    <div class="tip"><strong>③ 오른쪽 아래 + 버튼</strong><span>텍스트·도형·이모지·이미지를 추가할 수 있어요</span></div>
  </div>

  <div class="page page-3">
    <p class="big">🎉</p>
    <h1 style="font-size:36px;">완성되면 다운로드!</h1>
    <p class="sub">HTML은 물론, 페이지별 PNG나<br>한 장으로 이어붙인 PNG로도 받을 수 있어요.</p>
  </div>
</body>
</html>`;

  /* ============================================================
   * 템플릿 갤러리 — 테마 × (카드뉴스/포스터/PPT) 세트
   * 테마·빌더 데이터는 js/templates.js 에서 제공
   * ============================================================ */
  const TplLib = window.LiveHTMLTemplates;
  const templateModal = $("#templateModal");
  let tplFormat = "cardnews";
  let tplQuery = "";
  let tplBuilt = false;

  function tplInsert(html, label) {
    if (codeInput.value.trim() && !confirm("지금 작업 중인 내용을 이 템플릿으로 바꿀까요?")) return;
    setCode(html);
    setCurrentDesign(null);
    closeTemplates();
    switchTab("preview");
    toast(`'${label}' 템플릿을 불러왔어요. 화면을 눌러서 고쳐보세요!`, "space_dashboard");
  }

  function renderTplFormats() {
    const wrap = $("#tplFormats");
    wrap.innerHTML = "";
    Object.values(TplLib.FORMATS).forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tpl-chip" + (f.id === tplFormat ? " active" : "");
      b.innerHTML = `<span class="material-symbols-outlined">${f.icon}</span>${f.name} <small>${f.w}×${f.h}</small>`;
      b.addEventListener("click", () => {
        tplFormat = f.id;
        renderTplFormats();
        renderTplBasic();
        renderTplGrid();
      });
      wrap.appendChild(b);
    });
  }

  function renderTplBasic() {
    const fmt = TplLib.FORMATS[tplFormat];
    const wrap = $("#tplBasic");
    wrap.innerHTML = "";
    const mk = (icon, name, sub, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tpl-basic-card";
      b.innerHTML = `<span class="material-symbols-outlined">${icon}</span><strong></strong><small></small>`;
      b.querySelector("strong").textContent = name;
      b.querySelector("small").textContent = sub;
      b.addEventListener("click", fn);
      wrap.appendChild(b);
    };
    mk("crop_free", "빈 캔버스", `${fmt.name} · ${fmt.w}×${fmt.h}`,
      () => tplInsert(TplLib.buildBlank(tplFormat), "빈 캔버스"));
    mk("school", "사용법 예시", "기능을 익히는 연습용 카드뉴스",
      () => tplInsert(SAMPLE_HTML, "사용법 예시"));
  }

  function renderTplGrid() {
    const grid = $("#tplGrid");
    grid.innerHTML = "";
    const q = tplQuery.trim().toLowerCase();
    const fmt = TplLib.FORMATS[tplFormat];
    let count = 0;
    TplLib.THEMES.forEach((t) => {
      const hay = (t.name + " " + t.desc + " " + t.tags.join(" ")).toLowerCase();
      if (q && !hay.includes(q)) return;
      count++;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "theme-card";
      card.title = `'${t.name}' 테마로 ${fmt.name} 시작`;

      const prev = document.createElement("span");
      prev.className = "theme-prev";
      prev.style.background = t.page;
      prev.style.aspectRatio = `${fmt.w} / ${fmt.h}`;
      prev.innerHTML =
        `<span class="tp-badge"></span>` +
        `<span class="tp-title"></span>` +
        `<span class="tp-bar"></span>`;
      const badge = prev.querySelector(".tp-badge");
      badge.textContent = t.sample.badge;
      badge.style.background = t.primary;
      badge.style.color = t.badgeInk || "#fff";
      const title = prev.querySelector(".tp-title");
      title.textContent = t.sample.title.replace(/<br\s*\/?>/gi, " ");
      title.style.color = t.ink;
      prev.querySelector(".tp-bar").style.background = t.primary;

      const meta = document.createElement("span");
      meta.className = "theme-meta";
      meta.innerHTML = `<strong></strong><small></small><span class="theme-tags"></span>`;
      meta.querySelector("strong").textContent = `${t.emoji} ${t.name}`;
      meta.querySelector("small").textContent = t.desc;
      meta.querySelector(".theme-tags").textContent = t.tags.map((x) => "#" + x).join(" ");

      card.append(prev, meta);
      card.addEventListener("click", () =>
        tplInsert(TplLib.buildTemplate(t.id, tplFormat), `${t.name} ${fmt.name}`));
      grid.appendChild(card);
    });
    $("#tplEmpty").hidden = count > 0;
  }

  function openTemplates() {
    if (!tplBuilt) {
      tplBuilt = true;
      $("#tplSearch").addEventListener("input", (e) => {
        tplQuery = e.target.value;
        renderTplGrid();
      });
    }
    renderTplFormats();
    renderTplBasic();
    renderTplGrid();
    templateModal.hidden = false;
    if (window.matchMedia("(hover: hover)").matches) $("#tplSearch").focus();
  }
  function closeTemplates() { templateModal.hidden = true; }

  $("#tplClose").addEventListener("click", closeTemplates);
  templateModal.addEventListener("click", (e) => {
    if (e.target === templateModal) closeTemplates();
  });

  /* ============================================================
   * 매직 체인지 — 페이지 크기 변환 (카드뉴스 ↔ 포스터 ↔ PPT …)
   * 내용 전체를 래퍼에 담아 비율에 맞게 scale하고 가운데 배치.
   * 원본 크기는 data-lh-mc-w/h에 보존되어 몇 번이고 다시 변환 가능.
   * ============================================================ */
  const MC_FORMATS = [
    { id: "cardnews", name: "카드뉴스 정사각", w: 1920, h: 1920, icon: "crop_square", sub: "인스타그램 피드 · 고해상도" },
    { id: "story", name: "세로형 · 스토리", w: 1080, h: 1920, icon: "crop_portrait", sub: "릴스 · 스토리 · 세로 포스터" },
    { id: "poster", name: "포스터 A4", w: 794, h: 1123, icon: "description", sub: "인쇄용 세로 A4" },
    { id: "slides", name: "PPT 슬라이드", w: 1920, h: 1080, icon: "slideshow", sub: "16:9 발표 화면 (FHD)" },
  ];

  const mcModal = $("#mcModal");

  function mcPages() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return [];
    return (pages.length ? pages : detectPages()).filter((p) => p !== doc.body);
  }

  function openMagic() {
    if (!requireContent()) return;
    clearSelection();
    const pgs = mcPages();
    if (!pgs.length) {
      toast("페이지 구조를 찾지 못했어요. .page나 section으로 감싸 주세요", "error", true);
      return;
    }
    const r = pgs[0].getBoundingClientRect();
    const cw = Math.round(r.width), ch = Math.round(r.height);
    $("#mcCurrent").textContent = `${cw} × ${ch}px · ${pgs.length}페이지`;

    const wrap = $("#mcOptions");
    wrap.innerHTML = "";
    MC_FORMATS.forEach((f) => {
      const isNow = Math.abs(f.w - cw) < 4 && Math.abs(f.h - ch) < 4;
      const b = document.createElement("button");
      b.className = "dl-option";
      b.innerHTML = `
        <span class="dl-ic"><span class="material-symbols-outlined">${f.icon}</span></span>
        <span class="dl-text"><strong></strong><small></small></span>
        ${isNow ? '<span class="mc-now">현재 크기</span>' : '<span class="material-symbols-outlined arrow">chevron_right</span>'}`;
      b.querySelector("strong").textContent = `${f.name} (${f.w}×${f.h})`;
      b.querySelector("small").textContent = f.sub;
      b.disabled = isNow;
      b.addEventListener("click", () => {
        magicChange(f);
        closeMagic();
      });
      wrap.appendChild(b);
    });
    mcModal.hidden = false;
  }
  function closeMagic() { mcModal.hidden = true; }

  function magicChange(target) {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    const pgs = mcPages();
    if (!pgs.length) return;
    pgs.forEach((el) => {
      const cs = win.getComputedStyle(el);
      let inner = [...el.children].find((c) => c.hasAttribute && c.hasAttribute("data-lh-mc"));
      if (!inner) {
        // 처음 변환: 페이지 내용을 래퍼로 감싸고 원본 레이아웃을 그대로 보존
        const cw = el.clientWidth;
        const ch = el.clientHeight;
        inner = doc.createElement("div");
        inner.setAttribute("data-lh-mc", "");
        inner.setAttribute("data-lh-mc-w", String(cw));
        inner.setAttribute("data-lh-mc-h", String(ch));
        inner.style.cssText =
          `box-sizing:border-box;width:${cw}px;height:${ch}px;position:absolute;transform-origin:top left;` +
          `padding:${cs.padding};display:${cs.display};flex-direction:${cs.flexDirection};` +
          `justify-content:${cs.justifyContent};align-items:${cs.alignItems};gap:${cs.gap};` +
          `text-align:${cs.textAlign};`;
        while (el.firstChild) inner.appendChild(el.firstChild);
        el.appendChild(inner);
        el.style.padding = "0";
      }
      const ow = parseFloat(inner.getAttribute("data-lh-mc-w")) || 1;
      const oh = parseFloat(inner.getAttribute("data-lh-mc-h")) || 1;
      const s = Math.min(target.w / ow, target.h / oh);
      inner.style.transform = `scale(${s})`;
      inner.style.left = Math.round((target.w - ow * s) / 2) + "px";
      inner.style.top = Math.round((target.h - oh * s) / 2) + "px";
      el.style.width = target.w + "px";
      el.style.height = target.h + "px";
      el.style.boxSizing = "border-box";
      el.style.maxWidth = "none";
      el.style.minHeight = "0";
      el.style.overflow = "hidden";
      if (cs.position === "static") el.style.position = "relative";
    });
    syncFromPreview();
    applyZoom();
    toast(`${target.name} 크기로 변환했어요. Ctrl+Z로 되돌릴 수 있어요`, "magic_exchange");
  }

  $("#btnMagic").addEventListener("click", openMagic);
  $("#mcClose").addEventListener("click", closeMagic);
  mcModal.addEventListener("click", (e) => {
    if (e.target === mcModal) closeMagic();
  });

  /* ============================================================
   * 관리자 대시보드 — 내 디자인
   * (숨김 진입: 로고 5번 연속 클릭 또는 주소 끝에 #admin)
   * 저장: 이 브라우저(localStorage) / 선택: Google Apps Script 백업
   * ============================================================ */
  const DESIGNS_KEY = "livehtml:designs";
  const GAS_KEY = "livehtml:gasUrl";
  const GAS_TOKEN_KEY = "livehtml:gasToken";
  const AUTOSYNC_KEY = "livehtml:autoSync";
  const adminOverlay = $("#adminOverlay");
  const designListEl = $("#designList");
  const gasUrlInput = $("#gasUrl");
  const gasTokenInput = $("#gasToken");

  // 저장된 GAS 주소: 코드에 박아둔 값(CONFIG) → 브라우저 저장값 순으로 사용
  function savedGasUrl() {
    try { return (localStorage.getItem(GAS_KEY) || CONFIG.GAS_URL || "").trim(); }
    catch (_) { return (CONFIG.GAS_URL || "").trim(); }
  }
  // 비밀번호(토큰): 절대 코드/저장소에 넣지 않고 이 브라우저에만 저장 → 외부 노출 방지
  function savedGasToken() {
    try { return (localStorage.getItem(GAS_TOKEN_KEY) || CONFIG.GAS_TOKEN || "").trim(); }
    catch (_) { return (CONFIG.GAS_TOKEN || "").trim(); }
  }
  let autoSync = false;
  try {
    const raw = localStorage.getItem(AUTOSYNC_KEY);
    autoSync = raw === null ? !!CONFIG.AUTO_SYNC : raw === "1";
  } catch (_) { autoSync = !!CONFIG.AUTO_SYNC; }
  let lastSyncAt = 0;
  try { lastSyncAt = parseInt(localStorage.getItem("livehtml:lastSync"), 10) || 0; } catch (_) {}

  let designs = [];
  try { designs = JSON.parse(localStorage.getItem(DESIGNS_KEY)) || []; } catch (_) {}
  let adminView = localStorage.getItem("livehtml:adminView") || "card";

  // 관리자 모드는 한 번 열면 헤더에 [저장]/[내 디자인] 버튼이 계속 보임
  let adminUnlocked = false;
  try { adminUnlocked = localStorage.getItem("livehtml:adminUnlocked") === "1"; } catch (_) {}
  // 지금 편집 중인 디자인 (헤더 [저장]이 여기에 바로 덮어씀)
  let currentDesignId = null;
  try { currentDesignId = localStorage.getItem("livehtml:currentDesign") || null; } catch (_) {}

  function currentDesign() {
    return designs.find((d) => d.id === currentDesignId) || null;
  }

  function setCurrentDesign(id) {
    currentDesignId = id;
    try {
      if (id) localStorage.setItem("livehtml:currentDesign", id);
      else localStorage.removeItem("livehtml:currentDesign");
    } catch (_) {}
    updateAdminUI();
  }

  function setAdminUnlocked(on) {
    adminUnlocked = on;
    try { localStorage.setItem("livehtml:adminUnlocked", on ? "1" : "0"); } catch (_) {}
    updateAdminUI();
  }

  function updateAdminUI() {
    if (currentDesignId && !currentDesign()) currentDesignId = null; // 삭제된 디자인 정리
    document.body.classList.toggle("admin-unlocked", adminUnlocked);
    $("#btnSaveDesign").hidden = !adminUnlocked;
    $("#btnMyDesigns").hidden = !adminUnlocked;
    $("#btnMyDesigns").classList.toggle("active", !adminOverlay.hidden);
    const d = currentDesign();
    $("#btnSaveDesign").title = d ? `'${d.name}'에 저장 (Ctrl+S)` : "내 디자인에 새로 저장 (Ctrl+S)";
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function persistDesigns() {
    let ok = true;
    try {
      localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs));
    } catch (_) {
      toast("저장 공간이 가득 찼어요. 오래된 디자인을 지우거나 클라우드 백업을 사용하세요", "error", true);
      ok = false;
    }
    // 자동 백업이 켜져 있고 주소가 있으면 클라우드에도 반영
    if (autoSync && savedGasUrl()) scheduleAutoSync();
    return ok;
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  async function captureThumb() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return null;
    clearSelection();
    clearPageMarkers();
    try {
      const pgs = pages.length ? pages : detectPages();
      const el = pgs[0] || doc.body;
      const r = el.getBoundingClientRect();
      const h2c = await ensureHtml2Canvas();
      const canvas = await h2c(el, {
        scale: Math.min(1, 320 / Math.max(r.width, 1)),
        useCORS: true, logging: false,
      });
      return canvas.toDataURL("image/jpeg", 0.75);
    } catch (_) {
      return null;
    } finally {
      refreshPageMarkers();
    }
  }

  function renderDesigns() {
    designListEl.classList.toggle("list-view", adminView === "list");
    $("#adminViewCard").classList.toggle("active", adminView === "card");
    $("#adminViewList").classList.toggle("active", adminView === "list");
    designListEl.innerHTML = "";
    $("#adminEmpty").hidden = designs.length > 0;

    // 맨 앞: 새 디자인 만들기 카드 (런치패드)
    const newCard = document.createElement("button");
    newCard.type = "button";
    newCard.className = "design-card new-card";
    newCard.innerHTML = `<span class="new-ic"><span class="material-symbols-outlined">add</span></span>새 디자인 만들기`;
    newCard.addEventListener("click", startNewDesign);
    designListEl.appendChild(newCard);

    designs.forEach((d) => {
      const card = document.createElement("div");
      card.className = "design-card";
      if (d.id === currentDesignId) card.classList.add("current");

      // 썸네일+정보 = 클릭하면 열림 (관대한 클릭 영역)
      const open = document.createElement("div");
      open.className = "design-open";
      open.title = "열어서 편집하기";
      open.addEventListener("click", () => openDesign(d));

      const thumb = document.createElement("div");
      thumb.className = "design-thumb";
      if (d.thumb) {
        const img = document.createElement("img");
        img.src = d.thumb;
        img.alt = d.name;
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = `<span class="material-symbols-outlined">description</span>`;
      }

      const info = document.createElement("div");
      info.className = "design-info";
      info.innerHTML = `<div class="design-name"></div><div class="design-date"></div>`;
      info.querySelector(".design-name").textContent = d.name;
      if (d.id === currentDesignId) {
        const badge = document.createElement("span");
        badge.className = "current-badge";
        badge.textContent = "편집 중";
        info.querySelector(".design-name").appendChild(badge);
      }
      info.querySelector(".design-date").textContent = fmtDate(d.updatedAt);
      open.append(thumb, info);

      const actions = document.createElement("div");
      actions.className = "design-actions";
      const mkBtn = (icon, title, fn, danger = false) => {
        const b = document.createElement("button");
        b.className = "tool-btn" + (danger ? " danger" : "");
        b.title = title;
        b.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
        b.addEventListener("click", fn);
        actions.appendChild(b);
      };
      mkBtn("edit", "열기 (편집)", () => openDesign(d));
      mkBtn("content_copy", "복제", () => duplicateDesign(d));
      mkBtn("drive_file_rename_outline", "이름 바꾸기", () => renameDesign(d));
      mkBtn("download", "HTML 다운로드", () => {
        downloadBlob(new Blob([d.html], { type: "text/html;charset=utf-8" }),
          d.name.replace(/[\\/:*?"<>|]/g, "_") + ".html");
        toast(`'${d.name}'을(를) 저장했어요`, "download_done");
      });
      mkBtn("delete", "삭제", () => deleteDesign(d), true);

      card.append(open, actions);
      designListEl.appendChild(card);
    });
  }

  /** 대시보드에서 바로 새 작업 시작 → 템플릿 고르기 (빈 캔버스 포함).
   *  실제 연결 해제는 템플릿을 고르는 순간에 일어남 (취소하면 그대로 유지) */
  function startNewDesign() {
    closeAdmin();
    openTemplates();
  }

  function openDesign(d) {
    const cur = currentDesign();
    if (codeInput.value.trim() && codeInput.value !== d.html &&
        !cur && // 디자인에 묶이지 않은 작업만 잃을 수 있으므로 그때만 확인
        !confirm(`'${d.name}' 디자인을 불러올까요?\n지금 작업 중인 내용은 사라져요. (자동 저장본은 유지)`)) return;
    setCode(d.html);
    setCurrentDesign(d.id);
    closeAdmin();
    switchTab("preview");
    toast(`'${d.name}' 편집을 시작해요. 헤더의 [저장]으로 바로 저장돼요`, "edit");
  }

  async function saveCurrentDesign() {
    if (!codeInput.value.trim()) {
      toast("저장할 내용이 없어요. 먼저 HTML을 만들어 주세요", "info", true);
      return null;
    }
    const name = prompt("디자인 이름을 입력하세요", `내 디자인 ${designs.length + 1}`);
    if (name === null) return null;
    toast("디자인을 저장하는 중…", "hourglass_top");
    const thumb = await captureThumb();
    const now = Date.now();
    const d = {
      id: uid(),
      name: name.trim() || `내 디자인 ${designs.length + 1}`,
      html: codeInput.value,
      thumb,
      createdAt: now,
      updatedAt: now,
    };
    designs.unshift(d);
    if (persistDesigns()) toast(`'${d.name}'(으)로 저장했어요`, "check_circle");
    renderDesigns();
    return d;
  }

  /** 헤더 [저장]: 편집 중인 디자인에 바로 덮어쓰고, 없으면 새로 저장 */
  async function saveToCurrent() {
    if (!codeInput.value.trim()) {
      toast("저장할 내용이 없어요. 먼저 HTML을 만들어 주세요", "info", true);
      return;
    }
    const d = currentDesign();
    if (!d) {
      const nd = await saveCurrentDesign();
      if (nd) setCurrentDesign(nd.id);
      renderDesigns();
      return;
    }
    d.html = codeInput.value;
    d.updatedAt = Date.now();
    d.thumb = await captureThumb() || d.thumb;
    if (persistDesigns()) toast(`'${d.name}'에 저장했어요`, "check_circle");
    renderDesigns();
  }

  function duplicateDesign(d) {
    const idx = designs.indexOf(d);
    const copy = { ...d, id: uid(), name: `${d.name} (복사본)`, createdAt: Date.now(), updatedAt: Date.now() };
    designs.splice(idx + 1, 0, copy);
    if (persistDesigns()) toast("디자인을 복제했어요", "content_copy");
    renderDesigns();
  }

  function renameDesign(d) {
    const name = prompt("새 이름을 입력하세요", d.name);
    if (name === null || !name.trim()) return;
    d.name = name.trim();
    d.updatedAt = Date.now();
    persistDesigns();
    renderDesigns();
  }

  function deleteDesign(d) {
    if (!confirm(`'${d.name}' 디자인을 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) return;
    designs = designs.filter((x) => x !== d);
    if (d.id === currentDesignId) setCurrentDesign(null);
    persistDesigns();
    renderDesigns();
    toast("디자인을 삭제했어요", "delete");
  }

  function openAdmin() {
    gasUrlInput.value = savedGasUrl();
    gasTokenInput.value = savedGasToken();
    $("#autoSyncChk").checked = autoSync;
    setAdminUnlocked(true);
    renderDesigns();
    updateCloudStatus();
    adminOverlay.hidden = false;
    updateAdminUI();
  }
  function closeAdmin() {
    adminOverlay.hidden = true;
    updateAdminUI();
  }

  $("#adminClose").addEventListener("click", closeAdmin);
  $("#adminBackToEdit").addEventListener("click", closeAdmin);
  $("#btnMyDesigns").addEventListener("click", () => {
    adminOverlay.hidden ? openAdmin() : closeAdmin();
  });
  $("#btnSaveDesign").addEventListener("click", saveToCurrent);
  $("#adminLock").addEventListener("click", () => {
    setAdminUnlocked(false);
    closeAdmin();
    toast("관리자 버튼을 숨겼어요. 로고를 5번 클릭하면 다시 열려요", "lock");
  });
  $("#adminNew").addEventListener("click", startNewDesign);
  $("#adminViewCard").addEventListener("click", () => {
    adminView = "card";
    localStorage.setItem("livehtml:adminView", adminView);
    renderDesigns();
  });
  $("#adminViewList").addEventListener("click", () => {
    adminView = "list";
    localStorage.setItem("livehtml:adminView", adminView);
    renderDesigns();
  });
  $("#adminCloudBtn").addEventListener("click", () => {
    const p = $("#cloudPanel");
    p.hidden = !p.hidden;
  });

  /* ---- Google Apps Script 클라우드 ---- */
  // 주소·비밀번호를 입력하는 즉시 이 브라우저에 저장 (다시 입력할 필요 없음)
  gasUrlInput.addEventListener("input", () => {
    const url = gasUrlInput.value.trim();
    try { localStorage.setItem(GAS_KEY, url); } catch (_) {}
    $("#cloudSaved").hidden = !(url && savedGasToken());
    updateCloudStatus();
  });
  gasTokenInput.addEventListener("input", () => {
    const tok = gasTokenInput.value.trim();
    try { localStorage.setItem(GAS_TOKEN_KEY, tok); } catch (_) {}
    $("#cloudSaved").hidden = !(tok && savedGasUrl());
    updateCloudStatus();
  });
  $("#autoSyncChk").addEventListener("change", (e) => {
    autoSync = e.target.checked;
    try { localStorage.setItem(AUTOSYNC_KEY, autoSync ? "1" : "0"); } catch (_) {}
    updateCloudStatus();
    if (autoSync && savedGasUrl()) {
      toast("자동 저장을 켰어요. 지금 한 번 백업할게요", "cloud_sync");
      doBackup(true);
    }
  });

  function setCloudStatus(kind, text) {
    const box = $("#cloudStatus");
    box.className = "cloud-status" + (kind ? " " + kind : "");
    $("#cloudStatusIc").textContent =
      kind === "ok" ? "cloud_done" : kind === "err" ? "cloud_alert" : kind === "sync" ? "cloud_sync" : "cloud_off";
    $("#cloudStatusText").textContent = text;
  }

  function relTime(ts) {
    if (!ts) return "";
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "방금 전";
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    return fmtDate(ts);
  }

  function updateCloudStatus() {
    const has = !!savedGasUrl();
    const hasTok = !!savedGasToken();
    $("#cloudDot").hidden = !has;
    $("#cloudSaved").hidden = !(has && hasTok);
    if (!has) { setCloudStatus("", "클라우드가 연결되지 않았어요 (선택 사항)"); return; }
    if (!hasTok) { setCloudStatus("", "비밀번호를 입력하면 연결돼요 (스크립트 속성의 SECRET)"); return; }
    if (autoSync) {
      setCloudStatus("ok", lastSyncAt
        ? `자동 연결됨(재입력 불필요) · 자동 저장 켜짐 · 마지막 백업 ${relTime(lastSyncAt)}`
        : "자동 연결됨(재입력 불필요) · 자동 저장 켜짐");
    } else {
      setCloudStatus("ok", lastSyncAt
        ? `자동 연결됨(재입력 불필요) · 마지막 백업 ${relTime(lastSyncAt)}`
        : "자동 연결됨(재입력 불필요) · [지금 바로 백업]을 눌러 보세요");
    }
  }

  async function doBackup(silent) {
    const url = savedGasUrl();
    if (!url) {
      if (!silent) toast("먼저 Apps Script 주소를 입력해 주세요", "info", true);
      return false;
    }
    if (!silent) setCloudStatus("sync", "백업하는 중…");
    try {
      // Apps Script는 단순 요청(text/plain)이라야 CORS 사전요청 없이 통과
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "backup", token: savedGasToken(), designs }),
      });
      const j = await res.json();
      if (j.error === "auth") throw new Error("auth");
      if (!j.ok) throw new Error(j.error || "backup failed");
      lastSyncAt = Date.now();
      try { localStorage.setItem("livehtml:lastSync", String(lastSyncAt)); } catch (_) {}
      updateCloudStatus();
      if (!silent) toast(`클라우드에 디자인 ${designs.length}개를 백업했어요`, "cloud_done");
      return true;
    } catch (err) {
      console.error(err);
      const isAuth = String(err.message) === "auth";
      setCloudStatus("err", isAuth ? "비밀번호가 일치하지 않아요" : "백업 실패 — 주소·배포 설정을 확인하세요");
      if (!silent) toast(isAuth
        ? "비밀번호가 스크립트 속성의 SECRET과 달라요"
        : "백업에 실패했어요. 주소와 배포(액세스: 모든 사용자)를 확인하세요", "error", true);
      return false;
    }
  }

  const scheduleAutoSync = debounce(() => doBackup(true), 2500);

  $("#gasBackup").addEventListener("click", () => doBackup(false));

  $("#gasRestore").addEventListener("click", async () => {
    const url = savedGasUrl();
    if (!url) { toast("먼저 Apps Script 주소를 입력해 주세요", "info", true); return; }
    const btn = $("#gasRestore");
    btn.disabled = true;
    setCloudStatus("sync", "클라우드에서 불러오는 중…");
    try {
      const q = "action=restore&token=" + encodeURIComponent(savedGasToken());
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + q);
      const data = await res.json();
      if (data && data.ok === false) throw new Error(data.error || "restore failed");
      if (!Array.isArray(data)) throw new Error("invalid data");
      if (!data.length) {
        updateCloudStatus();
        toast("클라우드에 저장된 디자인이 아직 없어요. 먼저 [지금 바로 백업]을 해보세요", "info", true);
        return;
      }
      if (designs.length &&
          !confirm(`클라우드에 디자인 ${data.length}개가 있어요.\n이 기기의 ${designs.length}개를 클라우드 내용으로 바꿀까요?\n(이 기기에만 있는 디자인은 사라져요)`)) {
        updateCloudStatus();
        return;
      }
      designs = data;
      try { localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs)); } catch (_) {}
      setCurrentDesign(null);
      renderDesigns();
      updateCloudStatus();
      toast(`클라우드에서 디자인 ${data.length}개를 가져왔어요`, "cloud_download");
    } catch (err) {
      console.error(err);
      const isAuth = String(err.message) === "auth";
      setCloudStatus("err", isAuth ? "비밀번호가 일치하지 않아요" : "불러오기 실패 — 주소·배포 설정을 확인하세요");
      toast(isAuth
        ? "비밀번호가 스크립트 속성의 SECRET과 달라요"
        : "불러오기에 실패했어요. 주소와 배포 설정을 확인하세요", "error", true);
    } finally {
      btn.disabled = false;
    }
  });

  /* ---- 숨김 진입: 로고 5번 연속 클릭 / 주소 #admin ---- */
  let logoClicks = 0;
  let logoTimer = null;
  $(".brand-logo").addEventListener("click", () => {
    logoClicks++;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(() => { logoClicks = 0; }, 1800);
    if (logoClicks >= 5) {
      logoClicks = 0;
      openAdmin();
    }
  });
  if (location.hash === "#admin") setTimeout(openAdmin, 300);

  /* ---------------- 초기화 ---------------- */
  updateStat();
  let restored = false;
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved && saved.trim()) {
      setCode(saved);
      restored = true;
      toast("이전 작업을 불러왔어요", "history");
    }
  } catch (_) {}
  updateAdminUI(); // 관리자 모드를 연 적이 있으면 헤더 버튼 복원
  if (!restored) {
    renderPreview();
    pushHistory("");
  }
  // 처음 방문이면 사용 방법을 한 번 보여줌 (localStorage 기준, 복원 여부 무관)
  try {
    if (!localStorage.getItem("livehtml:helpSeen")) {
      localStorage.setItem("livehtml:helpSeen", "1");
      setTimeout(openHelp, 700);
    }
  } catch (_) {}
})();
