"""Build 2-min demo video using ffmpeg directly (fast)."""
import os
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "submission"
SHOTS = OUT / "screenshots"
DEPLOYED_WEB = "https://ecoinboxhub.github.io/AI_Business_Intelligence_Assistant/"

FFMPEG = "C:/Users/ibrah/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
AUDIO_DIR = Path("C:/Users/ibrah/AppData/Local/Temp/nexasphere_audio")
FRAME_DIR = Path("C:/Users/ibrah/AppData/Local/Temp/nexasphere_frames")
FRAME_DIR.mkdir(exist_ok=True)

# Segment durations in seconds (matched to audio files)
SEG_DURATIONS = [18, 16, 14, 14, 13, 12, 14, 10, 9]

SHOTS_LIST = [
    "01_executive_dashboard.png",
    "01_executive_dashboard.png",
    "02_regional_revenue_chart.png",
    "03_return_rates_analysis.png",
    "04_marketing_roi_donut_chart.png",
    "05_performance_drilldown.png",
    "06_mobile_dashboard.png",
    "07_mobile_assistant_chips.png",
    "08_mobile_answer.png",
]

def main():
    # 1. Create frames
    print("[1/3] Creating frames...")
    try:
        font_title = ImageFont.truetype("arial.ttf", 28)
        font_small = ImageFont.truetype("arial.ttf", 18)
    except OSError:
        font_title = ImageFont.load_default()
        font_small = font_title

    for i in range(9):
        shot = SHOTS / SHOTS_LIST[i]
        img = Image.open(shot).convert("RGB").resize((1920, 1080), Image.LANCZOS)
        overlay = Image.new("RGBA", (1920, 120), (15, 23, 42, 200))
        img_rgba = img.convert("RGBA")
        img_rgba.paste(overlay, (0, 960), overlay)
        img = img_rgba.convert("RGB")
        draw = ImageDraw.Draw(img)
        draw.text((40, 975), "NexaSphere AI BI Assistant", fill=(79, 70, 229), font=font_title)
        draw.text((40, 1015), "Live: " + DEPLOYED_WEB, fill=(14, 165, 233), font=font_small)
        draw.text((1600, 990), f"{i+1}/9", fill=(148, 163, 184), font=font_small)
        img.save(str(FRAME_DIR / f"frame_{i:02d}.png"))
        print(f"  frame {i+1}/9")

    # 2. Create individual segment videos
    print("[2/3] Creating segment videos...")
    seg_videos = []
    for i in range(9):
        audio_path = AUDIO_DIR / f"seg_{i:02d}.mp3"
        frame_path = FRAME_DIR / f"frame_{i:02d}.png"
        seg_out = FRAME_DIR / f"seg_{i:02d}.mp4"
        dur = SEG_DURATIONS[i]

        subprocess.run([
            FFMPEG, "-y",
            "-loop", "1", "-i", str(frame_path),
            "-i", str(audio_path),
            "-c:v", "libx264", "-t", str(dur),
            "-pix_fmt", "yuv420p", "-vf", "scale=1920:1080",
            "-c:a", "aac", "-b:a", "128k",
            "-shortest", "-movflags", "+faststart",
            str(seg_out)
        ], capture_output=True, check=True)
        seg_videos.append(seg_out)
        print(f"  segment {i+1}/9 ({dur}s)")

    # 3. Concatenate all segments
    print("[3/3] Concatenating...")
    concat_file = FRAME_DIR / "concat.txt"
    with open(concat_file, "w") as f:
        for v in seg_videos:
            f.write(f"file '{v}'\n")

    output = str(OUT / "NexaSphere_Demo_Video.mp4")
    subprocess.run([
        FFMPEG, "-y",
        "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-c:v", "libx264", "-c:a", "aac",
        "-movflags", "+faststart",
        output
    ], capture_output=True, check=True)

    sz = os.path.getsize(output) / (1024 * 1024)
    total_dur = sum(SEG_DURATIONS)
    print(f"\nDONE: {output}")
    print(f"  Size: {sz:.1f} MB")
    print(f"  Duration: {total_dur}s")

if __name__ == "__main__":
    main()
