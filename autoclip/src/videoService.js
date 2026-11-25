// videoService.js — Modul Metadata YouTube, Generator Klip Dinamis & Render API

const RENDER_API_URL =
  import.meta.env.VITE_RENDER_API_URL || 'https://apiclip.hatami.id/api';

export const extractYouTubeId = (url) => {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
};

export const timeStringToSeconds = (str) => {
  if (typeof str === 'number') return Math.max(0, Math.floor(str));
  if (!str) return 0;
  const parts = String(str).trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(str) || 0;
};

export const formatSecondsToTime = (secs) => {
  const safe = Math.max(0, Math.floor(Number(secs) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const remSec = safe % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
};

// ============================================================================
// NORMALISASI TRANSKRIP DINAMIS (ARRAY SEGMEN ATAU TEKS MENTAH)
// ============================================================================

function normalizeTranscriptSegments(rawTranscript, totalDurationSec = 600) {
  if (Array.isArray(rawTranscript) && rawTranscript.length > 0) {
    return rawTranscript
      .map((item, idx) => {
        const text = typeof item === 'string' ? item : item?.text || item?.content || '';
        const start =
          typeof item?.start === 'number'
            ? item.start
            : typeof item?.startSec === 'number'
            ? item.startSec
            : idx * 5;
        const end =
          typeof item?.end === 'number'
            ? item.end
            : typeof item?.endSec === 'number'
            ? item.endSec
            : start + 5;
        return {
          id: item?.id ?? idx + 1,
          start: Math.max(0, start),
          end: Math.max(start + 1, end),
          text: String(text).trim(),
        };
      })
      .filter((seg) => seg.text.length > 0);
  }

  if (typeof rawTranscript === 'string' && rawTranscript.trim().length > 0) {
    const sentences = rawTranscript
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length === 0) return [];

    const step = Math.max(3, Math.floor(totalDurationSec / sentences.length));
    return sentences.map((text, idx) => {
      const start = idx * step;
      return {
        id: idx + 1,
        start,
        end: start + step,
        text,
      };
    });
  }

  return [];
}

function buildTranscriptExcerpt(segments, startSec, endSec, fallbackTitle, channelName) {
  const matched = (segments || []).filter((seg) => seg.end >= startSec && seg.start <= endSec);
  const sourceLines = matched.length > 0 ? matched : (segments || []).slice(0, 8);

  if (sourceLines.length > 0) {
    return sourceLines.map((seg, idx) => {
      const relStart = Math.max(0, Number((seg.start - startSec).toFixed(1)));
      const relEnd = Math.max(relStart + 0.6, Number((seg.end - startSec).toFixed(1)));
      return {
        id: idx + 1,
        start: relStart,
        end: relEnd,
        text: String(seg.text || '').trim(),
      };
    }).filter((s) => s.text.length > 0);
  }

  const duration = Math.max(10, endSec - startSec);
  return [
    {
      id: 1,
      start: 0,
      end: Math.min(5, duration / 2),
      text: `Cuplikan dari "${fallbackTitle}" (${channelName}).`,
    },
    {
      id: 2,
      start: Math.min(5, duration / 2),
      end: duration,
      text: `Segmen dimulai pada ${formatSecondsToTime(startSec)} hingga ${formatSecondsToTime(endSec)}.`,
    },
  ];
}

// ============================================================================
// PENGAMBILAN METADATA YOUTUBE DINAMIS (OEMBED / BACKEND OPSIONAL)
// ============================================================================

export async function fetchYouTubeMetadata(rawUrl, options = {}) {
  const videoId = extractYouTubeId(rawUrl);
  if (!videoId) {
    throw new Error('URL YouTube tidak valid. Harap periksa format tautan.');
  }

  let liveTitle = '';
  let liveAuthor = '';
  let liveThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let durationSec = Number(options.durationSec) || 900;
  let description = options.description || '';
  let transcript = options.transcript || [];

  // Opsional: ambil metadata & transkrip dari backend Render jika tersedia
  if (options.useBackend !== false && RENDER_API_URL && !RENDER_API_URL.includes('YOUR-SERVICE-NAME')) {
    try {
      const metaRes = await fetch(
        `${RENDER_API_URL}/api/video-info?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${videoId}`
        )}`
      );
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        liveTitle = metaData.title || liveTitle;
        liveAuthor = metaData.channel || metaData.uploader || liveAuthor;
        liveThumbnail = metaData.thumbnail || liveThumbnail;
        if (metaData.durationSec) durationSec = Number(metaData.durationSec);
        if (metaData.description) description = metaData.description;
        if (metaData.transcript) transcript = metaData.transcript;
      }
    } catch (_) {
      // Lanjut ke noembed jika endpoint backend belum tersedia
    }
  }

  if (!liveTitle) {
    try {
      const oembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.title) liveTitle = data.title;
        if (data.author_name) liveAuthor = data.author_name;
        if (data.thumbnail_url) liveThumbnail = data.thumbnail_url;
      }
    } catch (err) {
      console.warn('Gagal mengambil data oEmbed:', err);
    }
  }

  const finalTitle = liveTitle || `Video YouTube (${videoId})`;
  const finalChannel = liveAuthor || 'Kanal YouTube';
  const finalDescription =
    description ||
    `Video "${finalTitle}" oleh ${finalChannel}. Dianalisis secara dinamis untuk mengekstrak segmen klip pendek.`;

  return {
    id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: finalTitle,
    channel: finalChannel,
    channelUrl: `https://www.youtube.com/watch?v=${videoId}`,
    speakerName: finalChannel,
    durationString: formatSecondsToTime(durationSec),
    durationSec,
    thumbnail: liveThumbnail,
    description: finalDescription,
    transcript,
    clips: null,
  };
}

// ============================================================================
// GENERATOR KLIP DINAMIS (GEMINI API + TRANSKRIP / DURASI VIDEO)
// ============================================================================

export async function generateClipsForSource({
  videoDetails,
  clipCount = 4,
  apiKey = '',
  subtitleStyle = 'Hormozi Style',
  aspectRatio = '9:16',
  transcriptLang = 'Indonesia',
  preferredDurationSec = 60,
}) {
  const targetCount = Math.max(1, Math.min(Number(clipCount) || 4, 12));
  const totalDuration = Math.max(30, Number(videoDetails?.durationSec) || 900);
  const clipSpan = Math.min(
    Math.max(20, Number(preferredDurationSec) || 60),
    Math.max(20, Math.floor(totalDuration / targetCount))
  );

  const normalizedSegments = normalizeTranscriptSegments(
    videoDetails?.transcript,
    totalDuration
  );

  // 1. Jika ada API key Gemini, minta analisis klip dinamis berdasarkan konten & transkrip video
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`;

      const transcriptContext =
        normalizedSegments.length > 0
          ? normalizedSegments
              .slice(0, 80)
              .map((s) => `[${formatSecondsToTime(s.start)} - ${formatSecondsToTime(s.end)}] ${s.text}`)
              .join('\n')
          : 'Transkrip mentah tidak tersedia; susun segmen waktu realistis dalam rentang durasi video.';

      const prompt = `Analisis video berikut dan hasilkan tepat ${targetCount} klip pendek vertikal (${aspectRatio}) yang paling menarik.

Metadata Video:
- Judul: "${videoDetails.title}"
- Kanal / Pembicara: "${videoDetails.channel}"
- Total Durasi (detik): ${totalDuration} (${formatSecondsToTime(totalDuration)})
- Deskripsi: "${videoDetails.description || ''}"
- Bahasa Output: ${transcriptLang}
- Target Durasi per Klip: ~${clipSpan} detik

Cuplikan Transkrip / Referensi Waktu:
${transcriptContext}

Aturan:
1. Pastikan startSec >= 0, endSec <= ${totalDuration}, dan endSec > startSec.
2. Sesuaikan judul, hookReason, caption, hashtags, dan transcript dengan isi video ini (jangan mengarang pembicara atau tema yang tidak ada).
3. Kembalikan HANYA JSON ARRAY valid berisi objek dengan field:
   title, viralScore (80-99), startSec (angka), endSec (angka), speakerName, hookReason, caption, hashtags (array string), transcript (array objek {id, start, end, text}).`;

      const res = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.65,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (res.ok) {
        const jsonRes = await res.json();
        const rawText = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const cleanedJson = rawText.replace(/^```json\s*|\s*```$/g, '').trim();
          const parsed = JSON.parse(cleanedJson);

          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.slice(0, targetCount).map((item, idx) => {
              const rawStart =
                typeof item.startSec === 'number'
                  ? item.startSec
                  : timeStringToSeconds(item.timestampStart || idx * clipSpan);
              const startSec = Math.max(0, Math.min(rawStart, Math.max(0, totalDuration - 10)));

              const rawEnd =
                typeof item.endSec === 'number'
                  ? item.endSec
                  : timeStringToSeconds(item.timestampEnd || startSec + clipSpan);
              const endSec = Math.max(
                startSec + 10,
                Math.min(rawEnd || startSec + clipSpan, totalDuration)
              );

              const itemTranscript = normalizeTranscriptSegments(
                item.transcript,
                endSec - startSec
              );

              return {
                id: `clip-${videoDetails.id}-${idx + 1}-${Date.now()}`,
                youtubeId: videoDetails.id,
                title: item.title || `${videoDetails.title} — Segmen ${idx + 1}`,
                viralScore: Number(item.viralScore) || 90,
                timestampStart: formatSecondsToTime(startSec),
                timestampEnd: formatSecondsToTime(endSec),
                startSec,
                endSec,
                durationSec: endSec - startSec,
                aspectRatio,
                subtitleStyle,
                accentColor:
                  idx % 3 === 0 ? '#facc15' : idx % 3 === 1 ? '#22d3ee' : '#a855f7',
                speakerName: item.speakerName || videoDetails.channel,
                hookReason:
                  item.hookReason ||
                  'Segmen dipilih berdasarkan potensi pembuka dan kepadatan informasi.',
                caption:
                  item.caption ||
                  `${item.title || videoDetails.title} — ${videoDetails.channel}`,
                hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
                transcript:
                  itemTranscript.length > 0
                    ? itemTranscript
                    : buildTranscriptExcerpt(
                        normalizedSegments,
                        startSec,
                        endSec,
                        videoDetails.title,
                        videoDetails.channel
                      ),
              };
            });
          }
        }
      }
    } catch (err) {
      console.warn('Gemini API tidak tersedia, menggunakan pembagian segmen dinamis:', err);
    }
  }

  // 2. Pembagian segmen dinamis berbasis durasi & transkrip video aktual (tanpa preset tetap)
  const usableWindow = Math.max(20, totalDuration - clipSpan);
  const step =
    targetCount > 1 ? Math.floor(usableWindow / (targetCount - 1)) : 0;

  return Array.from({ length: targetCount }, (_, idx) => {
    const startSec =
      normalizedSegments.length >= targetCount
        ? Math.min(
            usableWindow,
            Math.floor(
              normalizedSegments[
                Math.min(
                  normalizedSegments.length - 1,
                  Math.floor((idx * normalizedSegments.length) / targetCount)
                )
              ].start
            )
          )
        : Math.min(usableWindow, idx * step);

    const endSec = Math.min(totalDuration, startSec + clipSpan);
    const clipSegments = buildTranscriptExcerpt(
      normalizedSegments,
      startSec,
      endSec,
      videoDetails.title,
      videoDetails.channel
    );

    const fullTranscriptSummary =
      clipSegments.length > 0
        ? clipSegments.map((s) => s.text).join(' ')
        : `${videoDetails.title} oleh ${videoDetails.channel}`;
    const cleanCaption =
      fullTranscriptSummary.length > 280
        ? `${fullTranscriptSummary.slice(0, 277).trim()}...`
        : fullTranscriptSummary;
    const leadText = clipSegments[0]?.text || videoDetails.title;
    const shortLead = leadText.length > 68 ? `${leadText.slice(0, 65).trim()}...` : leadText;

    return {
      id: `clip-${videoDetails.id}-${idx + 1}-${Date.now()}`,
      youtubeId: videoDetails.id,
      title: `${shortLead} (${formatSecondsToTime(startSec)})`,
      viralScore: Math.min(98, 88 + ((idx * 3) % 10)),
      timestampStart: formatSecondsToTime(startSec),
      timestampEnd: formatSecondsToTime(endSec),
      startSec,
      endSec,
      durationSec: Math.max(1, endSec - startSec),
      aspectRatio,
      subtitleStyle,
      accentColor: idx % 3 === 0 ? '#facc15' : idx % 3 === 1 ? '#22d3ee' : '#a855f7',
      speakerName: videoDetails.channel,
      hookReason: `Potongan segmen ${formatSecondsToTime(startSec)}–${formatSecondsToTime(
        endSec
      )} dari "${videoDetails.title}".`,
      caption: cleanCaption,
      hashtags: [],
      transcript: clipSegments,
    };
  });
}

// ============================================================================
// RENDER & UNDUH KLIP MP4 DARI BACKEND RENDER
// ============================================================================

export async function renderClipFromBackend({
  url,
  start_sec,
  end_sec,
  title,
  aspect_ratio = '9:16',
  caption = '',
  transcript = [],
  subtitle_style = 'Hormozi Style',
  accent_color = '#facc15',
  burn_subtitles = true,
}) {
  const response = await fetch(`${RENDER_API_URL}/api/render-clip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      start_sec: Number(start_sec),
      end_sec: Number(end_sec),
      title: title || 'clip',
      aspect_ratio,
      caption: caption || '',
      transcript: Array.isArray(transcript) ? transcript : [],
      subtitle_style,
      accent_color,
      burn_subtitles: Boolean(burn_subtitles),
    }),
  });

  if (!response.ok) {
    let errorMessage = `Render API error (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.detail) errorMessage = errData.detail;
    } catch (_) {
      // Abaikan jika body bukan JSON
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const safeTitle = String(title || 'clip').replace(/[\\/:*?"<>|]+/g, '_');
  const filename = `${safeTitle}_${Math.floor(start_sec)}s_${Math.floor(end_sec)}s.mp4`;

  return { blob, downloadUrl, filename };
}