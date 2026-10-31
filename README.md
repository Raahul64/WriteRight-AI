# AI Grammar & Text Improver

Free, offline-capable writing assistant built on pretrained NLP models (no paid APIs).

## Setup
```
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Open http://127.0.0.1:5000. The first request downloads the models (about 1.5 GB total) and is slow; later ones are faster.

## Models and libraries
- Grammar: `vennify/t5-base-grammar-correction` (Hugging Face Transformers)
- Style modes (professional, academic, formal, simple, concise, vocabulary): `google/flan-t5-base`
- Spelling: SymSpell; Sentences: NLTK; Readability: TextStat (Flesch Reading Ease)

## Notes for viva
- Pipeline: spell-fix -> sentence split -> T5 grammar correction -> optional style rewrite -> diff (difflib) -> stats.
- Error types are heuristic labels from the word-level diff, not model output.
- Improvement score is an estimate: 50 + 5 per fix (max 6) + 0.3 x readability change.
