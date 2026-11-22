#!/usr/bin/env python3
import json
import pathlib
import unittest

REGISTRY = pathlib.Path(__file__).with_name("source_registry.json")
ALLOWED_TYPES = {"OFFICIAL_API", "PUBLIC_ATS_API", "OFFICIAL_RSS", "AUTHORIZED_PUBLIC_PAGE", "GMAIL_ALERT", "MANUAL"}
ALLOWED_AUTH = {"AUTORIZADO", "RESTRITO", "MANUAL", "INCONCLUSIVO"}
ALLOWED_STATE = {"ativo", "pausado", "manual", "inconclusivo"}


class SourceRegistryTests(unittest.TestCase):
    def test_registry_has_unique_safe_sources(self):
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        self.assertEqual(registry["version"], 1)
        sources = registry["sources"]
        ids = [source["id"] for source in sources]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreaterEqual(len(sources), 18)
        for source in sources:
            self.assertTrue(source["officialUrl"].startswith("https://"))
            self.assertIn(source["integrationType"], ALLOWED_TYPES)
            self.assertIn(source["authorization"], ALLOWED_AUTH)
            self.assertIn(source["state"], ALLOWED_STATE)
            self.assertIsInstance(source["frequencyHours"], int)

    def test_only_authorized_sources_are_active(self):
        sources = json.loads(REGISTRY.read_text(encoding="utf-8"))["sources"]
        for source in sources:
            if source["state"] == "ativo":
                self.assertEqual(source["authorization"], "AUTORIZADO")
                self.assertIn(source["integrationType"], {"OFFICIAL_API", "PUBLIC_ATS_API", "OFFICIAL_RSS"})


if __name__ == "__main__":
    unittest.main()
