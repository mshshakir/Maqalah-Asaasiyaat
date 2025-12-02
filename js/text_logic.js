/**
 * Arabic Text Logic for Maqalah App
 * Ports functionality from text_logic.py
 */

const TextLogic = {
    STOP_WORDS: new Set([
        "كيف", "لماذا", "متى", "أين", "هل", "ماذا", "من", "ما", "أي", "كم",
        "هي", "هو", "الذي", "التي", "في", "على", "عن", "مع", "هذا", "هذه",
        "معرفة", "وصول", "فهم",
        "إلى", "حتى", "منذ", "مذ", "حاشا", "عدا", "خلا", "ب", "ل", "ك",
        "أنا", "نحن", "أنت", "أنتِ", "أنتما", "أنتم", "أنتن", "هما", "هم", "هن",
        "هذان", "هاتان", "هؤلاء", "ذلك", "تلك", "أولئك",
        "الذين", "اللاتي", "اللواتي", "اللتان", "اللذان"
    ]),

    removeTashkeel: function(text) {
        return text.replace(/[\u0617-\u061A\u064B-\u0652]/g, "");
    },

    normalizeArabic: function(text) {
        if (!text) return "";
        let t = this.removeTashkeel(text);
        
        // Unification of Alifs, Yehs, etc.
        t = t.replace(/[أإآ]/g, "ا");
        t = t.replace(/ى/g, "ي");
        t = t.replace(/ؤ/g, "و");
        t = t.replace(/ئ/g, "ي");
        t = t.replace(/ة/g, "ه");
        
        // Remove punctuation (keep alphanumeric and Arabic letters)
        // JS regex for Arabic range: [\u0600-\u06FF]
        // We replace anything that is NOT a word character or whitespace or Arabic char
        t = t.replace(/[^\w\s\u0621-\u064A]/g, " ");
        t = t.replace(/،/g, " "); // Explicitly remove Arabic comma
        
        // Collapse whitespace and lowercase
        t = t.replace(/\s+/g, " ").trim().toLowerCase();
        return t;
    },

    stripAlPrefixes: function(word) {
        const prefixes = ["وال", "فال", "كال", "بال", "ال", "لل"];
        for (const prefix of prefixes) {
            if (word.startsWith(prefix) && word.length > prefix.length + 1) {
                return word.substring(prefix.length);
            }
        }
        return word;
    },

    /**
     * A simplified Arabic Light Stemmer.
     * This is not as comprehensive as Tashaphyne but covers common cases.
     */
    lightStem: function(word) {
        let stem = word;
        
        // 1. Remove Prefixes (waw, fa, kaf, ba, lam, al) - handled partly by stripAlPrefixes but let's do more
        // Common prefixes in order:
        const prefixes = ["وال", "فال", "كال", "بال", "ال", "لل", "و", "ف", "ب", "ل", "ك"];
        for (const p of prefixes) {
            if (stem.startsWith(p) && stem.length > p.length + 2) {
                stem = stem.substring(p.length);
                break; // Only remove one main prefix set
            }
        }

        // 2. Remove Suffixes
        // Common suffixes: ha, hum, huma, huna, ka, kum, kuma, kuna, na, ni, at, an, on, in, y, h, t
        const suffixes = [
            "هما", "كم", "هم", "هن", "نا", "ها", "ك", "ه", "ي", "ة", "ت", 
            "ات", "ان", "ين", "ون", "وا"
        ];
        
        // Sort suffixes by length desc
        suffixes.sort((a, b) => b.length - a.length);

        for (const s of suffixes) {
            if (stem.endsWith(s) && stem.length > s.length + 2) {
                stem = stem.substring(0, stem.length - s.length);
                break; // Only remove one main suffix
            }
        }

        return stem;
    },

    /**
     * Highlights words in titleText that are NOT in questionText.
     * Returns { missingWords: [], highlightedHtml: "" }
     * Note: This function generates HTML for the editor.
     */
    analyzeAndHighlight: function(questionText, titleText) {
        if (!questionText || !titleText) {
            return { missingWords: [], highlightedHtml: questionText };
        }

        const normQ = this.normalizeArabic(questionText);
        const qTokens = normQ.split(" ");
        const qRoots = new Set();

        // Build Question Roots
        for (const token of qTokens) {
            if (this.STOP_WORDS.has(token)) continue;

            // 1. Root of original
            qRoots.add(this.lightStem(token));

            // 2. Root of stripped
            const stripped = this.stripAlPrefixes(token);
            if (stripped !== token) {
                qRoots.add(this.lightStem(stripped));
            }
        }

        // Find missing words in Title (Wait, logic is: words in QUESTION that are NOT in TITLE?)
        // Python code: highlight_text(text_edit, question_text, title_text)
        // It highlights words in text_edit (which is passed as question_edit usually?)
        // Let's check Python:
        // missing_words = text_logic.highlight_text(self.question_edit, raw_title, raw_q, ...)
        // highlight_text(text_edit, question_text, title_text) -> 
        //   Iterates words in title_text... wait.
        //   Python: words_iter = re.finditer(..., title_text) -> checks if word in q_roots?
        //   Wait, if it iterates TITLE text, it finds words in TITLE that are missing in QUESTION?
        //   Let's re-read Python `highlight_text`:
        //   `words_iter = re.finditer(r"[\w\u0600-\u06FF]+", title_text)` -> Iterates Title Words
        //   Checks if root is in `q_roots` (Question Roots).
        //   If NOT in q_roots -> is_missing = True.
        //   So it finds words in TITLE that are NOT in QUESTION.
        //   BUT the UI says: "Words in red = present in السؤال الرئيسي but NOT in عنوان المقالة"
        //   That implies we should iterate QUESTION words and check if they are in TITLE.
        //   Let's check the Python call site in `MainPage`:
        //   `missing_words = text_logic.highlight_text(self.question_edit, raw_title, raw_q, ...)`
        //   Arg 1: text_edit (question_edit) -> The widget to highlight.
        //   Arg 2: question_text (passed as raw_title?!) -> `highlight_text` def is `(text_edit, question_text, title_text)`
        //   Call is `(self.question_edit, raw_title, raw_q)`
        //   So inside `highlight_text`:
        //     `question_text` param gets `raw_title` value.
        //     `title_text` param gets `raw_q` value.
        //     `norm_q = normalize(question_text)` -> normalizes TITLE.
        //     `q_roots` -> roots of TITLE.
        //     `words_iter = finditer(..., title_text)` -> iterates QUESTION (because title_text param is raw_q).
        //     Checks if QUESTION word is in TITLE roots.
        //     If not, it highlights in `text_edit` (which is question_edit).
        //   CONCLUSION: It highlights words in QUESTION that are missing from TITLE.
        
        // So JS Logic:
        // 1. Build roots from TITLE.
        // 2. Iterate words in QUESTION.
        // 3. If word not in TITLE roots, mark as missing.

        const normTitle = this.normalizeArabic(titleText);
        const titleTokens = normTitle.split(" ");
        const titleRoots = new Set();

        for (const token of titleTokens) {
            if (this.STOP_WORDS.has(token)) continue;
            titleRoots.add(this.lightStem(token));
            const stripped = this.stripAlPrefixes(token);
            if (stripped !== token) {
                titleRoots.add(this.lightStem(stripped));
            }
        }

        const missingWords = [];
        
        // We need to reconstruct HTML with highlights.
        // Simplest way: split by spaces/punctuation and reconstruct, or use replace.
        // But replace is tricky with multiple occurrences.
        // Let's use a regex to find all words in Question and replace them if missing.
        
        // We'll use a temporary placeholder strategy to avoid double replacement
        let html = questionText;
        
        // Find all Arabic words in Question
        // We use a callback to check each word
        html = html.replace(/([\u0600-\u06FF]+)/g, (match) => {
            const word = match;
            // Normalize & Stem
            const norm = this.normalizeArabic(word);
            if (!norm || this.STOP_WORDS.has(norm)) return word;

            const root1 = this.lightStem(norm);
            const root2 = this.lightStem(this.stripAlPrefixes(norm));

            if (!titleRoots.has(root1) && !titleRoots.has(root2)) {
                missingWords.push(word);
                return `<span class="highlight-missing">${word}</span>`;
            }
            return word;
        });

        return { missingWords, highlightedHtml: html };
    }
};
