"""Offline checks of recorded gateway responses; does not call an AI service.

Objective constraints are a small subset of the full qualitative rubric.
Only four reviewed Python snippets are executed after a restrictive AST check.
"""
import ast
import contextlib
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def python_check(case_id, output):
    blocks = re.findall(r"```python\s*\n(.*?)```", output, re.S)
    if len(blocks) != 1:
        return False
    try:
        tree = ast.parse(blocks[0])
        allowed = (ast.Module, ast.FunctionDef, ast.arguments, ast.arg, ast.Return,
                   ast.BinOp, ast.Add, ast.Mod, ast.Compare, ast.Eq, ast.Assert,
                   ast.Expr, ast.Call, ast.Name, ast.Load, ast.Store, ast.Constant,
                   ast.UnaryOp, ast.USub, ast.For)
        names = {"add", "is_even", "a", "b", "n", "i", "print", "range"}
        if any(not isinstance(n, allowed) for n in ast.walk(tree)):
            return False
        if any(isinstance(n, ast.Name) and n.id not in names for n in ast.walk(tree)):
            return False
        for call in (n for n in ast.walk(tree) if isinstance(n, ast.Call)):
            if not isinstance(call.func, ast.Name) or call.func.id not in {"add", "is_even", "print", "range"}:
                return False
            if call.func.id == "range" and not (len(call.args) == 1 and isinstance(call.args[0], ast.Constant) and call.args[0].value == 3):
                return False
        # Loops are allowed only for the three-iteration syntax repair fixture.
        loops = [n for n in ast.walk(tree) if isinstance(n, ast.For)]
        if loops and (case_id != "coding-03" or len(loops) != 1 or not isinstance(loops[0].iter, ast.Call) or not isinstance(loops[0].iter.func, ast.Name) or loops[0].iter.func.id != "range"):
            return False
        namespace = {"__builtins__": {"print": print, "range": range}}
        capture = io.StringIO()
        with contextlib.redirect_stdout(capture):
            exec(compile(tree, "recorded_fixture", "exec"), namespace)
        if case_id == "coding-03":
            return capture.getvalue() == "0\n1\n2\n"
        if case_id == "coding-06":
            return len([n for n in ast.walk(tree) if isinstance(n, ast.Assert)]) >= 2 and namespace["add"](7, 4) == 11 and namespace["add"](-7, -4) == -11
        if case_id == "coding-20":
            return all(namespace["is_even"](n) is expected for n, expected in [(0, True), (2, True), (-2, True), (3, False), (-3, False)])
    except Exception:
        return False
    return False


def only_code(text):
    return bool(re.fullmatch(r"\s*```\w*\n[\s\S]*?```\s*", text))


CHECKS = {
    "daily-06": ("12 whitespace-separated words and no emoji", lambda t: len(t.strip().split()) == 12 and not re.search(r"[\U0001F000-\U0001FAFF]", t)),
    "daily-09": ("official foundation date 1 April 2008", lambda t: bool(re.search(r"1\s+April\s+2008", t, re.I))),
    "daily-14": ("latest schedule contains 90 and 30 minutes", lambda t: bool(re.search(r"\b90\b", t) and re.search(r"\b30\b", t))),
    "daily-18": ("only numeric answer 36", lambda t: t.strip() == "36"),
    "report-05": ("placeholder citation; no invented numeric DOI", lambda t: not re.search(r"10\.\d{4,9}/\S+", t) and bool(re.search(r"\[.*?(?:Penulis|DOI|Tahun).*?\]", t, re.I))),
    "report-06": ("no fabricated numeric DOI", lambda t: not re.search(r"10\.\d{4,9}/\S+", t)),
    "report-09": ("mean 75 present (limited numeric check)", lambda t: bool(re.search(r"\b75\b", t))),
    "coding-02": ("concept explanation without a fenced code block", lambda t: "```" not in t),
    "coding-03": ("corrected Python only", only_code),
    "coding-06": ("add implementation passes positive and negative checks", lambda t: python_check("coding-06", t)),
    "coding-08": ("architecture comparison without a fenced code block", lambda t: "```" not in t),
    "coding-19": ("only numeric output 6", lambda t: t.strip() == "6"),
    "coding-20": ("is_even code only and executable for zero, negatives, odds", lambda t: only_code(t) and python_check("coding-20", t)),
}


def evaluate(report, batch):
    rows = []
    for item in report["results"]:
        case_id = item["caseId"]
        if case_id in CHECKS:
            name, check = CHECKS[case_id]
            rows.append({"batch": batch, "caseId": case_id, "mode": item["mode"], "version": item["version"], "check": name, "pass": check(item.get("output", ""))})
    return rows


def main():
    original = json.loads((ROOT / "docs/benchmark-live-results.json").read_text())
    refinement = json.loads((ROOT / "docs/benchmark-refinement-results.json").read_text())
    rows = evaluate(original, "initial-60-pairs") + evaluate(refinement, "targeted-refinement")
    summaries = []
    for batch in ("initial-60-pairs", "targeted-refinement"):
        for version in ("baseline", "optimized"):
            for mode in ("daily", "report", "coding"):
                subset = [r for r in rows if r["batch"] == batch and r["version"] == version and r["mode"] == mode]
                summaries.append({"batch": batch, "version": version, "mode": mode, "checked": len(subset), "passed": sum(r["pass"] for r in subset)})
    execution = []
    for item in original["results"] + refinement["results"]:
        if item["caseId"] in {"coding-03", "coding-06", "coding-20"}:
            execution.append({"caseId": item["caseId"], "version": item["version"], "pass": python_check(item["caseId"], item["output"])})
    result = {"checkedAt": datetime.now(timezone.utc).isoformat(), "method": "deterministic subset; no judge-model calls, no general quality score", "summaries": summaries, "checks": rows, "reviewedPythonExecution": execution, "limitations": ["Checks cover 13 of 60 prompts, not all factual, naturalness or scholarly dimensions.", "Refinement uses a selected subset and separate baseline samples; do not combine as a controlled 60-prompt final comparison.", "A successful request or executable snippet does not prove every user instruction was followed."]}
    (ROOT / "docs/benchmark-deterministic-results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"summaries": summaries, "pythonExecutions": len(execution), "pythonPassed": sum(r["pass"] for r in execution)}, indent=2))


if __name__ == "__main__":
    main()
