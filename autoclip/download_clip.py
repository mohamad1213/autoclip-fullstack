"""
Script Pengunduh & Pemotong Klip Video MP4 Nyata dari YouTube
Menggunakan yt-dlp untuk memotong video sesuai timestamp
"""
import sys
import subprocess
import os
import json

def download_clip(clip_index=1):
    json_path = os.path.join(os.path.dirname(__file__), "authentic_clips.json")
    if not os.path.exists(json_path):
        print("File authentic_clips.json tidak ditemukan!")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        clips = json.load(f)

    if clip_index < 1 or clip_index > len(clips):
        print(f"Pilihan klip salah. Pilih antara 1 sampai {len(clips)}.")
        return

    clip = clips[clip_index - 1]
    yt_id = clip.get("youtubeId", "LqVxhu1khJg")
    url = f"https://www.youtube.com/watch?v={yt_id}"
    start_time = clip["timestampStart"]
    end_time = clip["timestampEnd"]
    
    clean_title = "".join(c for c in clip["title"] if c.isalnum() or c in (' ', '_', '-')).strip()
    output_filename = f"Klip_{clip_index}_{clean_title[:30].replace(' ', '_')}.mp4"

    print(f"\n=======================================================")
    print(f"Mengunduh Klip #{clip_index}: {clip['title']}")
    print(f"Rentang Waktu: {start_time} - {end_time}")
    print(f"Output File: {output_filename}")
    print(f"=======================================================\n")

    cmd = [
        sys.executable, "-m", "yt_dlp",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--download-sections", f"*{start_time}-{end_time}",
        "--force-keyframes-at-cuts",
        "-o", output_filename,
        url
    ]

    try:
        subprocess.run(cmd, check=True)
        print(f"\n[SUKSES] Berkas video MP4 berhasil diunduh: {output_filename}")
    except Exception as e:
        print(f"\n[INFO] Jika ffmpeg belum terinstal, Anda dapat mengunduh video utuh dengan format 720p/1080p.")
        print(f"Error detail: {e}")

if __name__ == "__main__":
    idx = 1
    if len(sys.argv) > 1:
        try:
            idx = int(sys.argv[1])
        except ValueError:
            idx = 1
    download_clip(idx)
