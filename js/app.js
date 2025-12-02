/**
 * Main Application Logic
 */

const AppState = {
    article: {
        title: "",
        question: "",
        reasons: {}
    },
    subQuestions: [], // Array of objects
    structure: []     // Array of objects matching subQuestions length
};

// DOM Elements
const els = {
    title: document.getElementById('articleTitle'),
    question: document.getElementById('mainQuestionEditor'),
    analyzeMainBtn: document.getElementById('analyzeMainBtn'),
    goToSubBtn: document.getElementById('goToSubBtn'),

    subContainer: document.getElementById('subQuestionsContainer'),
    addSectionBtn: document.getElementById('addSectionBtn'),
    analyzeAllSubBtn: document.getElementById('analyzeAllSubBtn'),
    goToStructureBtn: document.getElementById('goToStructureBtn'),

    structureContainer: document.getElementById('structureContainer'),

    reasonsModal: new bootstrap.Modal(document.getElementById('reasonsModal')),
    reasonsForm: document.getElementById('reasonsForm'),
    saveReasonsBtn: document.getElementById('saveReasonsBtn'),
    reasonsPromptText: document.getElementById('reasonsPromptText'),

    exportHtmlBtn: document.getElementById('exportHtmlBtn'),
    exportWordBtn: document.getElementById('exportWordBtn'),
    exportExcelBtn: document.getElementById('exportExcelBtn'),

    saveProjectBtn: document.getElementById('saveProjectBtn'),
    loadProjectBtn: document.getElementById('loadProjectBtn'),
    loadProjectInput: document.getElementById('loadProjectInput'),

    // Help
    helpBtn: document.getElementById('helpBtn'),
    helpModal: document.getElementById('helpModal')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Add initial Sub-Question row if empty
    if (AppState.subQuestions.length === 0) {
        addSubQuestionRow();
    }

    // Help Button
    if (els.helpBtn) {
        els.helpBtn.addEventListener('click', () => {
            const helpModal = new bootstrap.Modal(els.helpModal);
            helpModal.show();
        });
    }

    // Check First Time Tour
    if (typeof checkFirstTime === 'function') {
        checkFirstTime();
    }
});

// --- Save / Load ---

els.saveProjectBtn.addEventListener('click', () => {
    const data = JSON.stringify(AppState, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    saveAs(blob, "maqalah_project.json");
});

els.loadProjectBtn.addEventListener('click', () => {
    els.loadProjectInput.click();
});

els.loadProjectInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            loadProjectState(data);
        } catch (err) {
            alert("خطأ في قراءة الملف: " + err.message);
        }
    };
    reader.readAsText(file);
});

function loadProjectState(data) {
    if (!data.article || !data.subQuestions || !data.structure) {
        alert("ملف غير صالح.");
        return;
    }

    // Update State
    AppState.article = data.article;
    AppState.subQuestions = data.subQuestions;
    AppState.structure = data.structure;

    // Update Tab 1
    els.title.value = AppState.article.title || "";
    els.question.innerText = AppState.article.question || "";

    if (AppState.article.title && AppState.article.question) {
        try {
            const result = TextLogic.analyzeAndHighlight(AppState.article.question, AppState.article.title);
            els.question.innerHTML = result.highlightedHtml;
            els.goToSubBtn.disabled = false;
        } catch (e) {
            console.error("Error analyzing main text:", e);
        }
    }

    // Update Tab 2
    els.subContainer.innerHTML = '';
    try {
        if (Array.isArray(AppState.subQuestions)) {
            AppState.subQuestions.forEach(sq => {
                addSubQuestionRow(sq);
            });
        }
    } catch (e) {
        alert("Error adding sub-questions: " + e.message);
        console.error(e);
    }

    if (!AppState.subQuestions || AppState.subQuestions.length === 0) {
        addSubQuestionRow();
    }

    // Update Tab 3
    try {
        buildStructureUI();
    } catch (e) {
        alert("Error building structure: " + e.message);
        console.error(e);
    }

    alert("تم تحميل المشروع بنجاح.");
}

// --- Tab 1: Main Info ---

els.analyzeMainBtn.addEventListener('click', () => {
    const title = els.title.value.trim();
    const question = els.question.innerText.trim(); // Get text content only for analysis

    if (!title || !question) {
        alert("يرجى إدخال العنوان والسؤال الرئيسي.");
        return;
    }

    // Analyze
    const result = TextLogic.analyzeAndHighlight(question, title);

    // Update Editor HTML
    els.question.innerHTML = result.highlightedHtml;

    // Update State
    AppState.article.title = title;
    AppState.article.question = question; // Store raw text or html? Let's store raw text for now, but maybe html is needed for export.
    // Actually, let's store the raw text for logic, and we can re-generate HTML when needed.

    // Check for missing words and prompt for reasons
    // Show modal if there are ANY missing words, pre-filling existing reasons
    if (result.missingWords.length > 0) {
        showReasonsModal(result.missingWords, (reasons) => {
            Object.assign(AppState.article.reasons, reasons);
            els.goToSubBtn.disabled = false;
        }, null, AppState.article.reasons);
    } else {
        els.goToSubBtn.disabled = false;
    }
});

els.goToSubBtn.addEventListener('click', () => {
    const tab = new bootstrap.Tab(document.getElementById('sub-tab'));
    tab.show();
    document.getElementById('sub-tab').disabled = false;
});

function addSubQuestionRow(data = null) {
    const id = data ? data.id : Date.now();
    const row = document.createElement('div');
    row.className = 'card mb-3 p-3 sub-q-row';
    row.dataset.id = id;

    const baabText = data ? data.baab : "";
    const ahdafText = data ? data.ahdaf : "";
    const subQText = data ? data.sub_q : "";

    let baabHtml = baabText;
    let ahdafHtml = ahdafText;

    if (data && data.missing_baab) {
        const resBaab = TextLogic.analyzeAndHighlight(baabText, subQText);
        baabHtml = resBaab.highlightedHtml;

        const resAhdaf = TextLogic.analyzeAndHighlight(ahdafText, subQText);
        ahdafHtml = resAhdaf.highlightedHtml;
    }

    row.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
            <h5 class="card-title">قسم جديد</h5>
            <button class="btn btn-sm btn-danger delete-row-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="row g-3">
            <div class="col-md-4">
                <label class="form-label">نص الباب</label>
                <div class="rich-text-editor border rounded p-2 baab-editor" contenteditable="true" style="min-height: 60px; background: #fff;">${baabHtml}</div>
            </div>
            <div class="col-md-4">
                <label class="form-label">الأهداف</label>
                <div class="rich-text-editor border rounded p-2 ahdaf-editor" contenteditable="true" style="min-height: 60px; background: #fff;">${ahdafHtml}</div>
            </div>
            <div class="col-md-4">
                <label class="form-label">السؤال الفرعي</label>
                <textarea class="form-control sub-q-input" rows="2" placeholder="السؤال الفرعي...">${subQText}</textarea>
            </div>
        </div>
    `;

    row.querySelector('.delete-row-btn').addEventListener('click', () => {
        if (document.querySelectorAll('.sub-q-row').length > 1) {
            row.remove();
        } else {
            alert("يجب أن يوجد قسم واحد على الأقل.");
        }
    });

    els.subContainer.appendChild(row);
}

els.addSectionBtn.addEventListener('click', () => addSubQuestionRow());

els.analyzeAllSubBtn.addEventListener('click', () => {
    const rows = document.querySelectorAll('.sub-q-row');
    AppState.subQuestions = [];
    let allMissing = [];

    rows.forEach(row => {
        const baabEditor = row.querySelector('.baab-editor');
        const ahdafEditor = row.querySelector('.ahdaf-editor');
        const subQInput = row.querySelector('.sub-q-input');

        const baabText = baabEditor.innerText.trim();
        const ahdafText = ahdafEditor.innerText.trim();
        const subQText = subQInput.value.trim();

        // Analyze Baab vs SubQ (Highlight words in Baab missing from SubQ? Or vice versa?)
        // Python: highlight_text(section_edit, raw_sub_q, raw_section) -> Highlights SECTION based on SUB_Q roots.
        // Wait, Python: `highlight_text(text_edit, question_text, title_text)`
        // Call: `highlight_text(section_edit, raw_sub_q, raw_section)`
        // Arg 1 (Editor): section_edit
        // Arg 2 (Question Text -> Used for Roots): raw_sub_q
        // Arg 3 (Title Text -> Iterated): raw_section
        // Logic: Iterates words in `raw_section` (Title/Baab). Checks if in `raw_sub_q` (Question) roots.
        // If NOT in Question roots -> Missing.
        // So it highlights words in BAAB that are NOT in SUB-QUESTION.

        // JS analyzeAndHighlight(questionText, titleText) -> iterates QUESTION (param 1) and checks TITLE (param 2).
        // I implemented JS logic as: "Highlights words in questionText that are NOT in titleText".
        // This matches the Main Page logic (Words in Question not in Title).

        // But for Sub-Questions page, the Python logic seems reversed?
        // Python `highlight_text` iterates `title_text` (Arg 3).
        // In Main Page: `highlight_text(q_edit, raw_title, raw_q)` -> Iterates `raw_q`. Checks `raw_title` roots.
        // In Sub Page: `highlight_text(sec_edit, raw_sub_q, raw_section)` -> Iterates `raw_section`. Checks `raw_sub_q` roots.

        // So in Main Page: Highlights Question words not in Title.
        // In Sub Page: Highlights Baab words not in Sub-Question.

        // My JS `analyzeAndHighlight(q, t)` iterates `q` and checks `t`.
        // So for Main Page: `analyzeAndHighlight(question, title)` -> Correct.
        // For Sub Page: `analyzeAndHighlight(baab, subQ)` -> Will iterate Baab and check SubQ. -> Correct.

        const baabResult = TextLogic.analyzeAndHighlight(baabText, subQText);
        const ahdafResult = TextLogic.analyzeAndHighlight(ahdafText, subQText);

        baabEditor.innerHTML = baabResult.highlightedHtml;
        ahdafEditor.innerHTML = ahdafResult.highlightedHtml;

        allMissing = [...allMissing, ...baabResult.missingWords, ...ahdafResult.missingWords];

        AppState.subQuestions.push({
            id: row.dataset.id,
            baab: baabText,
            ahdaf: ahdafText,
            sub_q: subQText,
            missing_baab: baabResult.missingWords,
            missing_ahdaf: ahdafResult.missingWords
        });
    });

    const uniqueMissing = [...new Set(allMissing)];

    if (uniqueMissing.length > 0) {
        showReasonsModal(uniqueMissing, (reasons) => {
            Object.assign(AppState.article.reasons, reasons);
            els.goToStructureBtn.disabled = false;
        }, "يرجى توضيح سبب وجود الكلمات التالية في النص وعدم وجودها في السؤال الفرعي:", AppState.article.reasons);
    } else {
        els.goToStructureBtn.disabled = false;
    }
});

els.goToStructureBtn.addEventListener('click', () => {
    buildStructureUI();
    const tab = new bootstrap.Tab(document.getElementById('structure-tab'));
    tab.show();
    document.getElementById('structure-tab').disabled = false;
});

document.getElementById('backToMainBtn').addEventListener('click', () => {
    const tab = new bootstrap.Tab(document.getElementById('main-tab'));
    tab.show();
});

// --- Tab 3: Structure ---

function buildStructureUI() {
    els.structureContainer.innerHTML = '';

    // Sync structure state with subQuestions
    // If structure exists, try to preserve it, otherwise create new
    const newStructure = AppState.subQuestions.map((sq, index) => {
        const existing = AppState.structure[index];
        if (existing && existing.baab_name === sq.baab) {
            return existing;
        }
        return {
            baab_name: sq.baab,
            fusul: [{ name: "", mabahith: [] }] // Default one fasl
        };
    });
    AppState.structure = newStructure;

    AppState.structure.forEach((baab, bIndex) => {
        const item = document.createElement('div');
        item.className = 'accordion-item';
        item.innerHTML = `
            <h2 class="accordion-header">
                <button class="accordion-button ${bIndex === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${bIndex}">
                    باب: ${baab.baab_name || 'بدون عنوان'}
                </button>
            </h2>
            <div id="collapse-${bIndex}" class="accordion-collapse collapse ${bIndex === 0 ? 'show' : ''}" data-bs-parent="#structureContainer">
                <div class="accordion-body">
                    <div class="fusul-container" data-b-index="${bIndex}"></div>
                    <button class="btn btn-sm btn-outline-primary mt-2 add-fasl-btn" data-b-index="${bIndex}">+ إضافة فصل</button>
                </div>
            </div>
        `;

        const fusulContainer = item.querySelector('.fusul-container');
        baab.fusul.forEach((fasl, fIndex) => {
            renderFasl(fusulContainer, bIndex, fIndex, fasl);
        });

        item.querySelector('.add-fasl-btn').addEventListener('click', () => {
            baab.fusul.push({ name: "", mabahith: [] });
            renderFasl(fusulContainer, bIndex, baab.fusul.length - 1, baab.fusul[baab.fusul.length - 1]);
        });

        els.structureContainer.appendChild(item);
    });
}

function renderFasl(container, bIndex, fIndex, faslData) {
    const faslDiv = document.createElement('div');
    faslDiv.className = 'card mb-3 fasl-card';
    faslDiv.innerHTML = `
        <div class="card-body p-3">
            <div class="d-flex mb-2">
                <input type="text" class="form-control fasl-input" placeholder="عنوان الفصل..." value="${faslData.name}">
                <button class="btn btn-sm btn-danger ms-2 delete-fasl-btn">×</button>
            </div>
            <div class="mabahith-container ms-4"></div>
            <button class="btn btn-sm btn-light text-primary mt-2 add-mabhath-btn">+ مبحث</button>
        </div>
    `;

    // Bind Input
    faslDiv.querySelector('.fasl-input').addEventListener('input', (e) => {
        AppState.structure[bIndex].fusul[fIndex].name = e.target.value;
    });

    // Delete Fasl
    faslDiv.querySelector('.delete-fasl-btn').addEventListener('click', () => {
        AppState.structure[bIndex].fusul.splice(fIndex, 1);
        // Re-render entire Baab to fix indices is easiest, or just remove DOM and handle indices carefully.
        // For simplicity, let's re-build UI.
        buildStructureUI();
    });

    // Add Mabhath
    const mabahithContainer = faslDiv.querySelector('.mabahith-container');
    faslData.mabahith.forEach((mabhath, mIndex) => {
        renderMabhath(mabahithContainer, bIndex, fIndex, mIndex, mabhath);
    });

    faslDiv.querySelector('.add-mabhath-btn').addEventListener('click', () => {
        AppState.structure[bIndex].fusul[fIndex].mabahith.push({ name: "", matalib: [] });
        renderMabhath(mabahithContainer, bIndex, fIndex, AppState.structure[bIndex].fusul[fIndex].mabahith.length - 1, { name: "", matalib: [] });
    });

    container.appendChild(faslDiv);
}

function renderMabhath(container, bIndex, fIndex, mIndex, mabhathData) {
    const mDiv = document.createElement('div');
    mDiv.className = 'card mb-2 mabhath-card';
    mDiv.innerHTML = `
        <div class="card-body p-2">
            <div class="d-flex mb-2">
                <input type="text" class="form-control form-control-sm mabhath-input" placeholder="عنوان المبحث..." value="${mabhathData.name}">
                <button class="btn btn-sm btn-outline-danger ms-2 delete-mabhath-btn">×</button>
            </div>
            <div class="matalib-container ms-4"></div>
            <button class="btn btn-sm btn-link text-decoration-none add-matlab-btn">+ مطلب</button>
        </div>
    `;

    mDiv.querySelector('.mabhath-input').addEventListener('input', (e) => {
        AppState.structure[bIndex].fusul[fIndex].mabahith[mIndex].name = e.target.value;
    });

    mDiv.querySelector('.delete-mabhath-btn').addEventListener('click', () => {
        AppState.structure[bIndex].fusul[fIndex].mabahith.splice(mIndex, 1);
        buildStructureUI();
    });

    const matalibContainer = mDiv.querySelector('.matalib-container');
    mabhathData.matalib.forEach((matlab, mtIndex) => {
        renderMatlab(matalibContainer, bIndex, fIndex, mIndex, mtIndex, matlab);
    });

    mDiv.querySelector('.add-matlab-btn').addEventListener('click', () => {
        AppState.structure[bIndex].fusul[fIndex].mabahith[mIndex].matalib.push("");
        renderMatlab(matalibContainer, bIndex, fIndex, mIndex, AppState.structure[bIndex].fusul[fIndex].mabahith[mIndex].matalib.length - 1, "");
    });

    container.appendChild(mDiv);
}

function renderMatlab(container, bIndex, fIndex, mIndex, mtIndex, matlabText) {
    const mtDiv = document.createElement('div');
    mtDiv.className = 'd-flex mb-1 matlab-item';
    mtDiv.innerHTML = `
        <input type="text" class="form-control form-control-sm matlab-input" placeholder="عنوان المطلب..." value="${matlabText}">
        <button class="btn btn-sm text-danger delete-matlab-btn">×</button>
    `;

    mtDiv.querySelector('.matlab-input').addEventListener('input', (e) => {
        AppState.structure[bIndex].fusul[fIndex].mabahith[mIndex].matalib[mtIndex] = e.target.value;
    });

    mtDiv.querySelector('.delete-matlab-btn').addEventListener('click', () => {
        AppState.structure[bIndex].fusul[fIndex].mabahith[mIndex].matalib.splice(mtIndex, 1);
        buildStructureUI();
    });

    container.appendChild(mtDiv);
}

document.getElementById('backToSubBtn').addEventListener('click', () => {
    const tab = new bootstrap.Tab(document.getElementById('sub-tab'));
    tab.show();
});

// --- Reasons Modal ---

let currentReasonsCallback = null;

function showReasonsModal(words, callback, promptText = null, existingReasons = {}) {
    const form = els.reasonsForm;
    form.innerHTML = '';

    if (promptText) {
        els.reasonsPromptText.innerText = promptText;
    } else {
        els.reasonsPromptText.innerText = "يرجى توضيح سبب وجود الكلمات التالية:";
    }

    words.forEach(word => {
        const existingVal = existingReasons[word] || "";
        const div = document.createElement('div');
        div.className = 'mb-2 row';
        div.innerHTML = `
            <label class="col-sm-3 col-form-label fw-bold">${word}</label>
            <div class="col-sm-9">
                <input type="text" class="form-control reason-input" name="${word}" placeholder="السبب..." value="${existingVal}">
            </div>
        `;
        form.appendChild(div);
    });

    currentReasonsCallback = callback;
    els.reasonsModal.show();
}

els.saveReasonsBtn.addEventListener('click', () => {
    const inputs = els.reasonsForm.querySelectorAll('.reason-input');
    const reasons = {};
    inputs.forEach(input => {
        if (input.value.trim()) {
            reasons[input.name] = input.value.trim();
        }
    });

    els.reasonsModal.hide();
    if (currentReasonsCallback) {
        currentReasonsCallback(reasons);
    }
});

// --- Exports ---

els.exportHtmlBtn.addEventListener('click', () => {
    Exporters.exportToHtml(AppState);
});

els.exportWordBtn.addEventListener('click', () => {
    Exporters.exportToWord(AppState);
});

els.exportExcelBtn.addEventListener('click', () => {
    Exporters.exportToExcel(AppState);
});
