"""One-command submission package builder for NexaSphere.

Orchestrates every submission artifact into the gitignored ``submission/``
folder at the repo root:

  1. submission/ directory scaffolding (+ screenshots/)
  2. submission/DEMO_SCRIPT.md          - 2:30 timed pitch (written if missing)
  3. PDF / DOCX / PPTX one-page summaries (via scripts/generate_project_summaries)
  4. screenshots/*.png + demo_video.mp4  (via submission/record_demo.py, Playwright)
  5. screenshots/08_pytest_green.png     - real pytest run rendered as an image
                                           (only with --with-tests)

Prerequisites: backend on :5050, frontend on :3030, and
``pip install playwright imageio-ffmpeg && python -m playwright install chromium``

Usage:
  python scripts/prepare_submission.py               # refresh everything (no test shot)
  python scripts/prepare_submission.py --with-tests  # also capture the pytest run
"""
import argparse
import importlib.util
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "submission"
SHOTS = SUBMISSION / "screenshots"
BACKEND_DIR = ROOT / "backend"

EXPECTED_SHOTS = [
    "01_executive_dashboard.png",
    "02_regional_revenue_chart.png",
    "03_return_rates_analysis.png",
    "04_marketing_roi_donut_chart.png",
    "05_performance_drilldown.png",
    "06_mobile_dashboard.png",
    "07_mobile_assistant_chips.png",
    "08_mobile_answer.png",
]


def log(msg: str) -> None:
    print(f"[prepare] {msg}", flush=True)


def scaffold() -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    log(f"submission directory ready at {SUBMISSION}")


def write_demo_script() -> None:
    target = SUBMISSION / "DEMO_SCRIPT.md"
    if target.exists():
        log("DEMO_SCRIPT.md already present - leaving untouched")
        return
    src = ROOT / "scripts" / "DEMO_SCRIPT_TEMPLATE.md"
    if src.exists():
        target.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        sys.exit("DEMO_SCRIPT.md missing and no template found at scripts/DEMO_SCRIPT_TEMPLATE.md")
    log("DEMO_SCRIPT.md written")


def generate_summaries() -> None:
    spec = importlib.util.spec_from_file_location(
        "generate_project_summaries", ROOT / "scripts" / "generate_project_summaries.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.generate_pdf()
    mod.generate_docx()
    mod.generate_pptx()


def capture_media() -> None:
    log("launching Playwright capture (screenshots + demo video)...")
    subprocess.run(
        [sys.executable, str(SUBMISSION / "record_demo.py")],
        check=True, cwd=str(ROOT),
    )


def render_pytest_shot() -> None:
    """Run the real test suite and render its actual output as a PNG."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        log("Pillow not installed - skipping 08_pytest_green.png "
            "(pip install pillow to enable)")
        return

    log("running pytest for the terminal capture (this takes a few minutes)...")
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q"],
        cwd=str(BACKEND_DIR), capture_output=True, text=True, encoding="utf-8",
        errors="replace",
    )
    lines = (proc.stdout or "").strip().splitlines()[-14:]
    lines = [f"$ cd backend && pytest -q"] + lines
    ok = proc.returncode == 0 and any("passed" in ln for ln in lines)
    if not ok:
        sys.exit("pytest did not pass - fix tests before submitting")

    width, line_h, pad = 1180, 26, 28
    img = Image.new("RGB", (width, pad * 2 + line_h * len(lines)), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("consola.ttf", 17)
        title_font = ImageFont.truetype("consolab.ttf", 17)
    except OSError:
        font = ImageFont.load_default()
        title_font = font
    y = pad
    for ln in lines:
        color = "#4ADE80" if "passed" in ln else "#E2E8F0"
        draw.text((pad, y), ln, fill=color, font=title_font if ln.startswith("$") else font)
        y += line_h
    out = SHOTS / "08_pytest_green.png"
    img.save(out)
    log(f"rendered real pytest output -> screenshots/{out.name}")


def write_manifest() -> None:
    rows = ["# Submission Manifest", "",
            f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", ""]
    for path in sorted(SUBMISSION.rglob("*")):
        if path.is_file() and path.name != "MANIFEST.md":
            size = path.stat().st_size
            pretty = f"{size / 1e6:.1f} MB" if size > 1e6 else f"{size / 1024:.0f} KB"
            rows.append(f"- `{path.relative_to(SUBMISSION).as_posix()}` ({pretty})")
    (SUBMISSION / "MANIFEST.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    log("MANIFEST.md written")


def verify() -> None:
    problems = []
    for name in ("DEMO_SCRIPT.md", "record_demo.py", "demo_video.mp4",
                 "NexaSphere_Project_Summary.pdf",
                 "NexaSphere_Project_Summary.docx",
                 "NexaSphere_Project_Summary.pptx"):
        p = SUBMISSION / name
        if not p.is_file() or p.stat().st_size < 200:
            problems.append(f"missing/too small: {name}")
    video = SUBMISSION / "demo_video.mp4"
    with open(video, "rb") as fh:
        if fh.read(12)[4:8] != b"ftyp":
            problems.append("demo_video.mp4 is not a valid MP4 container")
    for shot in EXPECTED_SHOTS:
        p = SHOTS / shot
        if not p.is_file() or p.stat().st_size < 5_000:
            problems.append(f"missing/small screenshot: {shot}")
    if problems:
        sys.exit("VERIFY FAILED:\n  " + "\n  ".join(problems))
    log("verification passed: script, video (valid mp4), 8 screenshots, 3 summaries")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the NexaSphere submission package")
    parser.add_argument("--with-tests", action="store_true",
                        help="also run pytest and capture the green terminal output")
    parser.add_argument("--skip-media", action="store_true",
                        help="skip the Playwright capture (keep existing screenshots/video)")
    args = parser.parse_args()

    scaffold()
    write_demo_script()
    generate_summaries()
    if not args.skip_media:
        capture_media()
    if args.with_tests:
        render_pytest_shot()
    write_manifest()
    verify()
    print("\nSubmission package ready for upload:")
    for f in sorted(p.name for p in SUBMISSION.iterdir()):
        print(f"  submission/{f}")


if __name__ == "__main__":
    main()
