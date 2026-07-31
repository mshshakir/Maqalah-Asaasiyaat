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

    // Matches a run of Arabic letters (incl. hamza forms) plus tashkeel marks,
    // but NOT Arabic punctuation such as \u061F (U+061F) or \u060C (U+060C).
    WORD_REGEX: /[\u0621-\u0652]+/g,

    escapeHtml: function(str) {
        if (str == null) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },

    isStopWord: function(normalizedToken) {
        // STOP_WORDS is normalized once (see bottom of file) so membership
        // tests against already-normalized tokens work correctly.
        return this.STOP_WORDS_NORM.has(normalizedToken);
    },

    removeTashkeel: function(text) {
        return text.replace(/[\u0617-\u061A\u064B-\u0652]/g, "");
    },

    normalizeArabic: function(text) {
        if (!text) return "";
        let t = this.removeTashkeel(text);
        
        // Unification of Alifs, Yehs, etc.
        // Map EVERY hamza carrier to a bare alif so the same root radical is
        // represented identically regardless of its seat: أثر (أ) and يؤثر (ؤ)
        // must both expose the hamza as "ا". Previously ؤ→و / ئ→ي split them.
        t = t.replace(/[أإآؤئء]/g, "ا");
        t = t.replace(/ى/g, "ي");
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

    // Imperfective / future verb prefixes (present tense: ي/ت/ن/أ→ا, future: سـ).
    // Used only to generate ADDITIONAL candidate roots, never to replace the
    // original, so this can only create matches, never remove existing ones.
    VERB_PREFIXES: ["ست", "سي", "سن", "سا", "ي", "ت", "ن"],

    /**
     * Returns the SET of candidate root keys for a normalized token.
     * A word aligns with another if their candidate sets intersect.
     * Candidates = the word, its al-/conjunction-stripped form, and (for long
     * enough words) those forms with a leading verb prefix removed — each then
     * light-stemmed. This lets أثر (noun) match يؤثر (verb) via shared root اثر.
     */
    rootSet: function (normToken) {
        const out = new Set();
        if (!normToken) return out;

        const bases = new Set([normToken]);
        const noAl = this.stripAlPrefixes(normToken);
        if (noAl !== normToken) bases.add(noAl);

        for (const b of [...bases]) {
            for (const vp of this.VERB_PREFIXES) {
                // Require a 3+ letter remainder so we don't shred short words.
                if (b.startsWith(vp) && b.length > vp.length + 2) {
                    bases.add(b.substring(vp.length));
                    break;
                }
            }
        }

        for (const b of bases) {
            const stem = this.lightStem(b);
            if (stem) out.add(stem);
        }
        return out;
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
            if (this.isStopWord(token)) continue;

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
            if (this.isStopWord(token)) continue;
            for (const root of this.rootSet(token)) {
                titleRoots.add(root);
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
        html = html.replace(this.WORD_REGEX, (match) => {
            const word = match;
            // Normalize & Stem
            const norm = this.normalizeArabic(word);
            if (!norm || this.isStopWord(norm)) return word;

            const aligned = [...this.rootSet(norm)].some((r) => titleRoots.has(r));

            if (!aligned) {
                missingWords.push(word);
                return `<span class="highlight-missing">${word}</span>`;
            }
            return word;
        });

        return { missingWords, highlightedHtml: html };
    }
};

// Build a normalized copy of the stop-word list ONCE. The raw list above is
// written with hamza/alif-maqsura/ta-marbuta forms for readability, but every
// membership test happens against normalized tokens, so we must normalize the
// set too (otherwise words like على/إلى/متى/معرفة are never filtered).
TextLogic.STOP_WORDS_NORM = new Set(
    [...TextLogic.STOP_WORDS].map((w) => TextLogic.normalizeArabic(w)).filter(Boolean)
);
