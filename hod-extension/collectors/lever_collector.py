#!/usr/bin/env python3
"""Coletor determinístico para quadros públicos do Lever.

Lê somente anúncios publicados pelo endpoint Postings API e, quando chamado
com --commit, envia registros normalizados para a inbox restrita do HOD.
Não lê o vault, não usa shell, não se candidata e não armazena credenciais.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any, Dict, Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

MAX_RESPONSE_BYTES = 5 * 1024 * 1024
DEFAULT_ENDPOINT = "https://api.lever.co/v0/postings/{site}?mode=json"


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return re.sub(r"\s+", " ", html.unescape(" ".join(self.parts))).strip()


def plain_text(value: Any, limit: int = 120_000) -> str:
    parser = TextExtractor()
    parser.feed(str(value or ""))
    parser.close()
    return re.sub(r"\s+([,.;:!?])", r"\1", parser.text())[:limit]


def iso_millis(value: Any) -> str | None:
    if not isinstance(value, (int, float)):
        return None
    # Lever historically emits milliseconds; accepting seconds makes fixtures
    # and future compatible values deterministic without guessing dates.
    seconds = value / 1000 if value > 10_000_000_000 else value
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def normalize_posting(posting: Dict[str, Any], source: str, collected_at: str) -> Dict[str, Any]:
    categories = posting.get("categories") if isinstance(posting.get("categories"), dict) else {}
    lists = posting.get("lists") if isinstance(posting.get("lists"), list) else []
    requirement_parts = []
    for item in lists:
        if isinstance(item, dict):
            label = plain_text(item.get("text"), 4_000)
            content = plain_text(item.get("content"), 30_000)
            if label or content:
                requirement_parts.append(f"{label}: {content}".strip(": "))
    location = plain_text(categories.get("location"), 400)
    commitment = plain_text(categories.get("commitment"), 400)
    team = plain_text(categories.get("team"), 400)
    evidence = [str(posting.get("hostedUrl") or posting.get("applyUrl") or "")]
    evidence.extend(filter(None, [location, commitment, team]))
    return {
        "source": source,
        "sourceId": str(posting.get("id") or "").strip(),
        "company": source,
        "title": plain_text(posting.get("text"), 240),
        "url": str(posting.get("hostedUrl") or posting.get("applyUrl") or "").strip(),
        "description": plain_text(posting.get("descriptionPlain") or posting.get("description")),
        "requirements": "\n".join(requirement_parts)[:120_000],
        "publishedAt": iso_millis(posting.get("createdAt")),
        "collectedAt": collected_at,
        "status": "found",
        "priority": "normal",
        "evidence": [value for value in evidence if value][:40],
    }


def fetch_postings(endpoint: str, timeout: int) -> Iterable[Dict[str, Any]]:
    request = Request(endpoint, headers={"Accept": "application/json", "User-Agent": "Central-HOD-Collector/1.0"})
    try:
        with urlopen(request, timeout=timeout) as response:  # nosec B310: endpoint is explicit HTTPS default/CLI controlled
            if response.status != 200:
                raise RuntimeError(f"Fonte respondeu HTTP {response.status}.")
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as error:
        raise RuntimeError(f"Fonte respondeu HTTP {error.code}.") from error
    except URLError as error:
        raise RuntimeError(f"Fonte indisponível: {error.reason}.") from error
    if len(raw) > MAX_RESPONSE_BYTES:
        raise RuntimeError("Resposta da fonte excede o limite de 5 MiB.")
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("Fonte não devolveu JSON válido.") from error
    if not isinstance(data, list):
        raise RuntimeError("Formato inesperado da API de vagas.")
    return (item for item in data if isinstance(item, dict))


def send_to_hod(api_url: str, token: str, opportunity: Dict[str, Any], timeout: int) -> str:
    payload = json.dumps({"data": opportunity}).encode("utf-8")
    request = Request(
        api_url.rstrip("/") + "/api/opportunities",
        data=payload,
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=timeout) as response:  # nosec B310: local HOD URL is supplied by its operator
            if response.status != 201:
                raise RuntimeError(f"HOD respondeu HTTP {response.status}.")
            return "created"
    except HTTPError as error:
        if error.code == 409:
            return "duplicate"
        raise RuntimeError(f"HOD respondeu HTTP {error.code}.") from error
    except URLError as error:
        raise RuntimeError(f"HOD indisponível: {error.reason}.") from error


def main() -> int:
    parser = argparse.ArgumentParser(description="Lê vagas públicas de um board Lever para a inbox da Central HOD.")
    parser.add_argument("--site", default="appen", help="identificador público do board Lever (padrão: appen)")
    parser.add_argument("--source", default="CrowdGen / Appen", help="nome exibido no HOD")
    parser.add_argument("--endpoint", help="endpoint de teste ou compatível; padrão é a API pública Lever")
    parser.add_argument("--api-url", default=os.environ.get("HOD_API_URL", "http://127.0.0.1:8420"))
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--commit", action="store_true", help="grava no HOD; sem isto apenas mostra o resumo")
    args = parser.parse_args()
    endpoint = args.endpoint or DEFAULT_ENDPOINT.format(site=args.site)
    if not endpoint.startswith("https://") and not endpoint.startswith("http://127.0.0.1"):
        print("Endpoint deve usar HTTPS (ou loopback para testes).", file=sys.stderr)
        return 2
    if args.timeout < 1 or args.timeout > 120:
        print("Timeout deve estar entre 1 e 120 segundos.", file=sys.stderr)
        return 2
    token = os.environ.get("HOD_COLLECTOR_TOKEN", "")
    if args.commit and not token:
        print("HOD_COLLECTOR_TOKEN é obrigatório com --commit.", file=sys.stderr)
        return 2
    collected_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    try:
        opportunities = [normalize_posting(posting, args.source, collected_at) for posting in fetch_postings(endpoint, args.timeout)]
        opportunities = [item for item in opportunities if item["sourceId"] and item["title"] and item["url"].startswith(("https://", "http://"))]
        results = {"created": 0, "duplicate": 0, "preview": len(opportunities)}
        if args.commit:
            results["preview"] = 0
            for opportunity in opportunities:
                results[send_to_hod(args.api_url, token, opportunity, args.timeout)] += 1
        print(json.dumps({"ok": True, "source": args.source, "endpoint": endpoint, "commit": args.commit, **results}, ensure_ascii=False))
        return 0
    except RuntimeError as error:
        print(json.dumps({"ok": False, "source": args.source, "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
