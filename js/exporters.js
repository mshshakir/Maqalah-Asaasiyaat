/**
 * Exporters for Maqalah App
 * Ports functionality from exporters.py
 */

const Exporters = {
    prepareStructureData: function (structure) {
        const prepared = [];
        structure.forEach(item => {
            const baabRows = [];
            const fusul = item.fusul || [];

            if (fusul.length === 0) {
                baabRows.push({ fasl: '-', mabhath: '-', matlab: '-', fasl_span: 1, mabhath_span: 1 });
            } else {
                fusul.forEach(fasl => {
                    const faslName = fasl.name;
                    const mabahith = fasl.mabahith || [];

                    // Calculate Fasl Rows
                    let faslRowCount = 0;
                    if (mabahith.length === 0) {
                        faslRowCount = 1;
                    } else {
                        mabahith.forEach(m => {
                            faslRowCount += Math.max((m.matalib || []).length, 1);
                        });
                    }

                    let firstFaslRow = true;

                    if (mabahith.length === 0) {
                        baabRows.push({
                            fasl: faslName, mabhath: '-', matlab: '-',
                            fasl_span: faslRowCount, mabhath_span: 1
                        });
                        return;
                    }

                    mabahith.forEach(mabhath => {
                        const mabhathName = mabhath.name;
                        const matalib = mabhath.matalib || [];

                        const mabhathRowCount = Math.max(matalib.length, 1);
                        let firstMabhathRow = true;

                        if (matalib.length === 0) {
                            baabRows.push({
                                fasl: faslName,
                                mabhath: mabhathName,
                                matlab: '-',
                                fasl_span: firstFaslRow ? faslRowCount : 0,
                                mabhath_span: mabhathRowCount
                            });
                            firstFaslRow = false;
                            return;
                        }

                        matalib.forEach(matlab => {
                            baabRows.push({
                                fasl: faslName,
                                mabhath: mabhathName,
                                matlab: matlab,
                                fasl_span: firstFaslRow ? faslRowCount : 0,
                                mabhath_span: firstMabhathRow ? mabhathRowCount : 0
                            });
                            firstFaslRow = false;
                            firstMabhathRow = false;
                        });
                    });
                });
            }

            prepared.push({
                sub_q: item.sub_q || '',
                ahdaf: item.ahdaf || '',
                name: item.baab || '', // Note: AppState uses 'baab' for name in subQuestions, but structure has 'baab_name'. 
                // Wait, AppState.structure has 'baab_name'. AppState.subQuestions has 'baab'.
                // The 'item' passed here is from AppState.structure? 
                // Let's check app.js calls.
                // Exporters.exportToHtml(AppState) -> passes whole state.
                // We need to merge data.
                // Actually, prepareStructureData should probably take the merged view or we handle it here.
                // Let's look at how we call it.
                // In Python, 'structure' passed to prepare_structure_data is a list of dicts that seems to have 'sub_q', 'ahdaf', 'name' (baab name).
                // In JS AppState, 'structure' has 'baab_name', 'fusul'. 'subQuestions' has 'sub_q', 'ahdaf', 'baab'.
                // We need to combine them.
                missing_baab: item.missing_baab || [], // These are in subQuestions
                missing_ahdaf: item.missing_ahdaf || [],
                total_rows: baabRows.length,
                rows: baabRows
            });
        });
        return prepared;
    },

    // Helper to merge state for preparation
    mergeState: function (appState) {
        // We need to combine subQuestions and structure
        // Assuming they are index-aligned
        return appState.structure.map((struct, index) => {
            const sq = appState.subQuestions[index] || {};
            return {
                ...struct,
                name: struct.baab_name, // Map baab_name to name for consistency with Python logic
                sub_q: sq.sub_q,
                ahdaf: sq.ahdaf,
                missing_baab: sq.missing_baab,
                missing_ahdaf: sq.missing_ahdaf
            };
        });
    },

    highlightHtml: function (text, missingWords, reasons, footnotes, counter) {
        if (!missingWords || missingWords.length === 0) {
            return { html: text, counter: counter };
        }

        // Sort by length desc
        const sortedWords = [...missingWords].sort((a, b) => b.length - a.length);

        // Escape for regex
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let html = text;

        // We need to replace words carefully. 
        // A simple replaceAll might replace parts of HTML tags if we are not careful, 
        // but here 'text' is plain text from input usually (except if it has HTML from editor).
        // The editor content is HTML.
        // If text is HTML, we should be careful.
        // In AppState, 'baab' and 'ahdaf' are stored as plain text in 'subQuestions' (from innerText in app.js).
        // Wait, app.js: `baab: baabText` (innerText). So it is plain text. Good.

        // We use a placeholder strategy similar to Python to avoid double replacement
        const wordToToken = {};
        const tokenToWord = {};

        sortedWords.forEach((word, i) => {
            const token = `__REF_${i}__`;
            wordToToken[word] = token;
            tokenToWord[token] = word;
            // Replace all occurrences
            const regex = new RegExp(escapeRegExp(word), 'g');
            html = html.replace(regex, token);
        });

        const tokenNumberMap = {};

        html = html.replace(/__REF_\d+__/g, (token) => {
            const word = tokenToWord[token];
            if (!word) return token;

            let num;
            if (tokenNumberMap[token]) {
                num = tokenNumberMap[token];
            } else {
                num = counter;
                tokenNumberMap[token] = num;
                counter++;
                if (reasons[word]) {
                    footnotes.push(`[${num}] <b>${word}</b>: ${reasons[word]}`);
                }
            }

            let replacement = `<span class='highlight' style='color: red; font-weight: bold;'>${word}</span>`;
            if (reasons[word]) {
                replacement += `<sup class='footnote-ref' style='color: red; font-weight: bold; font-size: 0.8em;'>[${num}]</sup>`;
            }
            return replacement;
        });

        return { html: html, counter: counter };
    },

    exportToHtml: function (appState) {
        const mergedStructure = this.mergeState(appState);
        const preparedData = this.prepareStructureData(mergedStructure);
        const reasons = appState.article.reasons || {};
        const footnotes = [];
        let footnoteCounter = 1;

        // Process Main Question
        const mainQRes = this.highlightHtml(appState.article.question, Object.keys(reasons), reasons, footnotes, footnoteCounter);
        const mainQuestionHtml = mainQRes.html;
        footnoteCounter = mainQRes.counter;

        // Process Rows
        preparedData.forEach(item => {
            const ahdafRes = this.highlightHtml(item.ahdaf, item.missing_ahdaf, reasons, footnotes, footnoteCounter);
            item.ahdaf_html = ahdafRes.html;
            footnoteCounter = ahdafRes.counter;

            const baabRes = this.highlightHtml(item.name, item.missing_baab, reasons, footnotes, footnoteCounter);
            item.baab_html = baabRes.html;
            footnoteCounter = baabRes.counter;
        });

        // Render Tables HTML
        let rowsHtml = "";
        let totalTableRows = 0;

        preparedData.forEach(item => {
            const subQ = item.sub_q;
            const ahdafHtml = item.ahdaf_html;
            const baabHtml = item.baab_html;
            const totalRows = item.total_rows;
            totalTableRows += totalRows;
            const rows = item.rows;

            // First Row
            const firstRowData = rows[0];
            rowsHtml += "<tr>";

            // Order: SubQ, Ahdaf, Baab, Fasl, Mabhath, Matlab (Right to Left)

            // 1. SubQ (Rightmost)
            rowsHtml += `<td class='col-center' rowspan='${totalRows}'>${subQ}</td>`;

            // 2. Ahdaf
            rowsHtml += `<td class='col-center' rowspan='${totalRows}'>${ahdafHtml}</td>`;

            // 3. Baab
            rowsHtml += `<td class='col-center' rowspan='${totalRows}'>${baabHtml}</td>`;

            // 4. Fasl
            if (firstRowData.fasl_span > 0) {
                rowsHtml += `<td class='col-right' rowspan='${firstRowData.fasl_span}'>${firstRowData.fasl}</td>`;
            }

            // 5. Mabhath
            if (firstRowData.mabhath_span > 0) {
                rowsHtml += `<td class='col-right' rowspan='${firstRowData.mabhath_span}'>${firstRowData.mabhath}</td>`;
            }

            // 6. Matlab (Leftmost)
            rowsHtml += `<td class='col-right'>${firstRowData.matlab}</td>`;

            rowsHtml += "</tr>";

            // Remaining Rows
            for (let i = 1; i < totalRows; i++) {
                const r = rows[i];
                rowsHtml += "<tr>";

                // Fasl
                if (r.fasl_span > 0) {
                    rowsHtml += `<td class='col-right' rowspan='${r.fasl_span}'>${r.fasl}</td>`;
                }

                // Mabhath
                if (r.mabhath_span > 0) {
                    rowsHtml += `<td class='col-right' rowspan='${r.mabhath_span}'>${r.mabhath}</td>`;
                }

                // Matlab
                rowsHtml += `<td class='col-right'>${r.matlab}</td>`;

                rowsHtml += "</tr>";
            }
        });

        // Styles for Tables (A3 Landscape)
        const baseFontSize = totalTableRows < 15 ? "14pt" : (totalTableRows < 30 ? "12pt" : "12pt");

        const htmlContentTables = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>هيكلية المقالة - الجداول</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
                    @page { size: A3 landscape; margin: 15mm; }
                    body { font-family: 'Amiri', serif; padding: 10px; direction: rtl; font-size: ${baseFontSize}; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
                    th, td { border: 1px solid #7f8c8d; padding: 6px; text-align: center; word-wrap: break-word; }
                    th { background-color: #2c3e50; color: white; }
                    .col-right { text-align: right; }
                    .col-center { text-align: center; }
                    
                    /* Column Widths - Updated Order */
                    th:nth-child(1) { width: 12%; } /* Sub-Q */
                    th:nth-child(2) { width: 11%; } /* Ahdaf */
                    th:nth-child(3) { width: 12%; } /* Baab */
                    th:nth-child(4) { width: 15%; } /* Fasl */
                    th:nth-child(5) { width: 20%; } /* Mabhath */
                    th:nth-child(6) { width: 30%; } /* Matlab */

                    .footnote-ref { color: red; font-weight: bold; font-size: 0.8em; }
                    
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 20px; text-align: left;">
                    <button onclick="window.print()">طباعة الجداول</button>
                </div>
                
                <div style="border: 2px solid #2c3e50; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                    <h2 style="margin: 0 0 10px 0;">عنوان المقالة: ${appState.article.title}</h2>
                    <h3 style="margin: 0;">السؤال الأساسي: ${mainQuestionHtml}</h3>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>سؤال فرعي</th>
                            <th>الأهداف</th>
                            <th>باب المقالة</th>
                            <th>الفصل</th>
                            <th>المبحث</th>
                            <th>المطلب</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        // Styles for Reasons (A4 Portrait)
        const htmlContentReasons = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>هيكلية المقالة - الملاحظات</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
                    @page { size: A4 portrait; margin: 20mm; }
                    body {
                        font-family: 'Amiri', serif;
                        padding: 20px;
                        direction: rtl;
                        background-color: white;
                        font-size: 14pt;
                        line-height: 1.2;
                    }
                    h3 {
                        color: #2c3e50;
                        border-bottom: 2px solid #2c3e50;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .footnotes {
                        margin-top: 10px;
                    }
                    .footnote-item {
                        margin-bottom: 10px;
                        text-align: right;
                    }
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 20px; text-align: left;">
                    <button onclick="window.print()">طباعة الملاحظات</button>
                </div>
                <h3>الملاحظات (الهوامش)</h3>
                <div class="footnotes">
                    ${footnotes.length > 0 ? footnotes.map(f => `<div class="footnote-item">${f}</div>`).join('') : '<div class="footnote-item">لا توجد ملاحظات.</div>'}
                </div>
            </body>
            </html>
        `;

        // Open Tables Window
        const winTables = window.open('', '_blank');
        if (winTables) {
            winTables.document.write(htmlContentTables);
            winTables.document.close();
        } else {
            alert("يرجى السماح بالنوافذ المنبثقة لطباعة الجداول.");
        }

        // Open Reasons Window (only if there are reasons, or always?)
        // User asked for separate printing, implying they want the reasons page.
        if (footnotes.length > 0) {
            // Small delay to ensure browser handles two popups better?
            setTimeout(() => {
                const winReasons = window.open('', '_blank');
                if (winReasons) {
                    winReasons.document.write(htmlContentReasons);
                    winReasons.document.close();
                } else {
                    alert("يرجى السماح بالنوافذ المنبثقة لطباعة الملاحظات.");
                }
            }, 500);
        }
    },

    exportToWord: function (appState) {
        // Simple HTML-based Word export for now, or use docx.js if complex layout needed.
        // Given the complex table structure, docx.js is better but verbose.
        // Let's try a simpler approach: Export the HTML content as a .doc file (MIME type trick).
        // It works surprisingly well for tables.

        // Re-use HTML generation but strip print buttons
        // Actually, let's use the same logic but save as file.

        const mergedStructure = this.mergeState(appState);
        const preparedData = this.prepareStructureData(mergedStructure);
        // ... (Logic similar to HTML but we need to generate the blob)

        // For now, let's alert that this is a placeholder or implement basic HTML-to-Word
        alert("تصدير Word قيد التنفيذ (سيتم استخدام HTML للتصدير مؤقتاً).");
        this.exportToHtml(appState);
    },

    exportToExcel: function (appState) {
        const mergedStructure = this.mergeState(appState);
        const preparedData = this.prepareStructureData(mergedStructure);

        // Prepare data for SheetJS
        // We need to flatten everything into rows
        const ws_data = [
            ["سؤال فرعي", "الأهداف", "باب المقالة", "الفصل", "المبحث", "المطلب"]
        ];

        preparedData.forEach(item => {
            const rows = item.rows;
            // We need to handle spans by repeating data or using merges. 
            // SheetJS supports merges.

            // For simplicity in this version, let's just fill the cells.
            rows.forEach(r => {
                ws_data.push([
                    item.sub_q,
                    item.ahdaf,
                    item.name,
                    r.fasl,
                    r.mabhath,
                    r.matlab
                ]);
            });
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // Set RTL
        if (!ws['!views']) ws['!views'] = [];
        ws['!views'].push({ rightToLeft: true });

        XLSX.utils.book_append_sheet(wb, ws, "Structure");
        XLSX.writeFile(wb, "article_structure.xlsx");
    }
};
