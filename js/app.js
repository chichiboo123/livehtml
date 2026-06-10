/* ============================================================
 * Live HTML — 실시간 HTML 편집기
 * 코드 ↔ 미리보기 양방향 동기화, 캔바식 인라인 편집, PNG 내보내기
 * ============================================================ */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const codeInput = $("#codeInput");
  const iframe = $("#preview");
  const previewCanvas = $("#previewCanvas");
  const previewViewport = $("#previewViewport");
  const editToolbar = $("#editToolbar");
  const selChip = $("#selChip");
  const editHint = $("#editHint");
  const zoomSelect = $("#zoomSelect");
  const fileInput = $("#fileInput");
  const imgInput = $("#imgInput");
  const codeStat = $("#codeStat");
  const fontBtn = $("#fontBtn");
  const fontNameEl = $("#fontName");
  const fontPanel = $("#fontPanel");
  const fontSearch = $("#fontSearch");
  const fontList = $("#fontList");
  const fontSizeInput = $("#fontSizeInput");

  const H2C_SRC = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  const AUTOSAVE_KEY = "livehtml:autosave";
  const SNAP_DIST = 6; // 가운데 정렬 스냅 허용 거리(px)

  let editMode = true;          // 편집 모드 / 보기 모드
  let selectedEl = null;        // iframe 안에서 선택된 요소
  let editingEl = null;         // 텍스트 편집 중인 요소
  let zoomMode = "fit";
  let hintShown = false;

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

  // value: null → font-family 제거(원래 글꼴), css → 전용 스타일시트 주입
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
    const first = inline.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
    return first;
  }

  function updateFontChip() {
    if (!selectedEl) return;
    const fam = currentFontFamily(selectedEl);
    const known = FONT_GROUPS.flatMap((g) => g.fonts).find((f) => f.family === fam);
    fontNameEl.textContent = known ? known.label : (fam || "글꼴");
  }

  function applyFont(font) {
    if (!selectedEl) return;
    if (!font.family) {
      selectedEl.style.removeProperty("font-family");
    } else {
      ensureFontLink(iframe.contentDocument, font);
      selectedEl.style.fontFamily = `'${font.family}', ${font.fallback}`;
    }
    closeFontPanel();
    updateFontChip();
    syncFromPreview();
    toast(`'${font.label}' 글꼴을 적용했어요`, "font_download");
  }

  function openFontPanel() {
    if (!selectedEl) return;
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

  function updateStat() {
    codeStat.textContent = `${codeInput.value.length.toLocaleString()}자`;
    autosave();
  }

  function renderPreview() {
    clearSelection();
    const code = codeInput.value.trim();
    document.body.classList.toggle("has-content", !!code);
    iframe.srcdoc = code || "<!DOCTYPE html><html><body></body></html>";
  }

  iframe.addEventListener("load", () => {
    const doc = iframe.contentDocument;
    if (!doc) return;
    injectEditorStyle(doc);
    attachPreviewEvents(doc);
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
      .__lh_guide { position: fixed; background: #FF2E92; z-index: 2147483647; pointer-events: none; }
      .__lh_guide.v { width: 1.5px; }
      .__lh_guide.h { height: 1.5px; }
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
    clone.querySelectorAll("#__lh_style, script[data-lh], .__lh_guide").forEach((e) => e.remove());
    clone.querySelectorAll("[data-lh-hover], [data-lh-selected], [contenteditable]").forEach((e) => {
      e.removeAttribute("data-lh-hover");
      e.removeAttribute("data-lh-selected");
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
    applyZoomDebounced();
  }
  const syncFromPreviewDebounced = debounce(syncFromPreview, 350);

  /* ============================================================
   * 미리보기 인라인 편집 (선택 / 드래그 / 텍스트)
   * ============================================================ */
  function isEditableTarget(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toUpperCase();
    return tag !== "HTML" && tag !== "BODY" && tag !== "SCRIPT" && tag !== "STYLE" && tag !== "LINK" && tag !== "META";
  }

  function clearSelection() {
    if (editingEl) endTextEdit(false);
    if (selectedEl) {
      try { selectedEl.removeAttribute("data-lh-selected"); } catch (_) {}
      selectedEl = null;
    }
    editToolbar.hidden = true;
    closeFontPanel();
    removeGuides();
  }

  function selectElement(el) {
    if (editingEl && editingEl !== el) endTextEdit();
    if (selectedEl) selectedEl.removeAttribute("data-lh-selected");
    selectedEl = el;
    el.setAttribute("data-lh-selected", "");
    selChip.textContent = el.tagName.toLowerCase();
    $("#btnImage").hidden = el.tagName.toUpperCase() !== "IMG";
    editToolbar.hidden = false;
    closeFontPanel();
    updateFontChip();
    updateFontSizeInput();
  }

  function updateFontSizeInput() {
    if (!selectedEl) return;
    const size = parseFloat(iframe.contentWindow.getComputedStyle(selectedEl).fontSize) || 16;
    fontSizeInput.value = Math.round(size);
  }

  function startTextEdit(el) {
    if (!el || el.tagName.toUpperCase() === "IMG") return;
    editingEl = el;
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "false");
    el.focus();
  }

  function endTextEdit(sync = true) {
    if (!editingEl) return;
    editingEl.removeAttribute("contenteditable");
    editingEl.removeAttribute("spellcheck");
    editingEl = null;
    if (sync) syncFromPreview();
  }

  /* ---- 드래그 이동 (translate를 인라인 transform에 합성) ---- */
  const TRANSLATE_RE = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*$/;

  function getTranslate(el) {
    const m = (el.style.transform || "").match(TRANSLATE_RE);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }

  function setTranslate(el, x, y) {
    const base = (el.style.transform || "").replace(TRANSLATE_RE, "").trim();
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) {
      el.style.transform = base;
      if (!el.style.transform) el.style.removeProperty("transform");
    } else {
      el.style.transform = `${base ? base + " " : ""}translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  function nudgeSelected(dx, dy) {
    if (!selectedEl || editingEl) return;
    const t = getTranslate(selectedEl);
    setTranslate(selectedEl, t.x + dx, t.y + dy);
    syncFromPreviewDebounced();
  }

  /* ---- 가운데 정렬 가이드선 ---- */
  function showGuide(doc, kind, rect, center) {
    let g = doc.querySelector(`.__lh_guide.${kind}`);
    if (!g) {
      g = doc.createElement("div");
      g.className = `__lh_guide ${kind}`;
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

  function attachPreviewEvents(doc) {
    let hoverEl = null;
    let drag = null;

    doc.addEventListener("mouseover", (e) => {
      if (!editMode || editingEl) return;
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
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (a) e.preventDefault();
      if (!editMode) return;
      e.preventDefault();
      if (editingEl) {
        if (e.target === editingEl || editingEl.contains(e.target)) return;
        endTextEdit();
      }
      if (isEditableTarget(e.target)) {
        if (e.target !== selectedEl) selectElement(e.target);
      } else {
        clearSelection();
      }
    }, true);

    doc.addEventListener("dblclick", (e) => {
      if (!editMode || !isEditableTarget(e.target)) return;
      e.preventDefault();
      selectElement(e.target);
      startTextEdit(e.target);
    });

    // 선택된 요소 드래그 이동 + 가운데 정렬 스냅
    doc.addEventListener("pointerdown", (e) => {
      if (!editMode || editingEl) return;
      if (!selectedEl || (e.target !== selectedEl && !selectedEl.contains(e.target))) return;
      const start = getTranslate(selectedEl);
      const er = selectedEl.getBoundingClientRect();
      const parent = selectedEl.parentElement || doc.body;
      const pr = parent.getBoundingClientRect();
      drag = {
        sx: e.clientX, sy: e.clientY,
        bx: start.x, by: start.y,
        c0x: er.left + er.width / 2, c0y: er.top + er.height / 2,
        pcx: pr.left + pr.width / 2, pcy: pr.top + pr.height / 2,
        pr,
        moved: false,
      };
      try { selectedEl.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });

    doc.addEventListener("pointermove", (e) => {
      if (!drag || !selectedEl) return;
      let dx = e.clientX - drag.sx;
      let dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;

      // 부모 컨테이너 가운데에 가까워지면 스냅 + 가이드선 표시
      const cx = drag.c0x + dx;
      const cy = drag.c0y + dy;
      let snapX = false, snapY = false;
      if (Math.abs(cx - drag.pcx) < SNAP_DIST) { dx += drag.pcx - cx; snapX = true; }
      if (Math.abs(cy - drag.pcy) < SNAP_DIST) { dy += drag.pcy - cy; snapY = true; }

      setTranslate(selectedEl, drag.bx + dx, drag.by + dy);

      if (snapX) showGuide(doc, "v", drag.pr, drag.pcx);
      else doc.querySelector(".__lh_guide.v")?.remove();
      if (snapY) showGuide(doc, "h", drag.pr, drag.pcy);
      else doc.querySelector(".__lh_guide.h")?.remove();
    });

    const endDrag = () => {
      removeGuides();
      if (drag && drag.moved) syncFromPreview();
      drag = null;
    };
    doc.addEventListener("pointerup", endDrag);
    doc.addEventListener("pointercancel", endDrag);

    // contenteditable 입력 동기화
    doc.addEventListener("input", () => syncFromPreviewDebounced());

    doc.addEventListener("keydown", (e) => {
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
    if (!selectedEl) return;
    const el = selectedEl;
    clearSelection();
    el.remove();
    syncFromPreview();
    toast("요소를 삭제했어요", "delete");
  }

  editToolbar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn || !selectedEl) return;
    const act = btn.dataset.act;
    const el = selectedEl;
    const win = iframe.contentWindow;

    switch (act) {
      case "text-edit":
        startTextEdit(el);
        return;
      case "font-dec":
      case "font-inc": {
        const cur = parseFloat(win.getComputedStyle(el).fontSize) || 16;
        el.style.fontSize = Math.max(6, cur + (act === "font-inc" ? 2 : -2)) + "px";
        updateFontSizeInput();
        break;
      }
      case "bold": {
        const w = win.getComputedStyle(el).fontWeight;
        el.style.fontWeight = (parseInt(w, 10) >= 600 || w === "bold") ? "400" : "700";
        break;
      }
      case "italic": {
        el.style.fontStyle = win.getComputedStyle(el).fontStyle === "italic" ? "normal" : "italic";
        break;
      }
      case "align-left": el.style.textAlign = "left"; break;
      case "align-center": el.style.textAlign = "center"; break;
      case "align-right": el.style.textAlign = "right"; break;
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
        const copy = el.cloneNode(true);
        copy.removeAttribute("data-lh-selected");
        el.after(copy);
        const t = getTranslate(copy);
        setTranslate(copy, t.x + 16, t.y + 16);
        selectElement(copy);
        toast("요소를 복제했어요", "content_copy");
        break;
      }
      case "reset-pos":
        setTranslate(el, 0, 0);
        toast("원래 위치로 되돌렸어요", "restart_alt");
        break;
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
    if (!selectedEl) return;
    const size = Math.min(400, Math.max(6, parseInt(fontSizeInput.value, 10) || 16));
    fontSizeInput.value = size;
    selectedEl.style.fontSize = size + "px";
    syncFromPreview();
  });

  $("#colorPicker").addEventListener("input", (e) => {
    if (!selectedEl) return;
    selectedEl.style.color = e.target.value;
    syncFromPreviewDebounced();
  });

  imgInput.addEventListener("change", () => {
    const file = imgInput.files[0];
    imgInput.value = "";
    if (!file || !selectedEl || selectedEl.tagName.toUpperCase() !== "IMG") return;
    const reader = new FileReader();
    reader.onload = () => {
      selectedEl.src = reader.result;
      syncFromPreview();
      toast("이미지를 교체했어요", "image");
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
    if (!on) clearSelection();
  }
  $("#modeEdit").addEventListener("click", () => setEditMode(true));
  $("#modeView").addEventListener("click", () => setEditMode(false));

  zoomSelect.addEventListener("change", () => {
    zoomMode = zoomSelect.value;
    applyZoom();
  });

  function applyZoom() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.documentElement || !codeInput.value.trim()) return;
    const pad = 40;
    const baseW = Math.max(320, previewViewport.clientWidth - pad);

    // 콘텐츠 실제 너비 측정 (고정폭 카드뉴스 대응)
    iframe.style.transform = "none";
    iframe.style.width = baseW + "px";
    iframe.style.height = "10px";
    const sw = Math.max(doc.documentElement.scrollWidth, doc.body ? doc.body.scrollWidth : 0);
    const contentW = sw > baseW + 8 ? sw : baseW;
    iframe.style.width = contentW + "px";
    const contentH = Math.max(
      doc.documentElement.scrollHeight,
      doc.body ? doc.body.scrollHeight : 0,
      80
    );
    iframe.style.height = contentH + "px";

    const scale = zoomMode === "fit" ? Math.min(1, baseW / contentW) : parseInt(zoomMode, 10) / 100;
    iframe.style.transform = `scale(${scale})`;
    previewCanvas.style.width = contentW * scale + "px";
    previewCanvas.style.height = contentH * scale + "px";
  }
  const applyZoomDebounced = debounce(applyZoom, 300);
  window.addEventListener("resize", applyZoomDebounced);

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
  $("#emptySample").addEventListener("click", () => {
    setCode(SAMPLE_HTML);
    toast("예시 카드뉴스를 불러왔어요. 화면을 눌러서 고쳐보세요!", "auto_awesome");
  });

  $("#btnClear").addEventListener("click", () => {
    if (!codeInput.value.trim()) return;
    if (!confirm("작성 중인 내용을 모두 지울까요?")) return;
    setCode("");
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

  $("#btnCopyCode").addEventListener("click", async () => {
    if (!requireContent()) return;
    try {
      await navigator.clipboard.writeText(codeInput.value);
      toast("HTML 코드를 복사했어요", "content_copy");
    } catch (_) {
      codeInput.select();
      document.execCommand("copy");
      toast("HTML 코드를 복사했어요", "content_copy");
    }
  });

  $("#btnShare").addEventListener("click", async () => {
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
  });

  function downloadHTML() {
    downloadBlob(new Blob([codeInput.value], { type: "text/html;charset=utf-8" }), "live-html.html");
    toast("HTML 파일을 저장했어요", "download_done");
  }

  /* ---- 다운로드 모달 + 페이지 감지 ---- */
  const downloadModal = $("#downloadModal");

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
      (el) => big(el) && !["SCRIPT", "STYLE", "LINK"].includes(el.tagName)
    );
    if (kids.length >= 2) return kids;
    return [body];
  }

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

  /* ---- PNG 내보내기 (html2canvas를 iframe 안에 주입) ---- */
  function ensureHtml2Canvas() {
    return new Promise((resolve, reject) => {
      const win = iframe.contentWindow;
      if (win.html2canvas) return resolve(win.html2canvas);
      const doc = iframe.contentDocument;
      const s = doc.createElement("script");
      s.src = H2C_SRC;
      s.setAttribute("data-lh", "");
      s.onload = () => resolve(win.html2canvas);
      s.onerror = () => reject(new Error("html2canvas load failed"));
      (doc.head || doc.documentElement).appendChild(s);
    });
  }

  $("#dlPng").addEventListener("click", async () => {
    const checked = [...$("#pngPages").querySelectorAll("input:checked")]
      .map((c) => detectedPages[+c.dataset.idx])
      .filter(Boolean);
    if (!checked.length) {
      toast("저장할 페이지를 선택해 주세요", "info", true);
      return;
    }
    const btn = $("#dlPng");
    btn.disabled = true;
    try {
      const h2c = await ensureHtml2Canvas();
      for (let i = 0; i < checked.length; i++) {
        const canvas = await h2c(checked[i], {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
        });
        const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
        downloadBlob(blob, checked.length > 1 ? `live-html_p${i + 1}.png` : "live-html.png");
        await new Promise((r) => setTimeout(r, 350));
      }
      toast(`PNG ${checked.length}장을 저장했어요`, "photo_library");
      closeDownloadModal();
    } catch (err) {
      console.error(err);
      toast("이미지 변환에 실패했어요. 외부 이미지가 차단됐을 수 있어요", "error", true);
    } finally {
      btn.disabled = false;
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
      else if (!downloadModal.hidden) closeDownloadModal();
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
      if (codeInput.value.trim()) downloadHTML();
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
    <div class="tip"><strong>① 한 번 클릭 = 선택</strong><span>위 도구 막대로 글꼴·크기·색·정렬을 바꿔요</span></div>
    <div class="tip"><strong>② 두 번 클릭 = 글자 수정</strong><span>코드를 몰라도 내용을 바로 고칠 수 있어요</span></div>
    <div class="tip"><strong>③ 끌기 = 위치 이동</strong><span>가운데에 가까워지면 분홍 가이드선에 착 붙어요</span></div>
  </div>

  <div class="page page-3">
    <p class="big">🎉</p>
    <h1 style="font-size:36px;">완성되면 다운로드!</h1>
    <p class="sub">수정한 HTML 코드를 복사·저장하거나<br>페이지별 PNG 이미지로 받을 수 있어요.</p>
  </div>
</body>
</html>`;

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
  if (!restored) {
    renderPreview();
    pushHistory("");
  }
})();
