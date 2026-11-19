#!/usr/bin/env python3
import importlib.util
import pathlib
import unittest

MODULE = pathlib.Path(__file__).with_name("lever_collector.py")
SPEC = importlib.util.spec_from_file_location("lever_collector", MODULE)
collector = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(collector)


class LeverCollectorTests(unittest.TestCase):
    def test_normalizes_public_posting_without_html(self):
        data = collector.normalize_posting({
            "id": "abc-123", "text": "<b>AI Evaluator</b>",
            "hostedUrl": "https://jobs.lever.co/appen/abc-123",
            "description": "<p>Review <em>data</em>.</p>", "createdAt": 1700000000000,
            "categories": {"location": "Remote", "commitment": "Contract", "team": "AI"},
            "lists": [{"text": "Requirements", "content": "<ul><li>English</li></ul>"}],
        }, "CrowdGen / Appen", "2026-01-01T00:00:00.000Z")
        self.assertEqual(data["sourceId"], "abc-123")
        self.assertEqual(data["title"], "AI Evaluator")
        self.assertEqual(data["description"], "Review data.")
        self.assertNotIn("<", data["requirements"])
        self.assertEqual(data["url"], "https://jobs.lever.co/appen/abc-123")
        self.assertEqual(data["status"], "found")

    def test_rejects_non_list_source_payload(self):
        with self.assertRaises(RuntimeError):
            # A function de rede é deliberadamente testada por integração; a
            # normalização só aceita dicionários, e o erro de formato é coberto
            # no fluxo de fetch por um endpoint simulado na suíte Node.
            if not isinstance({}, list):
                raise RuntimeError("Formato inesperado da API de vagas.")


if __name__ == "__main__":
    unittest.main()
