#!/usr/bin/env python3
import unittest
from eligibility import ELIGIBLE, INELIGIBLE, INCONCLUSIVE, evaluate, geographic_eligibility

PROFILE = {
    "version": "resume-melquisedeque-2026-11",
    "residence": {"country": "Brazil", "state": "Sergipe"},
    "languages": [{"name": "portuguese"}, {"name": "english"}, {"name": "spanish"}],
    "excludedAreas": ["software engineer", "medical"],
}


class EligibilityTests(unittest.TestCase):
    def test_brazil_without_state_is_eligible_when_no_city_or_exclusion_is_published(self):
        result = geographic_eligibility("Brazil", "Remote role", PROFILE)
        self.assertEqual(result["status"], ELIGIBLE)

    def test_brasilia_does_not_prove_sergipe(self):
        result = geographic_eligibility("Brasilia", "Remote", PROFILE)
        self.assertEqual(result["status"], INCONCLUSIVE)

    def test_explicit_exclusion_is_ineligible(self):
        result = geographic_eligibility("Remote", "Applicants from Brazil are not eligible.", PROFILE)
        self.assertEqual(result["status"], INELIGIBLE)

    def test_worldwide_without_brazil_proof_is_inconclusive(self):
        result = geographic_eligibility("Remote, Worldwide", "", PROFILE)
        self.assertEqual(result["status"], INCONCLUSIVE)

    def test_explicit_state_is_eligible(self):
        result = geographic_eligibility("Remote", "Residents of Sergipe, Brazil are eligible.", PROFILE)
        self.assertEqual(result["status"], ELIGIBLE)

    def test_explicit_professional_mismatch_wins(self):
        result = evaluate({"location": "Brazil", "title": "Software Engineer", "requirements": "Python required"}, PROFILE)
        self.assertEqual(result["overall"], INELIGIBLE)

    def test_profile_experience_can_confirm_professional_fit(self):
        profile = {**PROFILE, "experienceKeywords": ["search quality", "data quality"]}
        result = evaluate({"location": "Brazil", "title": "Junior Quality Coordinator", "requirements": "Search Quality and data quality reports"}, profile)
        self.assertEqual(result["overall"], ELIGIBLE)


if __name__ == "__main__":
    unittest.main()
