"""Rule-based diagnosis v1 (spec 6.5) combined with the Beer HN FFT scan (slides 12–15).

Input is a capture FeatureSet (edge or reprocessed) plus context; output is a ranked list
of candidate faults with confidence, evidence and a recommendation (Vietnamese UI text).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

RULES_VERSION = "diag-v1"

DEFAULT_PARAMS = {
    "unbalance_energy_ratio": 0.7,
    "unbalance_axial_ratio": 0.5,
    "unbalance_2x_ratio": 0.3,
    "misalign_2x_ratio": 0.5,
    "misalign_axial_ratio": 0.5,
    "looseness_min_orders": 4,
    "bearing_min_harmonics": 2,
    "bearing_peak_floor": 3,
    "electrical_unbalance_pct": 5,
    "electrical_2lf_ratio": 0.5,
    "bearing_temp_confirm_c": 90,
    "mesh_growth_ratio": 1.5,
    "resonance_ratio": 0.6,
}

RECOMMEND = {
    "unbalance": "Kiểm tra bám bẩn/mẻ cánh quạt; siết bu-lông gầm máy; cân bằng động",
    "misalignment": "Căn chỉnh đồng trục động cơ – máy công tác bằng thiết bị laser; kiểm tra khớp nối",
    "bent_shaft": "Đo pha qua khớp nối để phân biệt trục cong và lệch tâm; kiểm tra độ đảo trục",
    "looseness": "Kiểm tra bulông chân, bệ, mặt bích; kiểm tra đệm cao su/vòng đệm khớp nối",
    "bearing_outer": "Bơm mỡ bôi trơn bổ sung; nếu biên độ không giảm, lên kế hoạch thay vòng bi",
    "bearing_inner": "Lỗi vòng trong tiến triển nhanh: lên kế hoạch dừng máy thay vòng bi trong 24–48 giờ",
    "bearing_ball": "Theo dõi sát; chuẩn bị vòng bi thay thế, kiểm tra bôi trơn",
    "bearing_cage": "Kiểm tra bôi trơn; vòng cách hỏng thường đi kèm lỗi vòng bi khác",
    "electrical_stator": "Kiểm tra nguồn cấp, cân bằng pha, cách điện cuộn dây",
    "winding_overheat": "Giảm tải; kiểm tra quạt làm mát, mất cân bằng pha, nhiệt môi trường",
    "resonance": "Bump test, gia cường kết cấu/bệ đỡ",
    "compressor_mesh_wear": "Biên độ tại tần số ăn khớp thùy tăng: kiểm tra mòn bề mặt thùy trục vít, dầu bôi trơn máy nén",
    "unknown": "Bất thường chưa khớp luật nào – kỹ sư cần xem phổ và dạng sóng",
}

FAULT_LABEL = {
    "unbalance": "Mất cân bằng", "misalignment": "Lệch tâm khớp nối", "bent_shaft": "Trục cong",
    "looseness": "Lỏng cơ khí", "bearing_outer": "Lỗi vòng ngoài (BPFO)", "bearing_inner": "Lỗi vòng trong (BPFI)",
    "bearing_ball": "Lỗi viên bi (BSF)", "bearing_cage": "Lỗi vòng cách (FTF)", "electrical_stator": "Lỗi điện stator",
    "winding_overheat": "Quá nhiệt cuộn dây", "resonance": "Cộng hưởng", "compressor_mesh_wear": "Mòn thùy máy nén",
    "unknown": "Không xác định",
}


@dataclass
class DiagContext:
    axes_map: dict = field(default_factory=dict)       # {"x":"radial_h","y":"axial","z":"radial_v"}
    baseline: dict = field(default_factory=dict)       # feature -> {"median","warn","alarm"}
    bearing_temp_c: float | None = None
    winding_temp_c: float | None = None
    winding_limit_c: float = 130
    i_unbalance_pct: float | None = None
    thd_i_pct: float | None = None
    load_pct: float | None = None
    iso_zone: str | None = None
    anomaly_score: float | None = None
    mesh_baseline_mm_s: float | None = None
    params: dict = field(default_factory=dict)


def _axis_roles(axes_map: dict) -> tuple[list[str], list[str]]:
    radial = [a for a, r in (axes_map or {}).items() if str(r).startswith("radial")]
    axial = [a for a, r in (axes_map or {}).items() if r == "axial"]
    if not radial:
        radial = ["x", "z"]
    if not axial:
        axial = [a for a in ("x", "y", "z") if a not in radial][:1]
    return radial, axial


def _get(d: dict, *path, default=0.0):
    cur = d
    for p in path:
        if not isinstance(cur, dict) or p not in cur or cur[p] is None:
            return default
        cur = cur[p]
    return cur


def _orders(features: dict, axis: str, isolated: bool) -> dict:
    if isolated:
        iso = (features.get("isolation") or {}).get("axes", {}).get(axis)
        if iso and iso.get("orders"):
            return iso["orders"]
    return _get(features, "axes", axis, "orders", default={}) or {}


def diagnose(features: dict, ctx: DiagContext) -> list[dict]:
    """Return candidates sorted by confidence (desc). features = {"axes","envelope","isolation"}."""
    p = {**DEFAULT_PARAMS, **(ctx.params or {})}
    radial, axial = _axis_roles(ctx.axes_map)
    isolated = bool(features.get("isolation"))
    cands: list[dict] = []

    def add(fault: str, conf: float, evidence: list[dict]):
        cands.append({"fault": fault, "label": FAULT_LABEL[fault], "confidence": round(min(conf, 0.99), 2),
                      "evidence": evidence, "recommendation": RECOMMEND[fault]})

    # Transmitted peaks (Beer HN cross-coherence with S1) are excluded from evidence.
    transmitted = {round(pk["freq_hz"]) for pk in (features.get("isolation") or {}).get("transmitted_peaks") or []}

    # Strongest radial axis.
    r_axis = max(radial, key=lambda a: _orders(features, a, isolated).get("1", 0.0)) if radial else "x"
    o_r = _orders(features, r_axis, isolated)
    o_a = _orders(features, axial[0], isolated) if axial else {}
    v1, v2 = o_r.get("1", 0.0), o_r.get("2", 0.0)
    a1, a2 = o_a.get("1", 0.0), o_a.get("2", 0.0)
    iso_r = _get(features, "axes", r_axis, "iso_vrms_mm_s")
    if isolated:
        iso_r = _get(features, "isolation", "axes", r_axis, "iso_vrms_mm_s", default=iso_r)
    w1 = ctx.baseline.get(f"{r_axis}.orders.1", {}).get("warn")

    # --- Unbalance: 1X dominant radial ---
    if iso_r > 0 and v1 > 0:
        ratio = (v1 / iso_r) ** 2  # share of band energy at 1X
        if ratio >= p["unbalance_energy_ratio"] and (w1 is None or v1 > w1):
            conf = 0.5 + 0.3 * min(1, (ratio - p["unbalance_energy_ratio"]) / 0.3)
            ev = [{"feature": f"{r_axis}.orders.1", "value": round(v1, 3), "ref": round(iso_r, 3),
                   "note": f"1X chiếm {ratio * 100:.0f}% năng lượng dải ISO"}]
            if v1 > 0 and a1 < p["unbalance_axial_ratio"] * v1:
                conf += 0.1
                ev.append({"feature": f"{axial[0] if axial else '?'}.orders.1", "value": round(a1, 3), "note": "dọc trục thấp"})
            if v2 < p["unbalance_2x_ratio"] * v1:
                conf += 0.05
                ev.append({"feature": f"{r_axis}.orders.2", "value": round(v2, 3), "note": "2X < 30% 1X"})
            add("unbalance", conf, ev)

    # --- Misalignment / bent shaft: strong 2X, high axial ---
    if v1 > 0 and v2 >= p["misalign_2x_ratio"] * v1:
        conf = 0.45 + (0.15 if v2 >= v1 else 0)
        ev = [{"feature": f"{r_axis}.orders.2", "value": round(v2, 3), "ref": round(v1, 3), "note": "2X ≥ 0,5 × 1X"}]
        if max(a1, a2) >= p["misalign_axial_ratio"] * max(v1, v2):
            conf += 0.2
            ev.append({"feature": f"{axial[0]}.orders.1-2", "value": round(max(a1, a2), 3), "note": "rung dọc trục cao"})
        if o_r.get("3", 0) > 0.3 * v1:
            conf += 0.05
            ev.append({"feature": f"{r_axis}.orders.3", "value": round(o_r.get("3", 0), 3), "note": "có 3X"})
        add("misalignment", conf, ev)
        add("bent_shaft", conf * 0.5, ev + [{"feature": "phase", "note": "chỉ phân biệt được bằng đo pha"}])

    # --- Looseness: many harmonics + sub/inter-harmonics ---
    ref = max(iso_r * 0.1, 0.05)
    n_high = sum(1 for k in ("1", "2", "3", "4", "5", "6") if o_r.get(k, 0) > ref)
    sub = max(o_r.get("0.5", 0), o_r.get("1.5", 0))
    if n_high >= p["looseness_min_orders"] and sub > 0.3 * ref:
        conf = 0.45 + 0.05 * (n_high - p["looseness_min_orders"]) + (0.15 if sub > ref else 0)
        add("looseness", conf, [{"feature": f"{r_axis}.orders.1..6", "value": n_high, "note": f"{n_high} bậc vượt nền"},
                                {"feature": f"{r_axis}.orders.0.5|1.5", "value": round(sub, 3), "note": "có 0,5X/1,5X"}])

    # --- Bearing faults from envelope ---
    env = features.get("envelope") or {}
    kurt = max((_get(features, "axes", a, "kurtosis") for a in ("x", "y", "z")), default=0.0)
    for key, fault in (("bpfo", "bearing_outer"), ("bpfi", "bearing_inner"), ("bsf2", "bearing_ball"), ("ftf", "bearing_cage")):
        best = None
        for a, ea in (env.get("axes") or {}).items():
            fp = (ea.get("faults") or {}).get(key)
            if fp and (best is None or fp.get("amp_g", 0) > best[1].get("amp_g", 0)):
                best = (a, fp)
        if not best:
            continue
        a, fp = best
        ratios = fp.get("peak_floor") or []
        if fp.get("n_harmonics", 0) >= p["bearing_min_harmonics"] and ratios and ratios[0] >= p["bearing_peak_floor"]:
            if round(fp.get("freq_hz", 0)) in transmitted:
                continue
            conf = 0.55 + 0.05 * min(fp["n_harmonics"], 4)
            ev = [{"feature": f"env.{a}.{key}", "value": round(fp["amp_g"], 4), "note":
                   f"{fp['n_harmonics']} hài, đỉnh/nền {ratios[0]:.1f} tại {fp['freq_hz']:.1f} Hz"}]
            if kurt > 4:
                conf += 0.1
                ev.append({"feature": "kurtosis", "value": round(kurt, 2), "note": "kurtosis > 4"})
            if ctx.bearing_temp_c is not None and ctx.bearing_temp_c > p["bearing_temp_confirm_c"]:
                conf += 0.15
                ev.append({"feature": "bearing_temp_c", "value": round(ctx.bearing_temp_c, 1),
                           "note": "nhiệt ổ > 90 °C: hai bằng chứng độc lập trùng nhau"})
            add(fault, conf, ev)
    # Isolated narrowband BPFO/BPFI above SOP alarm (velocity spectrum evidence)
    for be in (features.get("isolation") or {}).get("bands") or []:
        if be.get("band") in ("bpfo", "bpfi") and be.get("level") in ("warning", "alarm"):
            fault = "bearing_outer" if be["band"] == "bpfo" else "bearing_inner"
            if not any(c["fault"] == fault for c in cands):
                add(fault, 0.45 if be["level"] == "warning" else 0.6,
                    [{"feature": f"iso.{be['axis']}.{be['band']}", "value": be["vel_mm_s"], "ref": be["alarm"],
                      "note": f"vượt ngưỡng SOP ({be['level']})"}])

    # --- Electrical stator: strong 2×f_line ---
    lf = max((_get(features, "axes", a, "line_2x_mm_s") for a in radial), default=0.0)
    if lf > 0 and v1 > 0 and lf >= p["electrical_2lf_ratio"] * v1 and 100 not in transmitted:
        conf = 0.4
        ev = [{"feature": "line_2x_mm_s", "value": round(lf, 3), "ref": round(v1, 3), "note": "đỉnh 2×f_line (100 Hz) mạnh"}]
        if ctx.i_unbalance_pct is not None and ctx.i_unbalance_pct > p["electrical_unbalance_pct"]:
            conf += 0.25
            ev.append({"feature": "i_unbalance_pct", "value": round(ctx.i_unbalance_pct, 2), "note": "mất cân bằng dòng > 5%"})
        if ctx.thd_i_pct is not None and ctx.thd_i_pct > 10:
            conf += 0.1
            ev.append({"feature": "thd_i_pct", "value": round(ctx.thd_i_pct, 1), "note": "THD dòng cao"})
        add("electrical_stator", conf, ev)

    # --- Winding overheating (estimate) ---
    if ctx.winding_temp_c is not None and ctx.winding_temp_c > ctx.winding_limit_c:
        ev = [{"feature": "winding_temp_est_c", "value": round(ctx.winding_temp_c, 1), "ref": ctx.winding_limit_c,
               "note": "nhiệt cuộn dây (ước lượng) vượt ngưỡng"}]
        if ctx.load_pct and ctx.load_pct > 100:
            ev.append({"feature": "load_pct", "value": round(ctx.load_pct, 1), "note": "quá tải"})
        add("winding_overheat", 0.6 + (0.1 if len(ev) > 1 else 0), ev)

    # --- Compressor mesh wear (Beer HN: mesh amplitude growing vs baseline) ---
    mesh = max((_get(features, "axes", a, "mesh_mm_s") for a in ("x", "y", "z")), default=0.0)
    if mesh and ctx.mesh_baseline_mm_s and mesh > p["mesh_growth_ratio"] * ctx.mesh_baseline_mm_s:
        add("compressor_mesh_wear", 0.4 + min(0.3, 0.1 * (mesh / ctx.mesh_baseline_mm_s - p["mesh_growth_ratio"])),
            [{"feature": "mesh_mm_s", "value": round(mesh, 3), "ref": round(ctx.mesh_baseline_mm_s, 3),
              "note": "biên độ tại f_mesh tăng so với baseline"}])

    # --- Resonance (vertical pumps): large single-direction radial not at an order ---
    if len(radial) >= 2 and iso_r > 0:
        r2 = [a for a in radial if a != r_axis][0]
        other = _get(features, "axes", r2, "iso_vrms_mm_s")
        orders_energy = math.sqrt(sum(v * v for v in o_r.values()))
        if other < 0.4 * iso_r and orders_energy < p["resonance_ratio"] * iso_r:
            add("resonance", 0.35, [{"feature": f"{r_axis}.iso_vrms_mm_s", "value": round(iso_r, 3), "ref": round(other, 3),
                                     "note": "biên độ lớn ở một phương ngang, không trùng bậc"}])

    if not cands and (ctx.anomaly_score or 0) > 0.7:
        add("unknown", 0.3, [{"feature": "anomaly_score", "value": round(ctx.anomaly_score, 2), "note": "điểm bất thường cao"}])

    # Zone-based scaling: diagnosis is most meaningful at zone B+ (Beer HN slide 15).
    if ctx.iso_zone in ("A", None):
        for c in cands:
            if c["fault"] not in ("winding_overheat", "bearing_outer", "bearing_inner", "bearing_ball", "bearing_cage"):
                c["confidence"] = round(c["confidence"] * 0.6, 2)
    cands.sort(key=lambda c: c["confidence"], reverse=True)
    return cands


def to_diagnosis(cands: list[dict]) -> dict | None:
    if not cands:
        return None
    top = cands[0]
    return {"fault": top["fault"], "label": top["label"], "confidence": top["confidence"], "evidence": top["evidence"],
            "recommendation": top["recommendation"], "rules_version": RULES_VERSION,
            "alternatives": [{"fault": c["fault"], "label": c["label"], "confidence": c["confidence"]} for c in cands[1:4]]}
