const title = document.getElementById("h1-title")
const dropZone = document.getElementById('drop-zone')
const fileInput = document.getElementById('file-input')
const uploadBtn = document.getElementById('upload-button')
const convertCard = document.getElementById('convert-card')
const convertBtn = document.getElementById('convert-button')
const formatSelect = document.getElementById('format-select')
const filenameEl = document.getElementById('convert-filename')
const uploadStatusEl = document.getElementById('upload-status')
const acceptedFormats = document.getElementById('accepted-formats')
const videoNotice = document.getElementById('video-notice')
const progressBar = document.getElementById('upload-progress')
const convertingLabel = document.getElementById('converting-label')
const typeTabs = document.querySelectorAll('.type-tab')
const folderCheckbox = document.getElementById("folder")

let currentFiles = []
let activeType = 'image'

document.addEventListener("DOMContentLoaded", () => {
  init()
})

function init() {
  if (title?.textContent?.includes("video")) activeType = "video"
  else if (title?.textContent?.includes("text")) activeType = "text"
  else activeType = "image"

  typeTabs.forEach(tab => {
    const active = tab.dataset.type === activeType
    tab.classList.toggle('active', active)
    tab.setAttribute('aria-selected', active ? 'true' : 'false')
  })

  applyTypeConfig(activeType)
}

const TYPE_CONFIG = {
  image: {
    accept: 'image/*',
    mime: ['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/svg+xml'],
    options: ['png','jpeg','webp','bmp','gif']
  },
  text: {
    accept: '.txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.yaml,.yml,.log',
    options: ['txt','md','html','csv','json']
  },
  video: {
    accept: 'video/*',
    options: ['webm','mp4']
  }
}

function applyTypeConfig(type) {
  const cfg = TYPE_CONFIG[type]
  fileInput.accept = cfg.accept
  acceptedFormats.textContent = cfg.options.join(' · ').toUpperCase()
  videoNotice.classList.toggle('visible', type === 'video')

  formatSelect.innerHTML = ''
  cfg.options.forEach(o => {
    const opt = document.createElement('option')
    opt.value = o
    opt.textContent = o.toUpperCase()
    formatSelect.appendChild(opt)
  })
}

uploadBtn.addEventListener('click', () => fileInput.click())

folderCheckbox.addEventListener('change', () => {
  if (folderCheckbox.checked) {
    fileInput.setAttribute('webkitdirectory', '')
  } else {
    fileInput.removeAttribute('webkitdirectory')
  }
})

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFiles(fileInput.files)
})

function handleFiles(files) {
  clearStatus()

  currentFiles = Array.from(files)

  if (!folderCheckbox.checked && currentFiles.length > 1) {
    showError('Select only one file')
    return
  }

  if (folderCheckbox.checked) {
    convertCard.hidden = false
    showSuccess(`${currentFiles.length} files loaded`)
    return
  }

  currentFiles = [currentFiles[0]]
  filenameEl.textContent = currentFiles[0].name
  convertCard.hidden = false
  showSuccess(`Loaded: ${currentFiles[0].name}`)
}

dropZone.addEventListener('click', e => {
  if (e.target !== uploadBtn) fileInput.click()
})

convertBtn.addEventListener('click', async () => {
  if (!currentFiles.length) return

  convertBtn.disabled = true
  showProgress(10)
  showConverting(true)
  clearStatus()

  try {
    if (folderCheckbox.checked) {
      await convertFolder()
    } else {
      await convertSingle(currentFiles[0])
    }
  } catch (err) {
    showError(err.message)
  }

  convertBtn.disabled = false
  showConverting(false)
  setTimeout(hideProgress, 800)
})

async function convertSingle(file) {
  const fmt = formatSelect.value
  let blob

  if (activeType === 'image') blob = await convertImage(file, fmt)
  if (activeType === 'text') blob = await convertText(file, fmt)
  if (activeType === 'video') blob = await convertVideo(file, fmt)

  const base = file.name.replace(/\.[^/.]+$/, '')
  const name = `${base}.${fmt}`

  downloadBlob(blob, name)
  showSuccess('Converted!')
}

async function convertFolder() {
  const JSZip = window.JSZip
  const zip = new JSZip()

  const fmt = formatSelect.value

  for (let i = 0; i < currentFiles.length; i++) {
    const file = currentFiles[i]
    let blob

    if (activeType === 'image') blob = await convertImage(file, fmt)
    if (activeType === 'text') blob = await convertText(file, fmt)

    if (!blob) continue

    const base = file.name.replace(/\.[^/.]+$/, '')
    zip.file(`${base}.${fmt}`, blob)

    showProgress((i / currentFiles.length) * 100)
  }

  const content = await zip.generateAsync({ type: "blob" })

  downloadBlob(content, "converted.zip")
  showSuccess("Folder converted")
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function showError(msg) {
  uploadStatusEl.textContent = msg
  uploadStatusEl.className = 'status-message error'
}

function showSuccess(msg) {
  uploadStatusEl.textContent = msg
  uploadStatusEl.className = 'status-message success'
}

function clearStatus() {
  uploadStatusEl.textContent = ''
  uploadStatusEl.className = 'status-message'
}

function showProgress(v) {
  progressBar.value = v
  progressBar.classList.add('visible')
}

function hideProgress() {
  progressBar.classList.remove('visible')
  progressBar.value = 0
}

function showConverting(on) {
  convertingLabel.classList.toggle('visible', on)
}

function convertImage(file, type) {
  return new Promise((res, rej) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')

      if (type === 'jpeg' || type === 'bmp') {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      ctx.drawImage(img, 0, 0)

      canvas.toBlob(b => {
        if (!b) rej(new Error('Image error'))
        else res(b)
      }, `image/${type}`, 0.92)

      URL.revokeObjectURL(url)
    }

    img.onerror = () => rej(new Error('Load error'))
    img.src = url
  })
}

async function convertText(file, fmt) {
  const text = await file.text()

  if (fmt === 'txt') return new Blob([text], { type: 'text/plain' })

  if (fmt === 'md') return new Blob([text], { type: 'text/markdown' })

  if (fmt === 'html') {
    return new Blob([`<pre>${text}</pre>`], { type: 'text/html' })
  }

  if (fmt === 'json') {
    try {
      return new Blob([JSON.stringify(JSON.parse(text), null, 2)], { type: 'application/json' })
    } catch {
      return new Blob([text], { type: 'application/json' })
    }
  }

  return new Blob([text], { type: 'text/plain' })
}

function convertVideo(file, fmt) {
  return Promise.resolve(file)
}

function change_about() {
  const about = document.getElementById('about')
  about.style.display = about.style.display === 'none' ? 'flex' : 'none'
}

applyTypeConfig(activeType)