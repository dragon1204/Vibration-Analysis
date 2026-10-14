import unittest

import numpy as np

from smartmotor.analytics.anomaly import RUL_MODEL_VERSION, rul_exponential


class RulExponentialTests(unittest.TestCase):
    def test_recovers_clean_exponential_time_to_threshold(self):
        t = np.repeat(np.arange(40, dtype=float), 3) + np.tile([0.1, 0.4, 0.8], 40)
        y = np.exp(0.03 * t)
        result = rul_exponential(t, y, threshold=4.0, n_boot=100, seed=7)
        expected = np.log(4.0) / 0.03 - t.max()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["model_version"], RUL_MODEL_VERSION)
        self.assertAlmostEqual(result["rul_days"], expected, delta=1.0)
        self.assertLessEqual(result["rul_lo_days"], result["rul_days"])
        self.assertGreaterEqual(result["rul_hi_days"], result["rul_days"])

    def test_rejects_many_samples_from_a_short_commissioning_run(self):
        t = np.arange(60, dtype=float) / (24 * 60)  # one sample/minute for one hour
        y = np.exp(0.2 * t)
        result = rul_exponential(t, y, threshold=2.0, n_boot=50)
        self.assertIn(result["status"], {"insufficient_time_bins", "insufficient_span"})
        self.assertIsNone(result["rul_days"])

    def test_rejects_declining_feature(self):
        t = np.repeat(np.arange(40, dtype=float), 2) + np.tile([0.2, 0.7], 40)
        y = 2.0 * np.exp(-0.02 * t)
        result = rul_exponential(t, y, threshold=4.0, n_boot=50)
        self.assertEqual(result["status"], "no_significant_positive_trend")
        self.assertIsNone(result["rul_days"])

    def test_is_robust_to_a_gross_outlier(self):
        t = np.repeat(np.arange(45, dtype=float), 2) + np.tile([0.2, 0.7], 45)
        y = np.exp(0.025 * t)
        y[(t > 20) & (t < 21)] *= 20
        result = rul_exponential(t, y, threshold=4.0, n_boot=100, seed=3)
        self.assertEqual(result["status"], "ok")
        self.assertGreaterEqual(result["outliers_removed"], 1)
        self.assertLess(result["rul_days"], 20)

    def test_reports_zero_after_threshold_is_reached(self):
        t = np.repeat(np.arange(20, dtype=float), 2) + np.tile([0.1, 0.6], 20)
        y = np.exp(0.08 * t)
        result = rul_exponential(t, y, threshold=3.0, n_boot=50)
        self.assertEqual(result["status"], "threshold_reached")
        self.assertEqual(result["rul_days"], 0.0)


if __name__ == "__main__":
    unittest.main()
