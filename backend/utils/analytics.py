from typing import Iterable, Dict

# Basic stubs for analytics helpers

def average_ratings(answers: Iterable[Dict[int, float]]) -> float:
    """Compute average rating from list of ratings-like dicts or values."""
    vals = []
    for a in answers:
        if isinstance(a, dict):
            vals.extend([float(v) for v in a.values() if v is not None])
        else:
            try:
                vals.append(float(a))
            except Exception:
                continue
    return sum(vals) / len(vals) if vals else 0.0
