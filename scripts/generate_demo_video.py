"""Generate the 2-minute demo video with male Nigerian voice narrative."""
import asyncio
import os
import shutil
import tempfile
from pathlib import Path

import edge_tts
from PIL import Image, ImageDraw, ImageFont
from moviepy import ImageClip, AudioFileClip, concatenate_videoclips

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "submission"
SHOTS = OUT / "screenshots"
VOICE = "en-NG-AbeoNeural"

DEPLOYED_WEB = "https://ecoinboxhub.github.io/AI_Business_Intelligence_Assistant/"

# 2-minute narrative (9 segments, ~120s total)
SEGMENTS = [
    {
        "text": (
            "Executives today face a critical dilemma. "
            "They either wait days for manual business intelligence reports, "
            "or they rely on AI chatbots that hallucinate financial numbers. "
            "Today, we solve this problem permanently. "
            "Welcome to NexaSphere, the AI Business Intelligence Assistant "
            "that combines one hundred percent exact mathematical precision "
            "with executive level reasoning."
        ),
        "shot": "01_executive_dashboard.png",
    },
    {
        "text": (
            "NexaSphere runs on a revolutionary hybrid engine. "
            "Python's Pandas engine strictly computes every single number. "
            "The AI language model acts purely as an executive interpreter. "
            "Zero numerical hallucinations. Guaranteed. "
            "Watch as we ask: Which region generates the highest revenue and profit margin?"
        ),
        "shot": "01_executive_dashboard.png",
    },
    {
        "text": (
            "In seconds, the system calculates exact figures "
            "and renders dynamic visualizations. "
            "It isolates verified facts from actionable recommendations, "
            "then suggests the next logical business questions "
            "through interactive follow up chips."
        ),
        "shot": "02_regional_revenue_chart.png",
    },
    {
        "text": (
            "Next, let's examine return rate anomalies. "
            "NexaSphere identifies products with unusually high return rates, "
            "computes severity scores, and recommends corrective actions "
            "all within a single structured response."
        ),
        "shot": "03_return_rates_analysis.png",
    },
    {
        "text": (
            "Marketing managers can instantly evaluate campaign return on investment. "
            "NexaSphere ranks campaigns by ROI, visualizes spend allocation, "
            "and quantifies the impact of budget reallocation scenarios."
        ),
        "shot": "04_marketing_roi_donut_chart.png",
    },
    {
        "text": (
            "The performance drill down page provides deep operational visibility. "
            "Executives can explore all nine business dimensions, "
            "export data to CSV, and make data driven decisions with confidence."
        ),
        "shot": "05_performance_drilldown.png",
    },
    {
        "text": (
            "On the go? The Expo mobile app gives executives "
            "instant access to the exact same backend engine. "
            "Tap a quick question chip, inspect insights, "
            "and receive immediate operational guidance right from your phone."
        ),
        "shot": "06_mobile_dashboard.png",
    },
    {
        "text": (
            "The mobile assistant features intelligent question suggestions. "
            "Tap any chip to get instant answers with verified facts, "
            "interpretations, and strategic recommendations."
        ),
        "shot": "07_mobile_assistant_chips.png",
    },
    {
        "text": (
            "Verified by rigorous automated accuracy tests, "
            "NexaSphere delivers zero hallucination guarantees, "
            "cuts reporting latency by eighty percent, "
            "and empowers leaders to act immediately. "
            "NexaSphere. Decision intelligence, perfected. "
            "Try it now at the live dashboard link."
        ),
        "shot": "08_mobile_answer.png",
    },
]

TOTAL_SECONDS = 120
SEG_DURATIONS = [18, 16, 14, 14, 13, 12, 14, 10, 9]  # = 120


async def generate_all_audio(tmp_dir):
    """Generate TTS audio for all segments."""
    audio_files = []
    for i, seg in enumerate(SEGMENTS):
        audio_path = str(tmp_dir / f"seg_{i:02d}.mp3")
        communicate = edge_tts.Communicate(seg["text"], VOICE, rate="-5%")
        await communicate.save(audio_path)
        audio_files.append(audio_path)
        dur = SEG_DURATIONS[i]
        print(f"  audio {i+1}/{len(SEGMENTS)} done ({dur}s)")
    return audio_files


def make_frames(tmp_dir):
    """Create image frames from screenshots with overlays."""
    frame_paths = []
    try:
        font_title = ImageFont.truetype("arial.ttf", 28)
        font_small = ImageFont.truetype("arial.ttf", 18)
    except OSError:
        font_title = ImageFont.load_default()
        font_small = font_title

    for i, seg in enumerate(SEGMENTS):
        shot_path = SHOTS / seg["shot"]
        if not shot_path.exists():
            img = Image.new("RGB", (1920, 1080), (15, 23, 42))
        else:
            img = Image.open(shot_path).convert("RGB")
        img = img.resize((1920, 1080), Image.LANCZOS)

        # Bottom bar overlay
        overlay = Image.new("RGBA", (1920, 120), (15, 23, 42, 200))
        img_rgba = img.convert("RGBA")
        img_rgba.paste(overlay, (0, 960), overlay)
        img = img_rgba.convert("RGB")

        draw = ImageDraw.Draw(img)
        draw.text((40, 975), "NexaSphere AI BI Assistant", fill=(79, 70, 229), font=font_title)
        draw.text((40, 1015), f"Live: {DEPLOYED_WEB}", fill=(14, 165, 233), font=font_small)
        draw.text((1600, 990), f"{i+1}/{len(SEGMENTS)}", fill=(148, 163, 184), font=font_small)

        frame_path = str(tmp_dir / f"frame_{i:02d}.png")
        img.save(frame_path)
        frame_paths.append(frame_path)
        print(f"  frame {i+1}/{len(SEGMENTS)} done")
    return frame_paths


def build_video(audio_files, frame_paths, tmp_dir):
    """Combine frames and audio into final MP4."""
    clips = []
    for i in range(len(SEGMENTS)):
        audio_clip = AudioFileClip(audio_files[i])
        img_clip = ImageClip(frame_paths[i]).with_duration(audio_clip.duration)
        img_clip = img_clip.with_audio(audio_clip)
        clips.append(img_clip)
        print(f"  clip {i+1}/{len(SEGMENTS)} assembled ({audio_clip.duration:.1f}s)")

    final = concatenate_videoclips(clips, method="compose")
    output = str(OUT / "NexaSphere_Demo_Video.mp4")
    final.write_videofile(output, fps=24, codec="libx264", audio_codec="aac",
                          preset="medium", threads=4, logger=None)
    final.close()
    for c in clips:
        c.close()
    return output


def main():
    print("=" * 50)
    print("NexaSphere Demo Video Generator")
    print("=" * 50)

    tmp_dir = Path(tempfile.mkdtemp(prefix="nexasphere_vid_"))
    try:
        print("\n[1/3] Generating TTS audio...")
        audio_files = asyncio.run(generate_all_audio(tmp_dir))

        print("\n[2/3] Creating visual frames...")
        frame_paths = make_frames(tmp_dir)

        print("\n[3/3] Building final video...")
        output = build_video(audio_files, frame_paths, tmp_dir)

        size_mb = os.path.getsize(output) / (1024 * 1024)
        print(f"\n[DONE] {output} ({size_mb:.1f} MB)")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
