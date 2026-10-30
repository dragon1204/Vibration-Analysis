"""Customer-defined screening rules; matches are observations, not fault diagnoses."""
from pydantic import BaseModel, Field, ConfigDict, model_validator


class CustomerRule(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    order: int = Field(ge=1, le=30)
    min_count: int = Field(default=1, ge=1, le=500)
    occurrence_pct: float = Field(default=50, ge=0, le=100)
    relative_pct: float = Field(default=0, ge=0, le=10000)


class CustomerRules(BaseModel):
    rules: list[CustomerRule] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def unique_codes(self):
        codes = [r.code.casefold() for r in self.rules]
        if len(codes) != len(set(codes)):
            raise ValueError("Mã lỗi không được trùng nhau")
        return self


def evaluate_rules(rules, details):
    results = []
    for raw in rules:
        rule = CustomerRule.model_validate(raw)
        rows = [r for r in details if r["order"] == rule.order]
        found = [r for r in rows if r.get("detected") and
                 (rule.relative_pct == 0 or (r.get("relative_to_1x_pct") is not None and
                                             r["relative_to_1x_pct"] >= rule.relative_pct))]
        occurrence = len(found) / len(rows) * 100 if rows else 0
        results.append({**rule.model_dump(), "count": len(found), "captures": len(rows),
                        "actual_pct": round(occurrence, 1),
                        "status": "no_data" if not rows else "matched" if len(found) >= rule.min_count and
                        occurrence >= rule.occurrence_pct else "not_matched"})
    return results
