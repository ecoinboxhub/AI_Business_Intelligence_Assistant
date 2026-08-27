"""Build 2:30 demo video with captions using ffmpeg."""
import os
import subprocess
import shutil
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "submission"
SHOTS = OUT / "screenshots"
LIVE_WEB = "https://ecoinboxhub.github.io/AI_Business_Intelligence_Assistant/"

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG = shutil.which("ffmpeg")

AUDIO_DIR = Path("C:/Users/ibrah/AppData/Local/Temp/nexa_audio2")

SEGMENTS = [
    {"caption": "THE PROBLEM: Manual BI + AI Hallucinations = Delayed Decisions", "shot": "01_executive_dashboard.png"},
    {"caption": "SOLUTION: Pandas Computes All Numbers - AI Only Narrates", "shot": "01_executive_dashboard.png"},
    {"caption": "9 CORE QUERIES: Revenue, Returns, ROI, Inventory & More", "shot": "02_regional_revenue_chart.png"},
    {"caption": "LIVE DEMO: Regional Revenue Analysis with Dynamic Charts", "shot": "02_regional_revenue_chart.png"},
    {"caption": "ANOMALY DETECTION: Risk Scoring + Automated Recommendations", "shot": "03_return_rates_analysis.png"},
    {"caption": "CAMPAIGN ROI: Ranking + Funnel Visualisation + What-If", "shot": "04_marketing_roi_donut_chart.png"},
    {"caption": "DRILL-DOWN: All 9 Dimensions with CSV Export", "shot": "05_performance_drilldown.png"},
    {"caption": "MOBILE: Same Engine, Quick-Question Chips, Instant Answers", "shot": "06_mobile_dashboard.png"},
    {"caption": "MOBILE ASSISTANT: AI Chips + Structured Answers", "shot": "07_mobile_assistant_chips.png"},
    {"caption": "INNOVATION: What-If Simulation + DuckDB + Proactive Insights", "shot": "08_mobile_answer.png"},
    {"caption": "TESTED: 60+ Automated Accuracy Tests | 80% Latency Reduction", "shot": "08_pytest_green.png"},
    {"caption": "NexaSphere: Decision Intelligence, Perfected", "shot": "01_executive_dashboard.png"},
]

DURATIONS = [18, 12, 12, 13, 13, 13, 11, 13, 11, 13, 10, 11]  # = 150s = 2:30
assert sum(DURATIONS) == 150

def main():
    tmp = Path(tempfile.mkdtemp(prefix="nexa_vid_"))
    frame_dir = tmp / "frames"
    frame_dir.mkdir()

    try:
        font_big = ImageFont.truetype("arial.ttf", 32)
        font_cap = ImageFont.truetype("arial.ttf", 24)
        font_small = ImageFont.truetype("arial.ttf", 18)
        font_link = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        font_big = font_cap = font_small = font_link = ImageFont.load_default()

    # Create frames
    print("[1/3] Creating captioned frames...")
    for i, seg in enumerate(SEGMENTS):
        shot = SHOTS / seg["shot"]
        img = Image.open(shot).convert("RGB").resize((1920, 1080), Image.LANCZOS)
        img_rgba = img.convert("RGBA")

        # Top bar
        top_bar = Image.new("RGBA", (1920, 60), (15, 23, 42, 220))
        img_rgba.paste(top_bar, (0, 0), top_bar)

        # Bottom caption bar
        bot_bar = Image.new("RGBA", (1920, 140), (15, 23, 42, 230))
        img_rgba.paste(bot_bar, (0, 940), bot_bar)
        img = img_rgba.convert("RGB")
        draw = ImageDraw.Draw(img)

        # Top branding
        draw.text((30, 15), "NexaSphere AI BI Assistant", fill=(79, 70, 229), font=font_big)
        draw.text((1450, 20), "Case Study 4 Solution", fill=(148, 163, 184), font=font_small)

        # Caption
        caption = seg["caption"]
        if len(caption) > 60:
            caption = caption[:57] + "..."
        draw.text((40, 960), caption, fill=(255, 255, 255), font=font_cap)

        # Deployed link
        draw.text((40, 1000), "Live: " + LIVE_WEB, fill=(14, 165, 233), font=font_link)

        # Segment counter
        draw.text((1750, 1010), f"{i+1}/{len(SEGMENTS)}", fill=(148, 163, 184), font=font_small)

        # Progress bar
        progress = (i + 1) / len(SEGMENTS)
        bar_y = 1045
        draw.rectangle([(40, bar_y), (1880, bar_y + 6)], fill=(51, 65, 85))
        draw.rectangle([(40, bar_y), (40 + int(1840 * progress), bar_y + 6)], fill=(79, 70, 229))

        img.save(str(frame_dir / f"frame_{i:02d}.png"))
        print(f"  frame {i+1}/{len(SEGMENTS)}")

    # Build segment videos
    print("[2/3] Building segment videos...")
    seg_vids = []
    for i in range(len(SEGMENTS)):
        audio_file = AUDIO_DIR / f"seg_{i:02d}.mp3"
        frame_file = frame_dir / f"frame_{i:02d}.png"
        seg_out = tmp / f"seg_{i:02d}.mp4"
        dur = DURATIONS[i]

        subprocess.run([
            FFMPEG, "-y",
            "-loop", "1", "-i", str(frame_file),
            "-i", str(audio_file),
            "-c:v", "libx264", "-t", str(dur),
            "-pix_fmt", "yuv420p", "-vf", "scale=1920:1080",
            "-c:a", "aac", "-b:a", "128k",
            "-shortest", "-movflags", "+faststart",
            str(seg_out)
        ], capture_output=True, check=True)
        seg_vids.append(seg_out)
        print(f"  segment {i+1}/{len(SEGMENTS)} ({dur}s)")

    # Concatenate
    print("[3/3] Concatenating final video...")
    concat_file = tmp / "concat.txt"
    with open(concat_file, "w") as f:
        for v in seg_vids:
            f.write(f"file '{v}'\n")

    output = str(OUT / "NexaSphere_Demo_Video.mp4")
    subprocess.run([
        FFMPEG, "-y",
        "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-c:v", "libx264", "-c:a", "aac",
        "-movflags", "+faststart",
        output
    ], capture_output=True, check=True)

    shutil.rmtree(tmp, ignore_errors=True)

    sz = os.path.getsize(output) / (1024 * 1024)
    print(f"\nDONE: {output} ({sz:.1f} MB, 150s = 2:30)")

if __name__ == "__main__":
    main()
