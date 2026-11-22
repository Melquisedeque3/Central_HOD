"""Deterministic eligibility checks for collected opportunities.

This module intentionally distinguishes missing evidence from a negative
requirement.  It never promotes a listing to ELIGIBLE merely because the title
mentions Portuguese or Brazil.
"""
from __future__ import annotations

import re
from typing import Any, Dict

ELIGIBLE = "ELIGIBLE"
INELIGIBLE = "INELIGIBLE"
INCONCLUSIVE = "INCONCLUSIVE"


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _result(status: str, reason: str, evidence: str = "") -> Dict[str, str]:
    return {"status": status, "reason": reason, "evidence": evidence}


def geographic_eligibility(location: Any, requirements: Any, profile: Dict[str, Any]) -> Dict[str, str]:
    """Classify country/state eligibility using only explicit listing evidence."""
    location_text = _text(location)
    requirements_text = _text(requirements)
    combined = f"{location_text}\n{requirements_text}".lower()
    country = _text(profile.get("residence", {}).get("country", "Brazil")).lower()
    state = _text(profile.get("residence", {}).get("state", "Sergipe")).lower()

    if re.search(rf"\b(?:not eligible|excluded|except)\b[^.\n]{{0,120}}\b{re.escape(country)}\b", combined):
        return _result(INELIGIBLE, "Brasil explicitamente excluído", requirements_text)
    if re.search(rf"\b(?:not eligible|excluded|except)\b[^.\n]{{0,120}}\b{re.escape(state)}\b", combined):
        return _result(INELIGIBLE, "Sergipe explicitamente excluído", requirements_text)
    # A city is never evidence that every state in Brazil is eligible.
    if re.search(r"\bbras[ií]lia\b", location_text, re.IGNORECASE):
        return _result(INCONCLUSIVE, "localidade publicada é Brasília; Sergipe não foi confirmado", location_text)
    if re.search(rf"\b{re.escape(state)}\b", combined):
        return _result(ELIGIBLE, "Sergipe explicitamente indicado", location_text or requirements_text)
    if re.search(rf"\b{re.escape(country)}\b|\bbrasil\b", location_text, re.IGNORECASE):
        # A board location of simply “Brazil” is national eligibility.  A
        # specific city (handled above) or an explicit exclusion remains
        # insufficient; do not invent a state-level restriction where none
        # exists in the published listing.
        return _result(ELIGIBLE, "Brasil indicado sem restrição estadual publicada", location_text)
    if re.search(r"\bworldwide\b|\bglobal\b", location_text, re.IGNORECASE):
        return _result(INCONCLUSIVE, "remoto mundial sem confirmação para Brasil", location_text)
    if location_text:
        return _result(INELIGIBLE, "localidade publicada não inclui Brasil", location_text)
    return _result(INCONCLUSIVE, "localidade não informada", "")


def professional_eligibility(title: Any, requirements: Any, profile: Dict[str, Any]) -> Dict[str, str]:
    """Reject only explicit incompatibilities; unknown requirements stay open."""
    title_text = _text(title)
    combined = f"{title_text}\n{_text(requirements)}".lower()
    excluded = [str(item).lower() for item in profile.get("excludedAreas", [])]
    for term in excluded:
        if term and term in combined:
            return _result(INELIGIBLE, f"área excluída: {term}", title_text)
    languages = [str(item.get("name", "")).lower() for item in profile.get("languages", []) if isinstance(item, dict)]
    unsupported = ["german", "italian", "french", "japanese", "korean", "mandarin", "arabic", "russian"]
    for language in unsupported:
        if language in combined and language not in languages:
            return _result(INELIGIBLE, f"idioma obrigatório não registrado: {language}", title_text)
    experience = [str(item).strip().lower() for item in profile.get("experienceKeywords", []) if str(item).strip()]
    matched = [term for term in experience if term in combined]
    if matched:
        return _result(ELIGIBLE, f"experiência aderente comprovada: {', '.join(matched[:3])}", title_text)
    if not _text(requirements):
        return _result(INCONCLUSIVE, "requisitos profissionais não informados", "")
    return _result(INCONCLUSIVE, "requisitos exigem revisão estruturada", _text(requirements)[:1000])


def evaluate(opportunity: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, Any]:
    geo = geographic_eligibility(opportunity.get("location"), opportunity.get("requirements"), profile)
    professional = professional_eligibility(opportunity.get("title"), opportunity.get("requirements"), profile)
    if INELIGIBLE in (geo["status"], professional["status"]):
        overall = INELIGIBLE
    elif geo["status"] == ELIGIBLE and professional["status"] == ELIGIBLE:
        overall = ELIGIBLE
    else:
        overall = INCONCLUSIVE
    return {"overall": overall, "geographic": geo, "professional": professional, "profileVersion": profile.get("version", "unversioned")}
