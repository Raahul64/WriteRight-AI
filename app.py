"""AI Grammar & Text Improver - Flask backend using pretrained NLP models (no paid APIs)."""
import re, difflib, importlib.resources as res
from flask import Flask, request, jsonify, render_template
import textstat
from symspellpy import SymSpell, Verbosity
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

app = Flask(__name__)

GRAMMAR_MODEL = "vennify/t5-base-grammar-correction"   # grammar correction (T5 fine-tuned)
STYLE_MODEL = "google/flan-t5-base"                    # instruction-following rewriter
_cache = {}

STYLE_PROMPTS = {
    "professional": "Rewrite the following sentence in professional English: {t}",
    "academic": "Rewrite the following sentence in formal academic English: {t}",
    "formal": "Rewrite the following sentence in a formal tone: {t}",
    "simple": "Rewrite the following sentence in simple, easy English: {t}",
    "concise": "Rewrite the following sentence more concisely, keeping the meaning: {t}",
    "vocabulary": "Rewrite the following sentence using stronger, more varied vocabulary: {t}",
}

# ---------- models ----------
def load(name):
    if name not in _cache:
        _cache[name] = (AutoTokenizer.from_pretrained(name), AutoModelForSeq2SeqLM.from_pretrained(name))
    return _cache[name]

def generate(name, prompt, n=1):
    tok, model = load(name)
    inp = tok(prompt, return_tensors="pt", truncation=True, max_length=512)
    out = model.generate(**inp, max_new_tokens=256, num_beams=max(4, n),
                         num_return_sequences=n, early_stopping=True)
    return [tok.decode(o, skip_special_tokens=True).strip() for o in out]

# ---------- spelling (SymSpell) ----------
_sym = SymSpell(max_dictionary_edit_distance=2, prefix_length=7)
_sym.load_dictionary(str(res.files("symspellpy") / "frequency_dictionary_en_82_765.txt"), 0, 1)

def fix_spelling(text):
    fixes, spans = [], []
    for m in re.finditer(r"[A-Za-z']+", text):
        w = m.group()
        mid_cap = w[0].isupper() and m.start() > 1 and text[:m.start()].rstrip()[-1:] not in ".!?"
        if len(w) < 3 or w.isupper() or mid_cap:
            continue
        s = _sym.lookup(w.lower(), Verbosity.TOP, max_edit_distance=2)
        if s and s[0].term != w.lower():
            new = s[0].term.capitalize() if w[0].isupper() else s[0].term
            fixes.append({"wrong": w, "suggestion": new})
            spans.append((m.start(), m.end(), new))
    for a, b, new in reversed(spans):
        text = text[:a] + new + text[b:]
    return text, fixes

# ---------- helpers ----------
def sentences(t):
    try:
        import nltk
        try:
            return nltk.sent_tokenize(t)
        except LookupError:
            nltk.download("punkt_tab", quiet=True)
            return nltk.sent_tokenize(t)
    except Exception:
        return [s for s in re.split(r"(?<=[.!?])\s+", t.strip()) if s]

ARTICLES = {"a", "an", "the"}
PREPS = {"in", "on", "at", "to", "for", "of", "with", "by", "from", "about", "into", "over", "under", "between"}
EXPLAIN = {
    "Capitalization": "Sentences and proper nouns should start with a capital letter.",
    "Punctuation": "Correct punctuation separates ideas and marks the end of a sentence.",
    "Article": "Use 'a' before consonant sounds, 'an' before vowel sounds, and 'the' for specific nouns.",
    "Preposition": "The preposition does not fit the verb or noun it follows in standard English.",
    "Verb form / agreement": "The verb must agree with its subject in number and use the correct tense.",
    "Sentence structure": "The wording or word order was changed to form a grammatically correct sentence.",
}

def classify(a, b):
    sa, sb = a.strip(".,;:!?").lower(), b.strip(".,;:!?").lower()
    if a.lower() == b.lower() and a != b: return "Capitalization"
    if sa == sb: return "Punctuation"
    if {sa, sb} & ARTICLES and (not sa or not sb or sa in ARTICLES or sb in ARTICLES): return "Article"
    if sa in PREPS and sb in PREPS: return "Preposition"
    if sa and sb and difflib.SequenceMatcher(None, sa, sb).ratio() > 0.6: return "Verb form / agreement"
    return "Sentence structure"

def diff_ops(a, b):
    A, B = a.split(), b.split()
    ops = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, A, B).get_opcodes():
        ops.append({"op": tag, "a": " ".join(A[i1:i2]), "b": " ".join(B[j1:j2])})
    return ops

def count_words(t): return len(re.findall(r"\b\w+\b", t))

# ---------- API ----------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/improve", methods=["POST"])
def improve():
    data = request.get_json(force=True)
    original = (data.get("text") or "").strip()
    mode = data.get("mode", "basic")
    if not original:
        return jsonify(error="Please enter some text."), 400
    if len(original) > 5000:
        return jsonify(error="Text too long (max 5000 characters)."), 400

    spelled, spelling = fix_spelling(original)
    final_sents, issues = [], []
    for s in sentences(spelled):
        g = generate(GRAMMAR_MODEL, "grammar: " + s)[0]
        for op in diff_ops(s, g):
            if op["op"] != "equal":
                kind = classify(op["a"], op["b"])
                issues.append({"incorrect": op["a"] or "(missing)", "correct": op["b"] or "(removed)",
                               "type": kind, "explanation": EXPLAIN[kind], "context": s})
        if mode in STYLE_PROMPTS:
            g = generate(STYLE_MODEL, STYLE_PROMPTS[mode].format(t=g))[0]
        final_sents.append(g)
    improved = " ".join(final_sents)

    alternatives = []
    if mode in STYLE_PROMPTS:
        alts = generate(STYLE_MODEL, STYLE_PROMPTS[mode].format(t=spelled), n=3)
        alternatives = [a for a in dict.fromkeys(alts) if a != improved][:2]

    fre_b, fre_a = textstat.flesch_reading_ease(original), textstat.flesch_reading_ease(improved)
    fixed = len(issues) + len(spelling)
    score = max(0, min(100, round(50 + 5 * min(fixed, 6) + 0.3 * (fre_a - fre_b))))
    return jsonify(
        improved=improved, diff=diff_ops(original, improved), issues=issues,
        spelling=spelling, alternatives=alternatives,
        stats={"original_words": count_words(original), "improved_words": count_words(improved),
               "characters": len(original), "sentences": len(sentences(original)),
               "grammar_errors": len(issues), "spelling_errors": len(spelling),
               "readability_before": round(fre_b, 1), "readability_after": round(fre_a, 1),
               "improvement_score": score})

if __name__ == "__main__":
    app.run(debug=False, port=5000)
