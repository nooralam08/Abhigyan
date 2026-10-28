# Abhigyan AI Complaint Classifier: End-to-End Evaluation Report

> [!IMPORTANT]
> **PROTOTYPE / DEMO-ONLY BENCHMARK**: This evaluation was conducted strictly on 180 synthetic complaints generated for prototype development. Metrics reflect synthetic lexical distributions and **must not be used to claim production readiness**.

- **Evaluation Timestamp:** `2026-10-27T20:16:57.503809+00:00`
- **Model Architecture:** TF-IDF Vectorizer (ngram 1-2, 5k max features) + Logistic Regression (L-BFGS)
- **Evaluation Dataset:** 180 samples (Train: 144 [80%], Held-out Test: 36 [20%])
- **Stratification:** Stratified across 9 complaint categories with fixed seed (`random_state=42`), zero data leakage

---

## 1. Executive Summary & Headline Metrics

| Evaluation Target | Architecture / Method | Accuracy | Macro F1 | Weighted F1 | Performance Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Category** (9 Classes) | Logistic Regression | **0.7222** (72.2%) | **0.6974** | **0.6974** | Moderate prototype capability |
| **Bureau** (Direct ML) | Logistic Regression | **0.4444** (44.4%) | **0.1713** | **0.3133** | Weak on raw text alone |
| **Bureau** (Hybrid Rule+ML) | Domain Heuristics + ML | **0.8333** (83.3%) | **0.7337** | **0.7888** | Strong statutory alignment |
| **Priority** (4 Classes) | Logistic Regression | **0.3889** (38.9%) | **0.1726** | **0.2982** | Imbalanced, biased to High |

---

## 2. Complaint Category Classification

### Per-Class Performance Breakdown

| Category | Precision | Recall | F1-Score | Test Support | Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admission Irregularity** | 1.00 | 0.50 | 0.67 | 4 | Acceptable |
| **Certificate Delay** | 0.80 | 1.00 | 0.89 | 4 | Excellent |
| **Curriculum** | 1.00 | 0.25 | 0.40 | 4 | Needs Data |
| **Faculty Norms** | 0.67 | 0.50 | 0.57 | 4 | Needs Data |
| **Fee Regulation** | 0.67 | 0.50 | 0.57 | 4 | Needs Data |
| **Harassment & Ragging** | 0.80 | 1.00 | 0.89 | 4 | Excellent |
| **Infrastructure** | 0.50 | 0.75 | 0.60 | 4 | Acceptable |
| **Skill Certification** | 0.80 | 1.00 | 0.89 | 4 | Excellent |
| **Unapproved Courses** | 0.67 | 1.00 | 0.80 | 4 | Excellent |

### Category Confusion Matrix

```text
Actual \ Pred                |   Admission Irregularity |        Certificate Delay |               Curriculum |            Faculty Norms |           Fee Regulation |     Harassment & Ragging |           Infrastructure |      Skill Certification |       Unapproved Courses
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Admission Irregularity       |                        2 |                        0 |                        0 |                        0 |                        1 |                        0 |                        0 |                        0 |                        1
Certificate Delay            |                        0 |                        4 |                        0 |                        0 |                        0 |                        0 |                        0 |                        0 |                        0
Curriculum                   |                        0 |                        0 |                        1 |                        0 |                        0 |                        0 |                        2 |                        1 |                        0
Faculty Norms                |                        0 |                        0 |                        0 |                        2 |                        0 |                        0 |                        1 |                        0 |                        1
Fee Regulation               |                        0 |                        1 |                        0 |                        0 |                        2 |                        1 |                        0 |                        0 |                        0
Harassment & Ragging         |                        0 |                        0 |                        0 |                        0 |                        0 |                        4 |                        0 |                        0 |                        0
Infrastructure               |                        0 |                        0 |                        0 |                        1 |                        0 |                        0 |                        3 |                        0 |                        0
Skill Certification          |                        0 |                        0 |                        0 |                        0 |                        0 |                        0 |                        0 |                        4 |                        0
Unapproved Courses           |                        0 |                        0 |                        0 |                        0 |                        0 |                        0 |                        0 |                        0 |                        4
```

---

## 3. Bureau Routing Evaluation (Direct ML vs. Hybrid Rule Resolution)

In Abhigyan, complaints are assigned to Bureaus through statutory jurisdiction rules supplemented by keyword matching and ML. Combining administrative domain knowledge with ML boosts accuracy from **44.4% to 83.3%**.

| Target Bureau | Jurisdiction Scope | Hybrid Precision | Hybrid Recall | Hybrid F1 | Test Support |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Academic** | AICTE Administrative Division | 0.80 | 0.57 | 0.67 | 7 |
| **Approval** | AICTE Administrative Division | 0.82 | 1.00 | 0.90 | 14 |
| **EO** | AICTE Administrative Division | 1.00 | 1.00 | 1.00 | 1 |
| **PGRC** | AICTE Administrative Division | 0.86 | 1.00 | 0.92 | 6 |
| **RB** | AICTE Administrative Division | 0.00 | 0.00 | 0.00 | 3 |
| **SB** | AICTE Administrative Division | 0.83 | 1.00 | 0.91 | 5 |

### Hybrid Bureau Confusion Matrix

```text
Actual \ Pred  |   Academic |   Approval |         EO |       PGRC |         RB |         SB
--------------------------------------------------------------------------------------------
Academic       |          4 |          2 |          0 |          0 |          0 |          1
Approval       |          0 |         14 |          0 |          0 |          0 |          0
EO             |          0 |          0 |          1 |          0 |          0 |          0
PGRC           |          0 |          0 |          0 |          6 |          0 |          0
RB             |          1 |          1 |          0 |          1 |          0 |          0
SB             |          0 |          0 |          0 |          0 |          0 |          5
```

---

## 4. Priority Classification

Priority prediction on synthetic text exhibits high majority-class bias toward 'High', missing nuanced distinction between 'Critical' and 'Medium'.

| Priority Level | Precision | Recall | F1-Score | Support |
| :--- | :--- | :--- | :--- | :--- |
| **Critical** | 0.00 | 0.00 | 0.00 | 7 |
| **High** | 0.45 | 0.76 | 0.57 | 17 |
| **Low** | 0.00 | 0.00 | 0.00 | 3 |
| **Medium** | 0.14 | 0.11 | 0.12 | 9 |

---

## 5. Confidence Analysis & Safeguards

- **Mean Softmax Confidence (Correct Cases):** `0.1656`
- **Mean Softmax Confidence (Incorrect Cases):** `0.1479`
- **Safety Threshold:** `0.4`
- **Low Confidence Trigger Count:** `36` / `36` (100.0%)
- **Total Manual Review Recommended Rate:** `36` / `36` (100.0%)

> [!NOTE]
> Because prototype softmax probabilities on a 9-class distribution distribute mass across multiple categories, 100% of test samples triggered the human scrutiny alert (`needs_manual_review = True`). This functions as a fail-safe against autonomous erroneous action.

---

## 6. Documented Limitations

- Dataset is composed of 180 synthetic complaint texts; real-world grievances feature informal grammar, Hinglish vernacular, code-switching, and spelling typos not captured here.
- Sub-categories within bureaus exhibit lexical overlap (e.g., fee-related vs admissions corruption both contain mentions of money or payments).
- Priority classification is based on text phrasing alone; statutory urgency often depends on external factors (exam dates, impending admissions cutoffs, court orders).
- Model probabilities represent uncalibrated softmax scores and must remain advisory with mandatory human-in-the-loop validation.
- Lack of document attachment/OCR parsing means predictions are restricted to subject and narrative text.
