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

  const H2C_SRC = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

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
    clone.querySelectorAll("#__lh_style, script[data-lh]").forEach((e) => e.remove());
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
  }

  function selectElement(el) {
    if (editingEl && editingEl !== el) endTextEdit();
    if (selectedEl) selectedEl.removeAttribute("data-lh-selected");
    selectedEl = el;
    el.setAttribute("data-lh-selected", "");
    selChip.textContent = el.tagName.toLowerCase();
    $("#btnImage").hidden = el.tagName.toUpperCase() !== "IMG";
    editToolbar.hidden = false;
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

    // 선택된 요소 드래그 이동
    doc.addEventListener("pointerdown", (e) => {
      if (!editMode || editingEl) return;
      if (!selectedEl || (e.target !== selectedEl && !selectedEl.contains(e.target))) return;
      const start = getTranslate(selectedEl);
      drag = { sx: e.clientX, sy: e.clientY, bx: start.x, by: start.y, moved: false };
      try { selectedEl.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    doc.addEventListener("pointermove", (e) => {
      if (!drag || !selectedEl) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      setTranslate(selectedEl, drag.bx + dx, drag.by + dy);
    });
    const endDrag = () => {
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
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
      if (document.activeElement !== codeInput) { e.preventDefault(); applyHistory(-1); }
    } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
      if (document.activeElement !== codeInput) { e.preventDefault(); applyHistory(1); }
    } else if (e.key === "Escape") {
      if (!downloadModal.hidden) closeDownloadModal();
      else clearSelection();
    } else if ((e.key === "Delete") && selectedEl && document.activeElement !== codeInput) {
      deleteSelected();
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
    <div class="tip"><strong>① 한 번 클릭 = 선택</strong><span>위 도구 막대로 크기·색·정렬을 바꿔요</span></div>
    <div class="tip"><strong>② 두 번 클릭 = 글자 수정</strong><span>코드를 몰라도 내용을 바로 고칠 수 있어요</span></div>
    <div class="tip"><strong>③ 끌기 = 위치 이동</strong><span>선택한 요소를 원하는 곳으로 옮겨요</span></div>
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
  renderPreview();
  pushHistory("");
})();
