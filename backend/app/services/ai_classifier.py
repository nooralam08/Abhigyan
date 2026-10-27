"""
AI Complaint Classification Service.

Uses scikit-learn TF-IDF Vectorizer and Logistic Regression models
trained locally on synthetic complaint data for prototyping.

IMPORTANT ARCHITECTURAL & LEGAL NOTICES:
1. AI output is advisory and does NOT constitute an official AICTE decision.
2. The model confidence is the raw maximum softmax probability of the model;
   it is NOT calibrated real-world certainty.
3. This service loads model artifacts lazily and caches them in memory.
4. If artifacts are missing, corrupt, or incompatible, this service handles
   it gracefully without crashing the FastAPI application.
"""

import json
import logging
import os
import threading
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Base path definitions
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_ARTIFACTS_DIR = os.path.join(BASE_DIR, "ml", "artifacts")

# Configurable minimum confidence threshold (0.0 to 1.0)
DEFAULT_CONFIDENCE_THRESHOLD = float(os.getenv("AI_CONFIDENCE_THRESHOLD", "0.40"))

# Configurable Category to Bureau mapping
DEFAULT_CATEGORY_TO_BUREAU = {
    "Fee Regulation": "PGRC",
    "Faculty Norms": "Approval",
    "Infrastructure": "Approval",
    "Admission Irregularity": "Approval",
    "Certificate Delay": "Academic",
    "Curriculum": "Academic",
    "Unapproved Courses": "Approval",
    "Harassment & Ragging": "PGRC",
    "Skill Certification": "SB",
}

# Multi-bureau categories and contextual rule keywords
MULTI_BUREAU_RULES = {
    "Harassment & Ragging": {
        "EO": ["sexual", "posh", "icc", "caste", "minority", "gender", "sc/st", "discrimination"],
        "PGRC": ["ragging", "senior", "hostel", "physical", "beating", "freshers", "dormitory", "junior"]
    },
    "Fee Regulation": {
        "RB": ["donation", "bribe", "capitation", "cash", "extortion", "trust", "clerk"],
        "PGRC": ["tuition", "refund", "exam fee", "late fee", "bus", "transport", "hostel deposit"]
    },
    "Admission Irregularity": {
        "RB": ["bribe", "management quota", "agent", "tout", "spot counseling", "domicile fraud"],
        "Approval": ["intake", "sanctioned", "capacity", "unapproved", "cutoff", "reservation"]
    },
    "Certificate Delay": {
        "SB": ["skill", "vocational", "apprenticeship", "pmkvy", "nats", "stipend"],
        "Academic": ["degree", "marksheet", "transcript", "migration", "convocation", "revaluation"]
    }
}

VALID_BUREAUS = {"RB", "PGRC", "Approval", "Academic", "SB", "EO"}
VALID_PRIORITIES = {"Critical", "High", "Medium", "Low"}

# Priority urgency keyword rules for domain escalation
CRITICAL_PRIORITY_KEYWORDS = [
    "suicide", "poisoning", "food poisoning", "hospitalized", "hospital", "collapsed",
    "emergency", "threat to life", "physical assault", "sexual harassment", "rape",
    "posh", "death", "violence", "severe beating", "bleeding"
]

HIGH_PRIORITY_KEYWORDS = [
    "ragging", "admit card", "exam tomorrow", "hall ticket", "extortion",
    "capitation", "blackmail", "illegal detention", "struck off", "derecognized",
    "unapproved", "contaminated food", "maggots", "insects in food", "rat in food",
    "unhygienic", "spoiled food", "fungus"
]

LOW_PRIORITY_KEYWORDS = [
    "minor", "suggestion", "spelling", "elective", "canteen menu", "wifi speed",
    "routine inquiry", "sports equipment", "library hours"
]


def _resolve_priority(
    predicted_priority: str,
    priority_confidence: float,
    text: str
) -> tuple[str, bool, List[str]]:
    """
    Resolve grievance statutory priority combining ML model prediction with safety heuristics.
    Returns: (priority, needs_manual_review, reasons)
    """
    text_lower = text.lower()
    reasons = []

    # Critical triggers (emergency/life safety/acute harm) take precedence
    if any(kw in text_lower for kw in CRITICAL_PRIORITY_KEYWORDS):
        if predicted_priority != "Critical":
            reasons.append("priority_escalated_to_critical_due_to_safety_keywords")
        return "Critical", False, reasons

    # High triggers (acute academic, financial, or severe infrastructure deficits)
    if any(kw in text_lower for kw in HIGH_PRIORITY_KEYWORDS):
        if predicted_priority in ("Medium", "Low"):
            reasons.append("priority_escalated_to_high_due_to_urgency_keywords")
            return "High", False, reasons
        return predicted_priority, False, reasons

    # Low triggers (minor administrative / suggestions)
    if any(kw in text_lower for kw in LOW_PRIORITY_KEYWORDS) and predicted_priority in ("Medium", "Low"):
        return "Low", False, reasons

    # Fallback to model prediction
    if priority_confidence < 0.35:
        reasons.append("low_priority_confidence")
        return predicted_priority, True, reasons

    return predicted_priority, False, reasons


class _ModelCache:
    """Thread-safe lazy-loading cache for ML model artifacts."""

    def __init__(self, artifacts_dir: str = DEFAULT_ARTIFACTS_DIR):
        self.artifacts_dir = artifacts_dir
        self.vectorizer = None
        self.category_model = None
        self.priority_model = None
        self.bureau_model = None
        self.metadata: Dict[str, Any] = {}
        self.is_loaded = False
        self.load_failed = False
        self.load_error: Optional[str] = None
        self._lock = threading.Lock()

    def load(self, force_reload: bool = False) -> bool:
        if self.is_loaded and not force_reload:
            return True

        with self._lock:
            if self.is_loaded and not force_reload:
                return True

            try:
                import joblib

                vec_path = os.path.join(self.artifacts_dir, "vectorizer.joblib")
                cat_path = os.path.join(self.artifacts_dir, "category_model.joblib")
                prio_path = os.path.join(self.artifacts_dir, "priority_model.joblib")
                bur_path = os.path.join(self.artifacts_dir, "bureau_model.joblib")
                meta_path = os.path.join(self.artifacts_dir, "metadata.json")

                # Verify files exist
                missing = [p for p in (vec_path, cat_path, prio_path) if not os.path.isfile(p)]
                if missing:
                    self.load_failed = True
                    self.load_error = f"Missing model artifact files: {missing}"
                    logger.warning(f"AI Classifier artifacts not found: {self.load_error}")
                    return False

                # Load metadata if present
                if os.path.isfile(meta_path):
                    with open(meta_path, "r", encoding="utf-8") as f:
                        self.metadata = json.load(f)
                else:
                    self.metadata = {"model_version": "prototype-unversioned"}

                # Load joblib artifacts
                self.vectorizer = joblib.load(vec_path)
                self.category_model = joblib.load(cat_path)
                self.priority_model = joblib.load(prio_path)

                if os.path.isfile(bur_path):
                    self.bureau_model = joblib.load(bur_path)

                self.is_loaded = True
                self.load_failed = False
                self.load_error = None
                logger.info(
                    f"AI Classifier artifacts successfully loaded (version: {self.metadata.get('model_version')})"
                )
                return True

            except Exception as e:
                self.load_failed = True
                self.load_error = str(e)
                self.is_loaded = False
                logger.error(f"Failed to load AI Classifier artifacts: {e}", exc_info=True)
                return False


# Global singleton instance
_model_cache = _ModelCache()


def _resolve_bureau(
    category: Optional[str],
    text: str,
    predicted_bureau: Optional[str] = None
) -> tuple[Optional[str], bool, List[str]]:
    """
    Resolve bureau based on configured rules and domain heuristics.
    Returns: (bureau, needs_manual_review_flag, reasons)
    """
    if not category:
        return None, True, ["no_category_predicted"]

    reasons = []
    text_lower = text.lower()

    # If category has multi-bureau rules
    if category in MULTI_BUREAU_RULES:
        rules = MULTI_BUREAU_RULES[category]
        matched_bureaus = []
        for bureau, keywords in rules.items():
            if any(kw in text_lower for kw in keywords):
                matched_bureaus.append(bureau)

        if len(matched_bureaus) == 1:
            # Rule clearly justified
            return matched_bureaus[0], False, reasons
        elif len(matched_bureaus) > 1:
            # Ambiguous match among multiple bureaus
            reasons.append("multi_bureau_ambiguity")
            # Fall back to default bureau or predicted bureau, but flag for manual review
            chosen = predicted_bureau if predicted_bureau in matched_bureaus else DEFAULT_CATEGORY_TO_BUREAU.get(category)
            return chosen, True, reasons
        else:
            # No specific rule triggered, use model or default with manual review
            chosen = predicted_bureau if (predicted_bureau and predicted_bureau in rules) else DEFAULT_CATEGORY_TO_BUREAU.get(category)
            reasons.append("multi_bureau_rule_untriggered")
            return chosen, True, reasons

    # Standard 1-to-1 mapped categories
    default_bureau = DEFAULT_CATEGORY_TO_BUREAU.get(category)
    return default_bureau, False, reasons


def classify_complaint(
    title: str,
    description: str,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    artifacts_dir: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Classify a complaint by predicting category, priority, and suggested bureau.

    Args:
        title: Title of the complaint.
        description: Description of the complaint.
        confidence_threshold: Minimum probability threshold for automatic acceptance.
        artifacts_dir: Optional custom path to artifact directory.

    Returns:
        Structured result dict containing:
            - category: Predicted complaint category (str or None)
            - bureau: Suggested bureau/cell (str or None)
            - priority: Suggested priority level (str or None)
            - confidence: Category prediction confidence (float)
            - needs_manual_review: Whether human officer verification is required (bool)
            - model_version: Version identifier of the prototype model (str)
            - advisory_notice: AI ethics and advisory disclaimer (str)
            - status: 'success', 'unavailable', or 'invalid_input'
            - review_reasons: List of reasons if manual review is required
    """
    clean_title = (title or "").strip()
    clean_description = (description or "").strip()

    # Reject or safely handle empty input
    if not clean_title and not clean_description:
        return {
            "category": None,
            "bureau": None,
            "priority": None,
            "confidence": 0.0,
            "priority_confidence": 0.0,
            "needs_manual_review": True,
            "model_version": None,
            "status": "invalid_input",
            "advisory_notice": "AI classification is advisory only.",
            "review_reasons": ["empty_input"]
        }

    # Ensure model cache is loaded
    cache = _model_cache
    if artifacts_dir and artifacts_dir != cache.artifacts_dir:
        # Custom artifacts dir requested
        cache = _ModelCache(artifacts_dir=artifacts_dir)

    loaded = cache.load()
    if not loaded or cache.vectorizer is None or cache.category_model is None:
        logger.warning("AI classification requested but model artifacts are unavailable.")
        return {
            "category": None,
            "bureau": None,
            "priority": None,
            "confidence": 0.0,
            "priority_confidence": 0.0,
            "needs_manual_review": True,
            "model_version": cache.metadata.get("model_version", "unavailable"),
            "status": "unavailable",
            "advisory_notice": "AI classification is advisory only.",
            "review_reasons": [cache.load_error or "model_artifacts_unavailable"]
        }

    try:
        combined_text = f"{clean_title} {clean_description}".strip()
        X = cache.vectorizer.transform([combined_text])

        # Category prediction and confidence
        cat_probs = cache.category_model.predict_proba(X)[0]
        cat_idx = int(cat_probs.argmax())
        predicted_category = str(cache.category_model.classes_[cat_idx])
        category_confidence = float(cat_probs[cat_idx])

        # Priority prediction and confidence
        prio_probs = cache.priority_model.predict_proba(X)[0]
        prio_idx = int(prio_probs.argmax())
        predicted_priority = str(cache.priority_model.classes_[prio_idx])
        priority_confidence = float(prio_probs[prio_idx])

        # Bureau auxiliary prediction (if bureau model present)
        predicted_bureau = None
        if cache.bureau_model is not None:
            bur_probs = cache.bureau_model.predict_proba(X)[0]
            bur_idx = int(bur_probs.argmax())
            predicted_bureau = str(cache.bureau_model.classes_[bur_idx])

        # Bureau resolution with configurable category-to-bureau rules
        suggested_bureau, bureau_manual_review, bureau_reasons = _resolve_bureau(
            predicted_category, combined_text, predicted_bureau
        )

        # Priority resolution with safety and domain urgency heuristics
        resolved_priority, prio_manual_review, prio_reasons = _resolve_priority(
            predicted_priority, priority_confidence, combined_text
        )

        review_reasons = []
        needs_manual_review = False

        # Check confidence threshold
        if category_confidence < confidence_threshold:
            needs_manual_review = True
            review_reasons.append(f"low_category_confidence ({category_confidence:.2f} < {confidence_threshold:.2f})")

        if bureau_manual_review:
            needs_manual_review = True
            review_reasons.extend(bureau_reasons)

        if prio_reasons:
            review_reasons.extend(prio_reasons)

        return {
            "category": predicted_category,
            "bureau": suggested_bureau,
            "priority": resolved_priority,
            "confidence": round(category_confidence, 4),
            "priority_confidence": round(priority_confidence, 4),
            "needs_manual_review": needs_manual_review,
            "model_version": cache.metadata.get("model_version", "prototype-v1.0.0"),
            "status": "success",
            "advisory_notice": "AI classification is advisory only and does NOT constitute an official AICTE decision.",
            "review_reasons": review_reasons
        }

    except Exception as e:
        logger.error(f"Inference error during complaint classification: {e}", exc_info=True)
        return {
            "category": None,
            "bureau": None,
            "priority": None,
            "confidence": 0.0,
            "priority_confidence": 0.0,
            "needs_manual_review": True,
            "model_version": cache.metadata.get("model_version", "unknown"),
            "status": "error",
            "advisory_notice": "AI classification is advisory only.",
            "review_reasons": [f"inference_error: {str(e)}"]
        }


def reload_model(artifacts_dir: Optional[str] = None) -> bool:
    """Forces reloading model artifacts from disk."""
    if artifacts_dir:
        _model_cache.artifacts_dir = artifacts_dir
    return _model_cache.load(force_reload=True)
