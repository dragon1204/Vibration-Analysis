import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Golden files are produced by the edge project (t153_edge/testdata/golden).
GOLDEN = ROOT.parents[1] / "t153_edge" / "testdata" / "golden"
