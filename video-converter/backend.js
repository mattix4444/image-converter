// ── DOM refs ──────────────────────────────────────────────────────────────────
const dropZone        = document.getElementById('drop-zone')
const fileInput       = document.getElementById('file-input')
const uploadBtn       = document.getElementById('upload-button')
const convertCard     = document.getElementById('convert-card')
const convertBtn      = document.getElementById('convert-button')
const formatSelect    = document.getElementById('format-select')
const filenameEl      = document.getElementById('convert-filename')
const uploadStatusEl  = document.getElementById('upload-status')
const acceptedFormats = document.getElementById('accepted-formats')
const videoNotice     = document.getElementById('video-notice')
const progressBar     = document.getElementById('upload-progress')
const convertingLabel = document.getElementById('converting-label')
const typeTabs        = document.querySelectorAll('.type-tab')

// ── State ─────────────────────────────────────────────────────────────────────
let currentFile = null
let activeType  = 'video'   // 'image' | 'text' | 'video'

document.addEventListener("DOMContentLoaded", function(){
  init()
})
function init() {
  typeTabs.forEach(tab => {
    const isActive = tab.dataset.type === activeType
    tab.classList.toggle('active', isActive)
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false')
  })

  applyTypeConfig(activeType)
}

// ── File type configs ─────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  image: {
    accept:   'image/*',
    formats:  'JPG · PNG · WEBP · GIF · BMP · SVG',
    mimeList: ['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/svg+xml'],
    options:  [
      { value: 'png',  label: 'PNG'  },
      { value: 'jpeg', label: 'JPEG' },
      { value: 'webp', label: 'WEBP' },
      { value: 'bmp',  label: 'BMP'  },
      { value: 'gif',  label: 'GIF'  },
    ]
  },
  text: {
    accept:   '.txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.yaml,.yml,.log',
    formats:  'TXT · MD · HTML · CSV · JSON · XML · YAML · LOG',
    mimeList: [
      'text/plain','text/markdown','text/csv','application/json',
      'text/html','text/xml','application/xml','application/x-yaml','text/yaml',''
    ],
    options:  [
      { value: 'txt',  label: 'TXT'  },
      { value: 'md',   label: 'MD'   },
      { value: 'html', label: 'HTML' },
      { value: 'csv',  label: 'CSV'  },
      { value: 'json', label: 'JSON' },
    ]
  },
  video: {
    accept:   'video/*',
    formats:  'MP4 · WEBM · OGG · MOV · AVI · MKV',
    mimeList: ['video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo','video/x-matroska'],
    options:  [
      { value: 'webm', label: 'WEBM' },
      { value: 'mp4',  label: 'MP4 (re-wrap)' },
    ]
  }
}

// ── Status helpers ────────────────────────────────────────────────────────────
function showError(msg)   { uploadStatusEl.textContent = msg; uploadStatusEl.className = 'status-message error' }
function showSuccess(msg) { uploadStatusEl.textContent = msg; uploadStatusEl.className = 'status-message success' }
function clearStatus()    { uploadStatusEl.textContent = '';  uploadStatusEl.className = 'status-message' }

function showProgress(val) {
  progressBar.value = val
  progressBar.classList.add('visible')
}
function hideProgress() {
  progressBar.classList.remove('visible')
  progressBar.value = 0
}
function showConverting(on) {
  convertingLabel.classList.toggle('visible', on)
}

// ── Tab switching ─────────────────────────────────────────────────────────────
typeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    typeTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false') })
    tab.classList.add('active')
    tab.setAttribute('aria-selected','true')
    activeType = tab.dataset.type
    applyTypeConfig(activeType)
    resetUI()
  })
})

function applyTypeConfig(type) {
  const cfg = TYPE_CONFIG[type]
  fileInput.accept = cfg.accept
  acceptedFormats.textContent = cfg.formats
  videoNotice.classList.toggle('visible', type === 'video')

  // Rebuild format select
  formatSelect.innerHTML = ''
  cfg.options.forEach(opt => {
    const el = document.createElement('option')
    el.value = opt.value
    el.textContent = opt.label
    formatSelect.appendChild(el)
  })
}

function resetUI() {
  currentFile = null
  convertCard.hidden = true
  clearStatus()
  hideProgress()
  showConverting(false)
  fileInput.value = ''
}

// ── File picker ───────────────────────────────────────────────────────────────
uploadBtn.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => { if (fileInput.files.length) handleFiles(fileInput.files) })
dropZone.addEventListener('click', (e) => { if (e.target !== uploadBtn) fileInput.click() })

// ── Drag & drop ───────────────────────────────────────────────────────────────
;['dragenter','dragover','dragleave','drop'].forEach(ev =>
  dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation() })
)
;['dragenter','dragover'].forEach(ev =>
  dropZone.addEventListener(ev, () => dropZone.classList.add('drag-over'))
)
;['dragleave','drop'].forEach(ev =>
  dropZone.addEventListener(ev, () => dropZone.classList.remove('drag-over'))
)
dropZone.addEventListener('drop', e => {
  if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
})

// ── Handle selected files ─────────────────────────────────────────────────────
function handleFiles(fileList) {
  clearStatus()
  if (fileList.length > 1) { showError('Select only one file at a time.'); return }

  const file = fileList[0]
  const maxSize = activeType === 'video' ? 500 * 1024 * 1024 : 5 * 1024 * 1024
  const maxLabel = activeType === 'video' ? '500 MB' : '5 MB'

  // For text files, MIME detection is unreliable — fall back to extension check
  if (activeType === 'text') {
    const ext = file.name.split('.').pop().toLowerCase()
    const validExts = ['txt','md','markdown','csv','json','html','htm','xml','yaml','yml','log']
    if (!validExts.includes(ext)) { showError(`Unsupported file type: .${ext}`); return }
  } else {
    const cfg = TYPE_CONFIG[activeType]
    // Allow empty mime (some files report '' on certain OS)
    if (file.type && !cfg.mimeList.includes(file.type)) {
      showError(`Unsupported type: ${file.type || 'unknown'}.`); return
    }
  }

  if (file.size > maxSize) { showError(`File too large (max ${maxLabel}).`); return }

  currentFile = file
  filenameEl.textContent = file.name
  convertCard.hidden = false
  showSuccess(`Loaded: ${file.name}`)
}

// ── Convert button ────────────────────────────────────────────────────────────
convertBtn.addEventListener('click', async () => {
  if (!currentFile) return

  gtag('event', 'conversion_button_click', {
    file_type: activeType,           // es. 'image', 'text', 'video'
    target_format: formatSelect.value // es. 'png', 'webm'
  });

  convertBtn.disabled = true
  convertBtn.querySelector('span').textContent = 'Converting…'
  clearStatus()
  showConverting(true)
  showProgress(10)

  try {
    const fmt = formatSelect.value
    let blob, filename

    if (activeType === 'image') {
      blob = await convertImage(currentFile, fmt)
      const base = currentFile.name.replace(/\.[^/.]+$/, '')
      const ext  = fmt === 'jpeg' ? 'jpg' : fmt
      filename   = `${base}.${ext}`
    } else if (activeType === 'text') {
      blob = await convertText(currentFile, fmt)
      const base = currentFile.name.replace(/\.[^/.]+$/, '')
      filename   = `${base}.${fmt}`
    } else if (activeType === 'video') {
      blob = await convertVideo(currentFile, fmt, (pct) => showProgress(10 + pct * 0.9))
      const base = currentFile.name.replace(/\.[^/.]+$/, '')
      filename   = `${base}.${fmt}`
    }

    showProgress(100)
    const url = URL.createObjectURL(blob)
    download(url, filename)
    URL.revokeObjectURL(url)
    showSuccess(`Converted to ${fmt.toUpperCase()}!`)
  } catch (err) {
    showError(`Error: ${err.message}`)
  } finally {
    convertBtn.disabled = false
    convertBtn.querySelector('span').textContent = 'Convert'
    showConverting(false)
    setTimeout(hideProgress, 800)
  }
})

// ── Download helper ───────────────────────────────────────────────────────────
function download(url, filename) {
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

// ── IMAGE converter ───────────────────────────────────────────────────────────
function convertImage(file, targetType) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas  = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx     = canvas.getContext('2d')
      if (['jpeg','bmp'].includes(targetType)) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const mime = targetType === 'jpg' ? 'image/jpeg' : `image/${targetType}`
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Conversion failed')); return }
        resolve(blob)
      }, mime, 0.92)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Cannot load: ${file.name}`)) }
    img.src = url
  })
}

// ── TEXT converter ────────────────────────────────────────────────────────────
async function convertText(file, targetFormat) {
  const raw = await file.text()
  const srcExt = file.name.split('.').pop().toLowerCase()

  let output

  // Parse the source into an intermediate representation
  // then serialize to the target format
  switch(targetFormat) {

    case 'txt': {
      // Strip any HTML tags if source is HTML
      if (['html','htm'].includes(srcExt)) {
        const tmp = document.createElement('div')
        tmp.innerHTML = raw
        output = tmp.innerText
      } else {
        // Strip markdown-ish syntax (headers, bold, italic, links)
        output = raw
          .replace(/^#{1,6}\s+/gm, '')           // headers
          .replace(/\*\*(.+?)\*\*/g, '$1')        // bold
          .replace(/\*(.+?)\*/g, '$1')            // italic
          .replace(/\[(.+?)\]\(.+?\)/g, '$1')     // links
          .replace(/`{1,3}[^`]*`{1,3}/g, '')      // code
          .replace(/^\s*[-*+]\s+/gm, '- ')        // list items
      }
      break
    }

    case 'md': {
      if (['html','htm'].includes(srcExt)) {
        // Very light HTML→MD conversion
        output = raw
          .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
          .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
          .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
          .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
          .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
      } else if (srcExt === 'csv') {
        // CSV → markdown table
        const rows = parseCSV(raw)
        if (rows.length === 0) { output = ''; break }
        const header = rows[0].map(c => c || ' ')
        const sep    = header.map(() => '---')
        const body   = rows.slice(1).map(r => r.map(c => c || ' '))
        output = [
          '| ' + header.join(' | ') + ' |',
          '| ' + sep.join(' | ')    + ' |',
          ...body.map(r => '| ' + r.join(' | ') + ' |')
        ].join('\n')
      } else if (['json'].includes(srcExt)) {
        try {
          const obj = JSON.parse(raw)
          output = jsonToMarkdown(obj, 0)
        } catch { output = '```json\n' + raw + '\n```' }
      } else {
        output = raw // TXT/LOG/YAML stay as-is (already plain)
      }
      break
    }

    case 'html': {
      if (srcExt === 'md' || srcExt === 'markdown') {
        output = mdToHtml(raw)
      } else if (srcExt === 'csv') {
        const rows = parseCSV(raw)
        const thead = '<tr>' + (rows[0]||[]).map(c=>`<th>${esc(c)}</th>`).join('') + '</tr>'
        const tbody = rows.slice(1).map(r =>
          '<tr>' + r.map(c=>`<td>${esc(c)}</td>`).join('') + '</tr>'
        ).join('\n')
        output = `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"><title>Converted</title></head>\n<body>\n<table border="1" cellpadding="6" cellspacing="0">\n<thead>\n${thead}\n</thead>\n<tbody>\n${tbody}\n</tbody>\n</table>\n</body>\n</html>`
      } else if (srcExt === 'json') {
        try {
          const obj = JSON.parse(raw)
          output = `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"><title>Converted</title></head>\n<body>\n${jsonToHtml(obj)}\n</body>\n</html>`
        } catch { output = `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"></head>\n<body><pre>${esc(raw)}</pre></body>\n</html>` }
      } else {
        output = `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"><title>Converted</title></head>\n<body>\n<pre>${esc(raw)}</pre>\n</body>\n</html>`
      }
      break
    }

    case 'csv': {
      if (['json'].includes(srcExt)) {
        try {
          const obj = JSON.parse(raw)
          const arr = Array.isArray(obj) ? obj : [obj]
          const keys = [...new Set(arr.flatMap(o => Object.keys(o)))]
          const rows = arr.map(o => keys.map(k => csvCell(o[k] !== undefined ? String(o[k]) : '')))
          output = [keys.map(csvCell).join(','), ...rows.map(r => r.join(','))].join('\n')
        } catch { throw new Error('Invalid JSON — cannot convert to CSV') }
      } else {
        // TXT/MD: each line becomes a CSV row with one column
        output = raw.split('\n').map(line => csvCell(line)).join('\n')
      }
      break
    }

    case 'json': {
      if (srcExt === 'csv') {
        const rows = parseCSV(raw)
        if (rows.length < 2) { output = '[]'; break }
        const keys   = rows[0]
        const result = rows.slice(1).map(r => Object.fromEntries(keys.map((k,i) => [k, r[i] ?? ''])))
        output = JSON.stringify(result, null, 2)
      } else {
        // Wrap plain text as JSON
        output = JSON.stringify({ content: raw }, null, 2)
      }
      break
    }

    default:
      output = raw
  }

  return new Blob([output], { type: 'text/plain;charset=utf-8' })
}

// ── TEXT conversion helpers ───────────────────────────────────────────────────
function parseCSV(raw) {
  // RFC 4180-ish parser
  const rows = []
  raw.trim().split('\n').forEach(line => {
    const cells = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        cells.push(cur); cur = ''
      } else { cur += ch }
    }
    cells.push(cur)
    rows.push(cells)
  })
  return rows
}

function csvCell(s) {
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function mdToHtml(md) {
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^\s*[-*+] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
  return `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"><title>Converted</title></head>\n<body>\n<p>${html}</p>\n</body>\n</html>`
}

function jsonToMarkdown(obj, depth) {
  if (typeof obj !== 'object' || obj === null) return String(obj)
  if (Array.isArray(obj)) return obj.map(v => '- ' + jsonToMarkdown(v, depth + 1)).join('\n')
  return Object.entries(obj).map(([k,v]) => {
    const hd = '#'.repeat(Math.min(depth + 2, 6)) + ' ' + k
    if (typeof v === 'object' && v !== null) return hd + '\n' + jsonToMarkdown(v, depth + 1)
    return hd + '\n' + String(v)
  }).join('\n\n')
}

function jsonToHtml(obj, depth = 0) {
  if (Array.isArray(obj)) {
    return '<ul>' + obj.map(v => `<li>${jsonToHtml(v, depth+1)}</li>`).join('') + '</ul>'
  }
  if (typeof obj === 'object' && obj !== null) {
    return '<dl>' + Object.entries(obj).map(([k,v]) =>
      `<dt><strong>${esc(k)}</strong></dt><dd>${jsonToHtml(v, depth+1)}</dd>`
    ).join('') + '</dl>'
  }
  return esc(String(obj))
}

// ── VIDEO converter ───────────────────────────────────────────────────────────
function convertVideo(file, targetFormat, onProgress) {
  return new Promise((resolve, reject) => {

    // MP4 "re-wrap": for browsers that already natively handle the container
    // we can't truly transcode without ffmpeg.wasm; instead we offer WEBM
    // re-encoding via MediaRecorder, or a passthrough for same-format.
    if (targetFormat === 'mp4' && file.type === 'video/mp4') {
      // Already MP4 — just return the blob
      onProgress && onProgress(1)
      resolve(file.slice(0, file.size, 'video/mp4'))
      return
    }

    if (targetFormat === 'webm') {
      reEncodeViaMediaRecorder(file, onProgress).then(resolve).catch(reject)
    } else {
      reject(new Error('This format is not supported without a server. Try WEBM.'))
    }
  })
}

function reEncodeViaMediaRecorder(file, onProgress) {
  return new Promise((resolve, reject) => {
    const videoEl  = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)
    videoEl.src    = objectUrl
    videoEl.muted  = false
    videoEl.preload = 'auto'

    videoEl.onloadedmetadata = () => {
      const duration = videoEl.duration

      // Create an offscreen canvas the same size as the video
      const canvas = document.createElement('canvas')
      canvas.width  = videoEl.videoWidth  || 1280
      canvas.height = videoEl.videoHeight || 720
      const ctx     = canvas.getContext('2d')

      // Capture stream from canvas + audio from the video element (if supported)
      const canvasStream = canvas.captureStream(30) // 30 fps
      let combinedStream = canvasStream

      // Try to add audio track via WebAudio (only works if not CORS-blocked)
      try {
        const audioCtx  = new AudioContext()
        const src       = audioCtx.createMediaElementSource(videoEl)
        const dest      = audioCtx.createMediaStreamDestination()
        src.connect(dest)
        src.connect(audioCtx.destination) // also play to speakers
        dest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t))
      } catch (_) { /* no audio — that's OK */ }

      // Pick best supported MIME
      const mimeOptions = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ]
      const mime = mimeOptions.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'

      const recorder = new MediaRecorder(combinedStream, { mimeType: mime })
      const chunks   = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(new Blob(chunks, { type: mime }))
      }
      recorder.onerror = e => { URL.revokeObjectURL(objectUrl); reject(new Error(e.error?.message || 'Recorder error')) }

      // Draw frames while video plays
      let rafId
      function drawFrame() {
        if (videoEl.paused || videoEl.ended) return
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
        if (duration > 0 && onProgress) onProgress(videoEl.currentTime / duration)
        rafId = requestAnimationFrame(drawFrame)
      }

      recorder.start(100) // collect data every 100ms
      videoEl.play()
      videoEl.onplay = () => drawFrame()

      videoEl.onended = () => {
        cancelAnimationFrame(rafId)
        recorder.stop()
        videoEl.remove()
      }

      // Safety timeout
      const timeout = setTimeout(() => {
        cancelAnimationFrame(rafId)
        if (recorder.state !== 'inactive') recorder.stop()
      }, (duration + 10) * 1000)

      recorder.onstop = () => {
        clearTimeout(timeout)
        URL.revokeObjectURL(objectUrl)
        resolve(new Blob(chunks, { type: mime }))
      }
    }

    videoEl.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`Cannot load video: ${file.name}`))
    }

    document.body.appendChild(videoEl) // must be in DOM for some browsers
    videoEl.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;'
  })
}

// ── About toggle ──────────────────────────────────────────────────────────────
const about = document.getElementById('about')
function change_about() {
  about.style.display = about.style.display === 'none' ? 'flex' : 'none'
}

// ── Init ──────────────────────────────────────────────────────────────────────
applyTypeConfig('image')