import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Scissors,
  Sparkles,
  Youtube,
  FileText,
  Settings,
  Play,
  Pause,
  Copy,
  Check,
  Edit3,
  Terminal,
  Sliders,
  Video,
  Loader2,
  Flame,
  Clock,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  Wand2,
  LayoutGrid,
  Trash2,
  ExternalLink,
  Plus,
  Key,
  Save,
  Maximize2,
  Crop,
  ThumbsUp,
  Calendar,
  Film,
  FileDown,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

import {
  extractYouTubeId,
  timeStringToSeconds,
  formatSecondsToTime,
  fetchYouTubeMetadata,
  generateClipsForSource,
  renderClipFromBackend
} from './videoService';

const DEFAULT_YOUTUBE_URL = 'https://www.youtube.com/watch?v=LqVxhu1khJg';

export default function App() {
  // State Navigasi Utama
  const [activeTab, setActiveTab] = useState('results');

  // State Sumber Video Aktif & Metadata Dinamis
  const [currentVideoDetails, setCurrentVideoDetails] = useState({
    id: 'LqVxhu1khJg',
    url: DEFAULT_YOUTUBE_URL,
    title: 'Memuat metadata video YouTube...',
    channel: 'YouTube',
    channelUrl: DEFAULT_YOUTUBE_URL,
    speakerName: 'YouTube',
    durationString: '00:00',
    durationSec: 600,
    thumbnail: 'https://i.ytimg.com/vi/LqVxhu1khJg/hqdefault.jpg',
    description: '',
    transcript: [],
    clips: null
  });
  const [youtubeUrl, setYoutubeUrl] = useState(DEFAULT_YOUTUBE_URL);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // State Pengaturan Pipeline Dinamis
  const [llmModel, setLlmModel] = useState('Gemini 2.5 Flash / Pro');
  const [transcriptLang, setTranscriptLang] = useState('Indonesia');
  const [targetClipCount, setTargetClipCount] = useState(4);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [autoSubtitle, setAutoSubtitle] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState('Hormozi Style');

  // Mode Framing Tampilan Video Klip: 'reframe-916' vs 'original-169'
  const [videoCropMode, setVideoCropMode] = useState('reframe-916');

  // Tampilkan / Sembunyikan Panel Detail Informasi Video Sumber
  const [showVideoInfoPanel, setShowVideoInfoPanel] = useState(true);

  // State Simulasi Pipeline 6 Tahap
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const [stageProgress, setStageProgress] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState([
    '[SYSTEM] AutoClip Engine siap memproses video secara dinamis.'
  ]);
  const terminalEndRef = useRef(null);

  // State Galeri Hasil Klip
  const [clips, setClips] = useState([]);
  const [scoreFilter, setScoreFilter] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [playingClipId, setPlayingClipId] = useState(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingVideoId, setDownloadingVideoId] = useState(null);
  const [batchDownloading, setBatchDownloading] = useState(false);

  // State Modal Edit Klip, Modal Fullscreen Preview & Modal Tambah Klip Baru
  const [editingClip, setEditingClip] = useState(null);
  const [previewModalClip, setPreviewModalClip] = useState(null);
  const [showAddClipModal, setShowAddClipModal] = useState(false);
  const [newClipForm, setNewClipForm] = useState({
    title: '',
    timestampStart: '01:00',
    timestampEnd: '02:00',
    subtitleStyle: 'Hormozi Style',
    accentColor: '#facc15',
    caption: '',
    line1: '',
    line2: ''
  });

  // State Pengaturan API (diambil dari env, tanpa hardcoded secret)
  const [apiSettings, setApiSettings] = useState({
    geminiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    groqKey: import.meta.env.VITE_GROQ_API_KEY || '',
    openaiKey: '',
    deepseekKey: ''
  });

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Muat metadata & klip dinamis saat pertama kali dibuka
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoadingMetadata(true);
      try {
        const meta = await fetchYouTubeMetadata(DEFAULT_YOUTUBE_URL);
        if (!mounted) return;
        setCurrentVideoDetails(meta);
        const generated = await generateClipsForSource({
          videoDetails: meta,
          clipCount: targetClipCount,
          apiKey: apiSettings.geminiKey,
          subtitleStyle,
          aspectRatio,
          transcriptLang
        });
        if (!mounted) return;
        setClips(generated);
        setPlayingClipId(generated[0]?.id || null);
        setTerminalLogs((prev) => [
          ...prev,
          `[SOURCE] Video aktif: ${meta.title} (${meta.channel})`,
          `[READY] ${generated.length} klip dihasilkan secara dinamis.`
        ]);
      } catch (err) {
        if (!mounted) return;
        setTerminalLogs((prev) => [...prev, `[WARN] Gagal memuat awal: ${err.message}`]);
      } finally {
        if (mounted) setIsLoadingMetadata(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Helper format detik ke format SRT HH:MM:SS,mmm
  const formatSrtTime = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const totalMs = Math.round(safe * 1000);
    const ms = totalMs % 1000;
    const totalSec = Math.floor(totalMs / 1000);
    const s = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const m = totalMin % 60;
    const h = Math.floor(totalMin / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  // Timer simulasi subtitle dinamis saat video aktif diputar
  const activePlayingClip = previewModalClip || clips.find((c) => c.id === playingClipId);
  const maxPlaybackDuration = Math.max(10, activePlayingClip?.durationSec || 60);

  useEffect(() => {
    if (!playingClipId && !previewModalClip) return;
    const interval = setInterval(() => {
      setPlaybackTime((prev) => {
        if (prev >= maxPlaybackDuration) return 0;
        return Number((prev + 0.25).toFixed(2));
      });
    }, 250);
    return () => clearInterval(interval);
  }, [playingClipId, previewModalClip, maxPlaybackDuration]);

  // Handler Sinkronisasi URL YouTube Kustom
  const handleSyncVideoUrl = async (customUrl) => {
    const targetUrl = customUrl || youtubeUrl;
    const yId = extractYouTubeId(targetUrl);
    if (!yId) {
      showToast('Harap masukkan URL YouTube yang valid!');
      return;
    }
    setIsLoadingMetadata(true);
    showToast('Mengambil informasi video YouTube...');
    try {
      const meta = await fetchYouTubeMetadata(targetUrl);
      setCurrentVideoDetails(meta);
      setYoutubeUrl(targetUrl);

      const newClips = await generateClipsForSource({
        videoDetails: meta,
        clipCount: targetClipCount,
        apiKey: apiSettings.geminiKey,
        subtitleStyle,
        aspectRatio,
        transcriptLang
      });

      setClips(newClips);
      setPlayingClipId(newClips[0]?.id || null);
      setPlaybackTime(0);

      setTerminalLogs((prev) => [
        ...prev,
        `[FETCH] Metadata terambil untuk ID: ${meta.id}`,
        `[SOURCE] ${meta.title} (${meta.channel})`,
        `[AI] Menghasilkan ${newClips.length} klip secara dinamis.`
      ]);

      showToast(`Video tersinkron: ${meta.channel}`);
    } catch (err) {
      console.error(err);
      showToast('Gagal menyinkronkan video: ' + err.message);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  // Fallback render Canvas lokal jika API Render belum tersedia (menghasilkan durasi penuh & subtitle utuh)
  const fallbackCanvasRenderMP4 = async (clip) => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.005, audioCtx.currentTime);
    osc.connect(gainNode);
    gainNode.connect(dest);
    osc.start();

    const canvasStream = canvas.captureStream(30);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 2500000
    });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      try {
        osc.stop();
        audioCtx.close();
      } catch {}

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clip.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_preview.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadingVideoId(null);
      showToast(`Unduhan video (${clipDurationSec}s) selesai.`);
    };

    recorder.start();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    const ytId = clip.youtubeId || currentVideoDetails.id;
    img.src = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    // Durasi klip aktual (bukan 4 detik lagi!)
    const clipDurationSec = Math.max(
      5,
      Math.min(
        120,
        Number(clip.durationSec) ||
          Number(clip.endSec) - Number(clip.startSec) ||
          30
      )
    );
    const renderDuration = clipDurationSec * 1000;
    const startTime = Date.now();

    // Helper membungkus teks panjang agar tidak terpotong (Word Wrap)
    const drawWrappedCaption = (context, text, centerX, centerY, maxWidth, lineHeight) => {
      const words = (text || '').trim().split(/\s+/);
      if (words.length === 0) return;
      const lines = [];
      let currentLine = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = currentLine ? `${currentLine} ${words[n]}` : words[n];
        const metrics = context.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          lines.push(currentLine);
          currentLine = words[n];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const maxVisibleLines = 4;
      const displayLines = lines.slice(0, maxVisibleLines);
      const totalTextH = displayLines.length * lineHeight;
      const startY = centerY - totalTextH / 2 + lineHeight / 2;

      for (let k = 0; k < displayLines.length; k++) {
        context.fillText(displayLines[k], centerX, startY + k * lineHeight);
      }
    };

    const renderFrame = () => {
      const elapsed = Date.now() - startTime;
      const elapsedSec = elapsed / 1000;
      const progress = Math.min(1, elapsed / renderDuration);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1280);
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.5, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 720, 1280);

      // Gambar poster thumbnail di tengah vertikal
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(30, 140, 660, 800, 24);
        ctx.clip();
        ctx.drawImage(img, -180, 140, 1020, 800);
        ctx.restore();
      }

      // Ambil teks transkrip sesuai detik pemutaran aktual
      const transcriptList = clip.transcript || [];
      const currentSegment = transcriptList.find(
        (seg) => elapsedSec >= seg.start && elapsedSec < seg.end
      );
      const activeText =
        currentSegment?.text ||
        (transcriptList.length > 0
          ? transcriptList[
              Math.min(
                transcriptList.length - 1,
                Math.floor(progress * transcriptList.length)
              )
            ]?.text
          : clip.caption || clip.title);

      // Kotak kontainer Subtitle/Caption
      ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
      ctx.beginPath();
      ctx.roundRect(30, 980, 660, 220, 24);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      // Render Subtitle dengan Word Wrap
      ctx.fillStyle = clip.accentColor || '#facc15';
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawWrappedCaption(ctx, activeText, 360, 1090, 600, 34);

      // Indikator Progress Bar & Timer di atas
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(30, 50, 660, 8);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(30, 50, 660 * progress, 8);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${elapsedSec.toFixed(1)}s / ${clipDurationSec}s`, 35, 80);

      if (elapsed < renderDuration) {
        requestAnimationFrame(renderFrame);
      } else {
        recorder.stop();
      }
    };

    renderFrame();
  };

  // Handler Utama Render MP4 melalui Backend Render (dengan fallback lokal)
  const generateAndDownloadVideoMP4 = async (clip) => {
    setDownloadingVideoId(clip.id);
    const ytId = clip.youtubeId || currentVideoDetails.id;
    const videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
    const startSec = Number(clip.startSec ?? timeStringToSeconds(clip.timestampStart));
    const endSec = Number(clip.endSec ?? timeStringToSeconds(clip.timestampEnd));

    showToast(`Merender klip MP4 "${clip.title.slice(0, 24)}..." via server...`);

    try {
      const { downloadUrl, filename } = await renderClipFromBackend({
        url: videoUrl,
        start_sec: startSec,
        end_sec: Math.max(startSec + 2, endSec),
        title: clip.title,
        aspect_ratio: aspectRatio,
        caption: clip.caption,
        transcript: clip.transcript,
        subtitle_style: clip.subtitleStyle || subtitleStyle,
        accent_color: clip.accentColor || '#facc15',
        burn_subtitles: autoSubtitle,
      });

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

      setDownloadingVideoId(null);
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      } catch {}
      showToast(`Video MP4 "${filename}" berhasil diunduh!`);
    } catch (err) {
      console.warn('Render API error, menggunakan fallback lokal:', err);
      setTerminalLogs((prev) => [
        ...prev,
        `[API WARN] Render API server (${err.message}). Memakai fallback generator lokal dengan durasi penuh.`
      ]);
      await fallbackCanvasRenderMP4(clip);
    }
  };

  // Jalankan Pipeline Pemotongan Dinamis
  const startAutoClipPipeline = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setCurrentStageIndex(0);
    setStageProgress(0);

    const detectedYtId = extractYouTubeId(youtubeUrl) || currentVideoDetails.id;
    let activeMeta = currentVideoDetails;

    if (activeMeta.id !== detectedYtId) {
      try {
        activeMeta = await fetchYouTubeMetadata(youtubeUrl);
        setCurrentVideoDetails(activeMeta);
      } catch (err) {
        console.warn('Gagal fetch metadata di pipeline:', err);
      }
    }

    setTerminalLogs([
      `[INIT] Memulai pemotongan AutoClip dengan model ${llmModel}...`,
      `[SOURCE] Video YouTube: ${activeMeta.title}`,
      `[CHANNEL] Pembicara: ${activeMeta.channel}`,
      `[CONFIG] Target: ${targetClipCount} Klip | Durasi: ${activeMeta.durationString} | Subtitle: ${subtitleStyle}`
    ]);

    const pipelineSteps = [
      'Ekstraksi Audio & Metadata Video Sumber',
      'Segmentasi Topik & Analisis Durasi',
      'Scoring Viralitas Hook',
      'Copywriting Judul, Caption & Hashtag',
      'Reframe & Framing Klip',
      'Finalisasi Klip & Subtitle'
    ];

    for (let i = 0; i < pipelineSteps.length; i++) {
      setCurrentStageIndex(i);
      setStageProgress(0);
      setTerminalLogs((prev) => [...prev, `>>> TAHAP ${i + 1}/6: ${pipelineSteps[i]}...`]);

      for (let s = 1; s <= 5; s++) {
        await new Promise((r) => setTimeout(r, 180));
        setStageProgress(s * 20);
      }
    }

    const generatedClips = await generateClipsForSource({
      videoDetails: activeMeta,
      clipCount: targetClipCount,
      apiKey: apiSettings.geminiKey,
      subtitleStyle: autoSubtitle ? subtitleStyle : 'Minimalist',
      aspectRatio,
      transcriptLang
    });

    setClips(generatedClips);
    setIsProcessing(false);
    setTerminalLogs((prev) => [
      ...prev,
      `[DONE] Selesai! Berhasil memotong ${generatedClips.length} klip dari "${activeMeta.title.slice(0, 35)}...".`
    ]);

    try {
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
    } catch {}

    showToast(`Berhasil memotong ${generatedClips.length} klip!`);
    setActiveTab('results');
    setPlayingClipId(generatedClips[0]?.id || null);
    setPlaybackTime(0);
  };

  const togglePlayClip = (clipId) => {
    if (playingClipId === clipId) {
      setPlayingClipId(null);
    } else {
      setPlayingClipId(clipId);
      setPlaybackTime(0);
    }
  };

  const handleCopyCaption = (clip) => {
    const ytId = clip.youtubeId || currentVideoDetails.id;
    const ytTimestampLink = ytId ? `\n\nTonton bagian ini: https://youtu.be/${ytId}?t=${clip.startSec}s` : '';
    const tags = Array.isArray(clip.hashtags) ? clip.hashtags.join(' ') : '';
    const textToCopy = `${clip.title}\n\n${clip.caption}${ytTimestampLink}\n\n${tags}`.trim();
    navigator.clipboard?.writeText(textToCopy);
    setCopiedId(clip.id);
    showToast('Caption, link video, dan hashtag berhasil disalin!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadClip = (clip) => {
    setDownloadingId(clip.id);
    setTimeout(() => {
      const ytId = clip.youtubeId || currentVideoDetails.id;
      const lines = clip.transcript || [];
      const srtContent = lines
        .map(
          (line, i) =>
            `${i + 1}\n${formatSrtTime(line.start)} --> ${formatSrtTime(
              line.end || (line.start + 3)
            )}\n${line.text || ''}`
        )
        .join('\n\n');

      const content = `AUTOCLIP EXPORT METADATA & SUBTITLE
=============================================================
Judul Klip: ${clip.title}
Skor Viralitas: ${clip.viralScore}/100
Sumber YouTube Video: https://www.youtube.com/watch?v=${ytId}
Link Potongan Detik Ini: https://youtu.be/${ytId}?t=${clip.startSec}s
Waktu Potong: ${clip.timestampStart} - ${clip.timestampEnd} (${clip.durationSec} detik)
Format Aspek Rasio: ${clip.aspectRatio}
Gaya Subtitle: ${clip.subtitleStyle}
Pembicara: ${clip.speakerName}

-------------------------------------------------------------
ALASAN HOOK:
${clip.hookReason}

-------------------------------------------------------------
CAPTION SIAP POSTING:
${clip.caption}

HASHTAG:
${(clip.hashtags || []).join(' ')}

-------------------------------------------------------------
SUBTITLE SRT:
${srtContent}
=============================================================`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clip.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_autoclip.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadingId(null);
      showToast('Paket metadata & SRT berhasil diunduh!');
    }, 500);
  };

  const handleDownloadAllClips = () => {
    setBatchDownloading(true);
    setTimeout(() => {
      const allContent = clips
        .map(
          (c, idx) =>
            `KLIP #${idx + 1}: ${c.title}\nYouTube Link: https://youtu.be/${
              c.youtubeId || currentVideoDetails.id
            }?t=${c.startSec}s\nSkor: ${c.viralScore}/100 | Waktu: ${c.timestampStart} - ${
              c.timestampEnd
            } (${c.durationSec}d)\nCaption: ${c.caption}\nHashtags: ${(c.hashtags || []).join(
              ' '
            )}\n------------------------------------------------`
        )
        .join('\n\n');

      const blob = new Blob([allContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const chName = (currentVideoDetails.channel || 'autoclip')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');
      a.download = `semua_klip_${chName}_autoclip_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      try {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      } catch {}

      setBatchDownloading(false);
      showToast(`Berhasil mengunduh ringkasan ${clips.length} klip video!`);
    }, 700);
  };

  const handleDeleteClip = (id) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (playingClipId === id) setPlayingClipId(null);
    if (previewModalClip?.id === id) setPreviewModalClip(null);
    showToast('Klip dihapus.');
  };

  const handleSaveEditedClip = () => {
    if (!editingClip) return;
    const sSec = timeStringToSeconds(editingClip.timestampStart);
    const eSec = timeStringToSeconds(editingClip.timestampEnd);
    const updated = {
      ...editingClip,
      startSec: sSec,
      endSec: eSec,
      durationSec: Math.max(5, eSec - sSec)
    };
    setClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    showToast('Perubahan klip berhasil disimpan!');
    setEditingClip(null);
  };

  const handleAddNewClipSubmit = (e) => {
    e.preventDefault();
    if (!newClipForm.title.trim()) {
      showToast('Harap masukkan judul klip!');
      return;
    }
    const sSec = timeStringToSeconds(newClipForm.timestampStart);
    const eSec = timeStringToSeconds(newClipForm.timestampEnd);

    const newClip = {
      id: `clip-custom-${Date.now()}`,
      youtubeId: currentVideoDetails.id,
      title: newClipForm.title,
      viralScore: 92,
      timestampStart: newClipForm.timestampStart,
      timestampEnd: newClipForm.timestampEnd,
      startSec: sSec,
      endSec: eSec,
      durationSec: Math.max(5, eSec - sSec),
      aspectRatio: '9:16',
      subtitleStyle: newClipForm.subtitleStyle,
      accentColor: newClipForm.accentColor,
      speakerName: currentVideoDetails.channel || currentVideoDetails.speakerName || 'Kreator',
      hookReason: 'Klip kustom yang dibuat pengguna dengan rentang waktu spesifik.',
      caption: newClipForm.caption || `${newClipForm.title} - ${currentVideoDetails.channel}`,
      hashtags: [],
      transcript: [
        { id: 1, start: 0, end: 5, text: newClipForm.line1 || newClipForm.title },
        { id: 2, start: 5, end: 12, text: newClipForm.line2 || currentVideoDetails.title }
      ]
    };

    setClips((prev) => [newClip, ...prev]);
    setShowAddClipModal(false);
    setNewClipForm({
      title: '',
      timestampStart: '01:00',
      timestampEnd: '02:00',
      subtitleStyle: 'Hormozi Style',
      accentColor: '#facc15',
      caption: '',
      line1: '',
      line2: ''
    });
    showToast('Klip kustom berhasil ditambahkan ke galeri!');
  };

  const filteredClips = clips.filter((clip) => {
    const matchesScore =
      scoreFilter === '90+'
        ? clip.viralScore >= 90
        : scoreFilter === '85+'
        ? clip.viralScore >= 85
        : true;
    const matchesSearch =
      searchKeyword.trim() === '' ||
      clip.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (clip.caption || '').toLowerCase().includes(searchKeyword.toLowerCase());
    return matchesScore && matchesSearch;
  });

  const getScoreBadgeStyle = (score) => {
    if (score >= 95)
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]';
    if (score >= 90) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 flex flex-col">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 border border-indigo-500/40 text-slate-100 shadow-2xl shadow-indigo-950/50 max-w-md">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ================= HEADER & NAVIGASI ================= */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div
            onClick={() => setActiveTab('results')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <Scissors className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-300 bg-clip-text text-transparent">
                  AutoClip
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <Youtube className="w-3 h-3 text-rose-400" />
                  YouTube Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Pemotong Klip YouTube Dinamis & Render API
              </p>
            </div>
          </div>

          <nav className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'results'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Galeri Klip Video</span>
              <span className="ml-0.5 px-1.5 py-0.2 text-[11px] rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                {clips.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'studio'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>Studio / Pengaturan Klip</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">API & Hardware</span>
              <span className="md:hidden">API</span>
            </button>
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-medium">Mode Dinamis</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= KONTEN UTAMA ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* PANEL DETAIL INFORMASI VIDEO YOUTUBE SUMBER */}
        <div className="bg-slate-900/85 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all">
          <div
            onClick={() => setShowVideoInfoPanel(!showVideoInfoPanel)}
            className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 select-none border-b border-slate-800/60"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    Detail Informasi Video Sumber YouTube
                  </h2>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {currentVideoDetails.channel || 'Dinamis'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                  {currentVideoDetails.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-xs hidden sm:inline">
                {showVideoInfoPanel ? 'Tutup Detail' : 'Buka Detail Informasi'}
              </span>
              {showVideoInfoPanel ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>

          {showVideoInfoPanel && (
            <div className="p-5 sm:p-6 bg-slate-950/60 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-3">
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 shadow-xl">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube-nocookie.com/embed/${currentVideoDetails.id}?modestbranding=1&rel=0`}
                      title="YouTube Video Source"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      Durasi:{' '}
                      <strong className="text-slate-200">
                        {currentVideoDetails.durationString}
                      </strong>{' '}
                      ({currentVideoDetails.durationSec} detik)
                    </span>
                    <a
                      href={`https://www.youtube.com/watch?v=${currentVideoDetails.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                    >
                      <span>Buka di YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                      {currentVideoDetails.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span className="font-semibold text-cyan-300">
                        {currentVideoDetails.channel}
                      </span>
                      {currentVideoDetails.uploadDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />{' '}
                            {currentVideoDetails.uploadDate}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Video ID</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {currentVideoDetails.id}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Segmen Transkrip</span>
                      <span className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1">
                        <ThumbsUp className="w-3 h-3" />{' '}
                        {(currentVideoDetails.transcript || []).length} baris
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Klip Tersedia</span>
                      <span className="text-sm font-bold text-cyan-400">{clips.length} Klip</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-slate-300 space-y-1.5">
                    <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Deskripsi / Konteks Video:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      {currentVideoDetails.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= TAB 1: GALERI HASIL KLIP ================= */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white">
                    Galeri Klip Video ({clips.length} Klip)
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {currentVideoDetails.channel}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Klip dihasilkan secara dinamis dari sumber aktif. Unduh file <strong>MP4</strong>{' '}
                  via API Render atau putar potongan langsung di kartu klip.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setVideoCropMode('reframe-916')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                      videoCropMode === 'reframe-916'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>9:16 Reframe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoCropMode('original-169')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                      videoCropMode === 'original-169'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>16:9 Penuh</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddClipModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 border border-slate-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ Tambah Klip</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAllClips}
                  disabled={batchDownloading || clips.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-slate-700 transition-colors"
                >
                  {batchDownloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  <span>Unduh Ringkasan</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
              <input
                type="text"
                placeholder="Cari kata kunci dalam judul / caption klip..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full sm:w-80 px-3.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
              />

              <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
                <span className="text-slate-400 mr-1 text-[11px]">Filter Skor:</span>
                <button
                  onClick={() => setScoreFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    scoreFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'
                  }`}
                >
                  Semua ({clips.length})
                </button>
                <button
                  onClick={() => setScoreFilter('90+')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    scoreFilter === '90+' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
                  }`}
                >
                  Skor 90+
                </button>
                <button
                  onClick={() => setScoreFilter('85+')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    scoreFilter === '85+' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  Skor 85+
                </button>
              </div>
            </div>

            {/* Grid Kartu Klip */}
            {isLoadingMetadata && clips.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                <span>Memuat klip dinamis...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {filteredClips.map((clip, index) => {
                  const isPlaying = playingClipId === clip.id;
                  const isDownloadingThisVideo = downloadingVideoId === clip.id;
                  const ytId = clip.youtubeId || currentVideoDetails.id;
                  const transcriptArr = clip.transcript || [];

                  const activeLine = isPlaying
                    ? transcriptArr.find(
                        (line) => playbackTime >= line.start && playbackTime < line.end
                      ) || transcriptArr[0]
                    : transcriptArr[0];

                  return (
                    <div
                      key={clip.id}
                      className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-all"
                    >
                      <div
                        className={`relative aspect-[9/14] w-full bg-black overflow-hidden select-none border-b border-slate-800 ${
                          videoCropMode === 'reframe-916' ? '' : 'flex items-center justify-center'
                        }`}
                      >
                        {isPlaying ? (
                          <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black">
                            <iframe
                              className={`w-full h-full transition-transform duration-300 ${
                                videoCropMode === 'reframe-916'
                                  ? 'scale-[1.75] object-cover'
                                  : 'scale-100 object-contain'
                              }`}
                              src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${clip.startSec}&end=${clip.endSec}&autoplay=1&mute=${
                                isMuted ? 1 : 0
                              }&controls=1&modestbranding=1&rel=0`}
                              title={clip.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <div
                            onClick={() => togglePlayClip(clip.id)}
                            className="relative w-full h-full cursor-pointer group/thumb"
                          >
                            <img
                              src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
                              alt={clip.title}
                              className={`w-full h-full transition-transform duration-300 group-hover/thumb:scale-105 ${
                                videoCropMode === 'reframe-916'
                                  ? 'object-cover scale-[1.3]'
                                  : 'object-contain'
                              }`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/60 flex items-center justify-center">
                              <div className="w-14 h-14 rounded-full bg-rose-600/90 group-hover/thumb:bg-rose-500 text-white flex items-center justify-center shadow-xl">
                                <Play className="w-6 h-6 fill-current ml-1" />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
                          <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-white text-xs font-bold border border-white/10">
                            #{index + 1}
                          </span>

                          <div className="flex items-center gap-1.5 pointer-events-auto">
                            <button
                              type="button"
                              onClick={() => setPreviewModalClip(clip)}
                              className="p-1 rounded-lg bg-black/70 hover:bg-black text-slate-200 border border-white/15"
                              title="Buka Layar Penuh"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            <div
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg backdrop-blur-md border text-xs font-bold ${getScoreBadgeStyle(
                                clip.viralScore
                              )}`}
                            >
                              <Flame className="w-3.5 h-3.5" />
                              <span>{clip.viralScore}/100</span>
                            </div>
                          </div>
                        </div>

                        {activeLine?.text && (
                          <div className="absolute inset-x-3 bottom-12 z-20 text-center pointer-events-none">
                            <div
                              className="inline-block px-3 py-1.5 rounded-xl bg-black/85 font-bold text-xs"
                              style={{
                                color:
                                  clip.subtitleStyle === 'Minimalist'
                                    ? '#ffffff'
                                    : clip.accentColor || '#facc15'
                              }}
                            >
                              “{activeLine.text}”
                            </div>
                          </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between z-20">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => togglePlayClip(clip.id)}
                              className="w-7 h-7 rounded-full bg-white text-slate-950 flex items-center justify-center"
                            >
                              {isPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              )}
                            </button>
                            <div className="text-[10px] font-mono text-slate-200 bg-black/60 px-2 py-0.5 rounded">
                              {clip.timestampStart} - {clip.timestampEnd}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setIsMuted(!isMuted)}
                              className="p-1 rounded-lg bg-black/60 text-slate-300 hover:text-white text-xs"
                            >
                              {isMuted ? (
                                <VolumeX className="w-3.5 h-3.5" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={`https://youtu.be/${ytId}?t=${clip.startSec}s`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] flex items-center gap-0.5 px-1.5"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>YT</span>
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                                {clip.subtitleStyle}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {clip.durationSec}d
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteClip(clip.id)}
                              className="text-slate-500 hover:text-rose-400 p-0.5"
                              title="Hapus Klip"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <h3 className="font-bold text-sm text-white leading-snug line-clamp-2">
                            {clip.title}
                          </h3>

                          <div className="p-2.5 rounded-xl bg-indigo-950/35 border border-indigo-500/20">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 mb-0.5">
                              <Sparkles className="w-3 h-3 text-cyan-400" />
                              <span>Catatan Segmen:</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                              {clip.hookReason}
                            </p>
                          </div>

                          <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 line-clamp-2">
                            {clip.caption}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 space-y-2">
                          <button
                            type="button"
                            onClick={() => generateAndDownloadVideoMP4(clip)}
                            disabled={isDownloadingThisVideo}
                            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
                          >
                            {isDownloadingThisVideo ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Merender MP4...</span>
                              </>
                            ) : (
                              <>
                                <Film className="w-4 h-4" />
                                <span>Unduh Video MP4</span>
                              </>
                            )}
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingClip(JSON.parse(JSON.stringify(clip)))}
                              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Edit / Trim</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyCaption(clip)}
                              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700"
                            >
                              {copiedId === clip.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-300">Tersalin!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Salin Caption</span>
                                </>
                              )}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDownloadClip(clip)}
                            disabled={downloadingId === clip.id}
                            className="w-full py-1.5 px-2 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5"
                          >
                            <FileText className="w-3 h-3 text-cyan-400" />
                            <span>Unduh Metadata & SRT</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: STUDIO ================= */}
        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400">
                    <Youtube className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-white">
                      Konfigurasi Klip Dinamis
                    </h2>
                    <p className="text-xs text-slate-400">
                      Masukkan URL YouTube apa pun dan atur jumlah klip yang ingin diproses
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-300">
                        URL Video YouTube Sumber
                      </label>
                      <span className="text-[11px] text-cyan-400 font-medium">
                        Aktif: {currentVideoDetails.channel}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl text-sm text-slate-100 outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleSyncVideoUrl()}
                        disabled={isLoadingMetadata}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0"
                      >
                        {isLoadingMetadata ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>{isLoadingMetadata ? 'Mengambil...' : 'Sinkronkan'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        Target Jumlah Klip
                      </label>
                      <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">
                        {targetClipCount} Klip
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={targetClipCount}
                      onChange={(e) => setTargetClipCount(Number(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Gaya Subtitle
                      </label>
                      <select
                        value={subtitleStyle}
                        onChange={(e) => setSubtitleStyle(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
                      >
                        <option value="Hormozi Style">Hormozi Style</option>
                        <option value="Karaoke">Karaoke</option>
                        <option value="Minimalist">Minimalist</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Model Analisis
                      </label>
                      <select
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
                      >
                        <option value="Gemini 2.5 Flash / Pro">Gemini 2.5 Flash / Pro</option>
                        <option value="Pembagian Segmen Otomatis">Pembagian Segmen Otomatis</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startAutoClipPipeline}
                    disabled={isProcessing}
                    className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg bg-gradient-to-r from-rose-600 via-indigo-600 to-purple-600 hover:from-rose-500 hover:via-indigo-500 hover:to-purple-500 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                        <span>
                          Memproses ({currentStageIndex + 1}/6 • {stageProgress}%)...
                        </span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-5 h-5" />
                        <span>Generate {targetClipCount} Klip Dinamis</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>autoclip-engine.log</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTerminalLogs(['[SYSTEM] Log dibersihkan.'])}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>

                <div className="bg-black/80 border border-slate-800 rounded-xl p-3.5 h-64 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 space-y-1">
                  {terminalLogs.map((log, i) => (
                    <div
                      key={i}
                      className={
                        log.includes('[DONE]')
                          ? 'text-emerald-400 font-semibold'
                          : log.includes('>>> TAHAP')
                          ? 'text-cyan-300 font-semibold'
                          : 'text-slate-300'
                      }
                    >
                      {log}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: PENGATURAN API ================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Konfigurasi Kredensial API</h2>
                    <p className="text-xs text-slate-400">
                      Isi Gemini API Key untuk analisis klip berbasis konten/transkrip
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={apiSettings.geminiKey}
                    onChange={(e) => setApiSettings({ ...apiSettings, geminiKey: e.target.value })}
                    placeholder="AIza..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => showToast('Pengaturan API tersimpan di sesi ini!')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Pengaturan</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL FULLSCREEN PREVIEW */}
      {previewModalClip && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider truncate max-w-xs">
                  {previewModalClip.title}
                </span>
              </div>
              <button
                onClick={() => setPreviewModalClip(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-[9/16] w-full bg-black overflow-hidden flex items-center justify-center">
              <iframe
                className={`w-full h-full transition-transform duration-300 ${
                  videoCropMode === 'reframe-916' ? 'scale-[1.75] object-cover' : 'scale-100 object-contain'
                }`}
                src={`https://www.youtube-nocookie.com/embed/${
                  previewModalClip.youtubeId || currentVideoDetails.id
                }?start=${previewModalClip.startSec}&end=${
                  previewModalClip.endSec
                }&autoplay=1&mute=0&controls=1&modestbranding=1&rel=0`}
                title={previewModalClip.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="p-4 bg-slate-950 flex items-center gap-2">
              <button
                type="button"
                onClick={() => generateAndDownloadVideoMP4(previewModalClip)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white flex items-center justify-center gap-1.5"
              >
                <Film className="w-4 h-4" />
                <span>Unduh Video MP4</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyCaption(previewModalClip)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Caption</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH KLIP BARU */}
      {showAddClipModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Tambah Klip Kustom</h3>
              </div>
              <button
                onClick={() => setShowAddClipModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewClipSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Judul Klip</label>
                <input
                  type="text"
                  required
                  value={newClipForm.title}
                  onChange={(e) => setNewClipForm({ ...newClipForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mulai (MM:SS)
                  </label>
                  <input
                    type="text"
                    required
                    value={newClipForm.timestampStart}
                    onChange={(e) =>
                      setNewClipForm({ ...newClipForm, timestampStart: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Selesai (MM:SS)
                  </label>
                  <input
                    type="text"
                    required
                    value={newClipForm.timestampEnd}
                    onChange={(e) =>
                      setNewClipForm({ ...newClipForm, timestampEnd: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Baris Subtitle Utama
                </label>
                <input
                  type="text"
                  value={newClipForm.line1}
                  onChange={(e) => setNewClipForm({ ...newClipForm, line1: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddClipModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                >
                  Simpan Klip Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT KLIP */}
      {editingClip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Editor Klip & Potongan Timestamp
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sesuaikan waktu mulai/selesai dan teks transkrip
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingClip(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Judul Klip
                </label>
                <input
                  type="text"
                  value={editingClip.title}
                  onChange={(e) => setEditingClip({ ...editingClip, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Waktu Mulai (MM:SS)
                  </label>
                  <input
                    type="text"
                    value={editingClip.timestampStart}
                    onChange={(e) =>
                      setEditingClip({ ...editingClip, timestampStart: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-cyan-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Waktu Selesai (MM:SS)
                  </label>
                  <input
                    type="text"
                    value={editingClip.timestampEnd}
                    onChange={(e) =>
                      setEditingClip({ ...editingClip, timestampEnd: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-cyan-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Gaya Subtitle
                  </label>
                  <select
                    value={editingClip.subtitleStyle}
                    onChange={(e) =>
                      setEditingClip({ ...editingClip, subtitleStyle: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none"
                  >
                    <option value="Hormozi Style">Hormozi Style</option>
                    <option value="Karaoke">Karaoke</option>
                    <option value="Minimalist">Minimalist</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Caption Video
                </label>
                <textarea
                  rows="3"
                  value={editingClip.caption}
                  onChange={(e) => setEditingClip({ ...editingClip, caption: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingClip(null)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditedClip}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs sm:text-sm font-semibold text-white"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}