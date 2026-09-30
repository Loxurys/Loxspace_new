const video = document.querySelector('#video');
const stage = document.querySelector('#stage');
const cameraSelect = document.querySelector('#cameraSelect');
const statusText = document.querySelector('#cameraStatus');
const startButton = document.querySelector('#startButton');
const overlayTitle = document.querySelector('#overlayTitle');
const overlayText = document.querySelector('#overlayText');
const captureButton = document.querySelector('#captureButton');
const flipButton = document.querySelector('#flipButton');
const previewImage = document.querySelector('#previewImage');
const captureCanvas = document.querySelector('#captureCanvas');
const stripCanvas = document.querySelector('#stripCanvas');
const photosNode = document.querySelector('#stripPhotos');
const stripEmpty = document.querySelector('#stripEmpty');
const timerSelect = document.querySelector('#timerSelect');
const advancedControls = document.querySelector('#advancedControls');
const countdown = document.querySelector('#countdown');
const photos = [];
const filters = { none: '', mono: 'grayscale(1)', warm: 'sepia(.45) saturate(1.2)', cool: 'hue-rotate(175deg) saturate(.7)' };
let currentFilter = 'none';
let stream = null;
let preferredFacing = 'user';
let previewMode = false;
let mirrorCapture = true;
let shotsTarget = 4;
let replaceIndex = null;
let shootingMode = 'manual';
let autoRunning = false;

function setStatus(on, message) {
  statusText.textContent = message;
  document.querySelector('.live-dot').classList.toggle('on', on);
}

async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === 'videoinput');
  const selected = cameraSelect.value;
  cameraSelect.replaceChildren();
  cameras.forEach((camera, index) => {
    const option = document.createElement('option');
    option.value = camera.deviceId;
    option.textContent = camera.label || `Kamera ${index + 1}`;
    cameraSelect.append(option);
  });
  if (selected && cameras.some((d) => d.deviceId === selected)) cameraSelect.value = selected;
  cameraSelect.disabled = cameras.length < 2 || !stream;
}

async function startCamera(deviceId = '') {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError('Browser ini belum support kamera. Coba Chrome, Safari, atau Edge versi terbaru.');
    return;
  }
  try {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    const videoConstraint = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: preferredFacing } };
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...videoConstraint, width: { ideal: 1280 }, height: { ideal: 960 } } });
    mirrorCapture = stream.getVideoTracks()[0]?.getSettings().facingMode === 'user';
    video.srcObject = stream;
    await video.play();
    previewMode = false;
    stage.classList.remove('has-preview');
    stage.classList.add('has-video');
    captureButton.disabled = false;
    flipButton.disabled = false;
    cameraSelect.disabled = false;
    document.querySelector('#captureHint').textContent = 'Klik tombol tengah buat jepret · 4 foto per strip';
    setStatus(true, 'KAMERA AKTIF');
    await listCameras();
    if (deviceId) cameraSelect.value = deviceId;
    updateZoomControl();
  } catch (error) {
    let message = 'Kamera nggak bisa dibuka. Cek izin browser atau pilih kamera lain.';
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') message = 'Izin kamera ditolak. Ubah permission situs di pengaturan browser, lalu coba lagi.';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') message = 'Kamera itu nggak ketemu. Coba pilih perangkat lain.';
    showCameraError(message);
  }
}

function showCameraError(message) {
  stage.classList.remove('has-video', 'has-preview');
  overlayTitle.textContent = 'Belum bisa akses kamera';
  overlayText.textContent = message;
  startButton.textContent = 'COBA LAGI  ↗';
  startButton.style.display = 'flex';
  setStatus(false, 'KAMERA OFFLINE');
}

function activeFilter() { return filters[currentFilter] || ''; }

function drawPhotoOverlay(ctx, width, height, shotNumber) {
  const unit = Math.min(width, height);
  const inset = unit * 0.05;
  const arm = unit * 0.05;
  const right = width - inset;
  const bottom = height - inset;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.82)';
  ctx.lineWidth = Math.max(2, unit * 0.0025);
  ctx.lineCap = 'square';
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = unit * 0.008;
  ctx.beginPath();
  ctx.moveTo(inset, inset + arm); ctx.lineTo(inset, inset); ctx.lineTo(inset + arm, inset);
  ctx.moveTo(right - arm, inset); ctx.lineTo(right, inset); ctx.lineTo(right, inset + arm);
  ctx.moveTo(inset, bottom - arm); ctx.lineTo(inset, bottom); ctx.lineTo(inset + arm, bottom);
  ctx.moveTo(right - arm, bottom); ctx.lineTo(right, bottom); ctx.lineTo(right, bottom - arm);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.84)';
  ctx.font = `500 ${Math.round(unit * 0.022)}px "DM Mono", monospace`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText(`SHOT ${String(shotNumber).padStart(2, '0')} / ${String(shotsTarget).padStart(2, '0')}`, inset, height - inset * 0.32);
  ctx.textAlign = 'right';
  ctx.fillText('FLASH CAM™', right, height - inset * 0.32);
  ctx.restore();
}

function flashCapture() {
  stage.classList.remove('flash');
  void stage.offsetWidth;
  stage.classList.add('flash');
  setTimeout(() => stage.classList.remove('flash'), 240);
  if ('vibrate' in navigator) navigator.vibrate(18);
}

async function capture() {
  if (!stream || (photos.length >= shotsTarget && replaceIndex === null)) return;
  const seconds = Number(timerSelect.value);
  captureButton.disabled = true;
  document.querySelector('#manualMode').disabled = true;
  document.querySelector('#autoMode').disabled = true;
  if (seconds > 0) {
    for (let i = seconds; i > 0; i--) {
      countdown.textContent = i;
      countdown.classList.add('show');
      if ('vibrate' in navigator) navigator.vibrate(35);
      await new Promise((resolve) => setTimeout(resolve, 850));
      countdown.classList.remove('show');
    }
    countdown.textContent = '✳';
    countdown.classList.add('show');
    await new Promise((resolve) => setTimeout(resolve, 250));
    countdown.classList.remove('show');
  }
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 960;
  captureCanvas.width = width;
  captureCanvas.height = height;
  const ctx = captureCanvas.getContext('2d');
  ctx.save();
  if (mirrorCapture) { ctx.translate(width, 0); ctx.scale(-1, 1); }
  ctx.filter = activeFilter();
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();
  const shotNumber = replaceIndex !== null ? replaceIndex + 1 : photos.length + 1;
  flashCapture();
  drawPhotoOverlay(ctx, width, height, shotNumber);
  const image = captureCanvas.toDataURL('image/jpeg', .94);
  if (replaceIndex !== null) {
    photos[replaceIndex] = image;
    replaceIndex = null;
    document.querySelector('#captureHint').textContent = 'Foto diganti. Tap foto lain buat retake.';
  } else photos.push(image);
  playShutter();
  renderPhotos();
  if (photos.length === shotsTarget) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
    stage.classList.remove('has-video');
    stage.classList.add('has-preview');
    previewImage.src = photos[photos.length - 1];
    previewMode = true;
    captureButton.disabled = true;
    flipButton.disabled = true;
    cameraSelect.disabled = true;
    setStatus(false, 'SESI SELESAI');
    document.querySelector('#captureHint').textContent = 'Sesi selesai · tap foto buat retake atau download strip.';
  } else captureButton.disabled = false;
  if (!autoRunning) {
    document.querySelector('#manualMode').disabled = false;
    document.querySelector('#autoMode').disabled = false;
  }
}

function renderPhotos() {
  photosNode.replaceChildren();
  const layout = document.querySelector('#layoutSelect').value;
  const skin = document.querySelector('#skinSelect').value;
  photosNode.className = `strip-photos layout-${layout}`;
  document.querySelector('#stripCard').dataset.skin = skin;
  document.querySelector('#stripFooter').textContent = document.querySelector('#captionInput').value.trim() || 'FLASH BOOTH';
  photos.forEach((src, index) => {
    const tile = document.createElement('button');
    tile.className = `strip-tile${replaceIndex === index ? ' replacing' : ''}`;
    tile.type = 'button';
    tile.title = `Tap buat retake foto ${index + 1}`;
    const img = document.createElement('img');
    img.className = 'strip-photo';
    img.src = src;
    img.alt = `Foto ${index + 1}`;
    const badge = document.createElement('span');
    badge.textContent = `0${index + 1} · RETAKE`;
    tile.append(img, badge);
    tile.addEventListener('click', () => retakePhoto(index));
    photosNode.append(tile);
  });
  stripEmpty.style.display = photos.length ? 'none' : 'flex';
  document.querySelector('#counter').textContent = `${photos.length}/${shotsTarget}`;
  document.querySelector('#shotCount').textContent = `SHOT ${String(photos.length).padStart(2, '0')} / ${String(shotsTarget).padStart(2, '0')}`;
  document.querySelector('#downloadButton').disabled = photos.length !== shotsTarget;
  document.querySelector('#resetButton').disabled = photos.length === 0;
  document.querySelector('#stripDate').textContent = photos.length ? new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
}

async function drawStrip() {
  const margin = 28;
  const gap = 12;
  const layout = document.querySelector('#layoutSelect').value;
  const columns = layout === 'grid' ? 2 : 1;
  const rows = Math.ceil(photos.length / columns);
  const photoWidth = 480;
  const photoHeight = 360;
  stripCanvas.width = photoWidth * columns + gap * (columns - 1) + margin * 2;
  stripCanvas.height = photoHeight * rows + gap * (rows - 1) + margin * 2 + 88;
  const ctx = stripCanvas.getContext('2d');
  const skins = { cream: ['#fffefa', '#171716', '#85847c'], pink: ['#ffd9e4', '#702b47', '#a64f70'], dark: ['#19191d', '#fff7e8', '#aaa6b1'], blue: ['#d5f2ef', '#145b68', '#43848c'] };
  const [paper, ink, muted] = skins[document.querySelector('#skinSelect').value] || skins.cream;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
  const images = await Promise.all(photos.map((src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  })));
  images.forEach((img, index) => {
    const x = margin + (index % columns) * (photoWidth + gap);
    const y = margin + Math.floor(index / columns) * (photoHeight + gap);
    const boxWidth = photoWidth;
    const targetRatio = boxWidth / photoHeight;
    const sourceRatio = img.width / img.height;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (sourceRatio > targetRatio) {
      sw = img.height * targetRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / targetRatio;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, boxWidth, photoHeight);
    const sticker = document.querySelector('#stickerSelect').value;
    if (sticker) {
      ctx.font = '52px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(sticker, x + boxWidth - 15, y + 58);
    }
  });
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(document.querySelector('#captionInput').value.trim() || 'FLASH PHOTO BOOTH', margin, stripCanvas.height - 42);
  ctx.fillStyle = muted;
  ctx.font = '14px monospace';
  ctx.fillText(`${photos.length} FRAMES  ·  ${new Date().toLocaleDateString('id-ID')}  ·  FLASH BOOTH`, margin, stripCanvas.height - 17);
}

async function downloadStrip() {
  if (photos.length !== shotsTarget) return;
  await drawStrip();
  const link = document.createElement('a');
  link.download = 'flash-photo-strip.png';
  link.href = stripCanvas.toDataURL('image/png');
  link.click();
}

function resetSession() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  photos.length = 0;
  replaceIndex = null;
  previewImage.removeAttribute('src');
  stage.classList.remove('has-preview');
  renderPhotos();
  startCamera();
}

function setShootingMode(mode) {
  shootingMode = mode;
  document.querySelector('#manualMode').classList.toggle('active', mode === 'manual');
  document.querySelector('#autoMode').classList.toggle('active', mode === 'auto');
  document.querySelector('#manualMode').setAttribute('aria-pressed', String(mode === 'manual'));
  document.querySelector('#autoMode').setAttribute('aria-pressed', String(mode === 'auto'));
  document.querySelector('#captureButton').setAttribute('aria-label', mode === 'auto' ? 'Mulai sesi otomatis empat foto' : 'Ambil satu foto');
  document.querySelector('#captureHint').textContent = mode === 'auto'
    ? 'Auto · countdown tiap foto · 4 jepretan berurutan'
    : 'Manual · shutter sekali untuk satu foto';
}

async function runAutoSession() {
  if (autoRunning) return;
  if (photos.length >= 4) {
    photos.length = 0;
    renderPhotos();
    if (!stream) await startCamera();
  }
  shotsTarget = 4;
  document.querySelector('#sessionSelect').value = '4';
  if (!stream) await startCamera();
  if (!stream) return;
  autoRunning = true;
  document.querySelector('#manualMode').disabled = true;
  document.querySelector('#autoMode').disabled = true;
  document.querySelector('#sessionSelect').disabled = true;
  captureButton.disabled = true;
  while (photos.length < 4 && stream) {
    document.querySelector('#captureHint').textContent = `AUTO · FOTO ${photos.length + 1} DARI 4 · SIAP POSE`;
    await capture();
    if (photos.length < 4 && stream) await new Promise((resolve) => setTimeout(resolve, 450));
  }
  autoRunning = false;
  document.querySelector('#manualMode').disabled = false;
  document.querySelector('#autoMode').disabled = false;
  document.querySelector('#sessionSelect').disabled = false;
  document.querySelector('#captureHint').textContent = photos.length === 4
    ? 'Sesi Auto kelar · tap foto buat retake atau download strip.'
    : 'Auto berhenti · cek kamera, lalu coba lagi.';
}

function handleShutter() {
  if (shootingMode === 'auto') return runAutoSession();
  return capture();
}

async function retakePhoto(index) {
  if (!photos[index]) return;
  if (replaceIndex === index) {
    replaceIndex = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    stage.classList.remove('has-video');
    stage.classList.add('has-preview');
    previewImage.src = photos.at(-1);
    captureButton.disabled = true;
    flipButton.disabled = true;
    cameraSelect.disabled = true;
    document.querySelector('#captureHint').textContent = 'Retake dibatalin.';
    setStatus(false, 'SESI SELESAI');
    renderPhotos();
    return;
  }
  if (replaceIndex !== null) return;
  setShootingMode('manual');
  replaceIndex = index;
  document.querySelector('#captureHint').textContent = `Retake foto ${index + 1} · pencet shutter buat ganti, atau tap fotonya lagi buat batal.`;
  renderPhotos();
  await startCamera();
}

function playShutter() {
  if (!document.querySelector('#soundToggle').checked) return;
  try {
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(180, audio.currentTime + .09);
    gain.gain.setValueAtTime(.12, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .1);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + .1);
    oscillator.onended = () => audio.close();
  } catch {}
}

function updateZoomControl() {
  const track = stream?.getVideoTracks()[0];
  const zoom = track?.getCapabilities?.().zoom;
  const control = document.querySelector('#zoomControl');
  if (!zoom) { control.hidden = true; return; }
  const range = document.querySelector('#zoomRange');
  range.min = zoom.min;
  range.max = zoom.max;
  range.step = zoom.step || .1;
  range.value = track.getSettings().zoom || zoom.min;
  document.querySelector('#zoomValue').textContent = `${Number(range.value).toFixed(1)}×`;
  control.hidden = false;
}

startButton.addEventListener('click', () => { startButton.style.display = 'none'; startCamera(cameraSelect.value); });
captureButton.addEventListener('click', handleShutter);
document.querySelector('#manualMode').addEventListener('click', () => setShootingMode('manual'));
document.querySelector('#autoMode').addEventListener('click', () => {
  if (shotsTarget !== 4 && photos.length) {
    photos.length = 0;
    renderPhotos();
  }
  setShootingMode('auto');
  shotsTarget = 4;
  document.querySelector('#sessionSelect').value = '4';
  if (timerSelect.value === '0') timerSelect.value = '3';
  document.querySelector('#counter').textContent = `${photos.length}/4`;
  document.querySelector('#shotCount').textContent = `SHOT ${String(photos.length).padStart(2, '0')} / 04`;
  document.querySelector('#downloadButton').disabled = photos.length !== 4;
});
cameraSelect.addEventListener('change', () => startCamera(cameraSelect.value));
flipButton.addEventListener('click', async () => {
  preferredFacing = preferredFacing === 'user' ? 'environment' : 'user';
  cameraSelect.value = '';
  await startCamera();
});
document.querySelectorAll('.filter-option').forEach((button) => button.addEventListener('click', () => {
  currentFilter = button.dataset.filter;
  video.style.filter = activeFilter();
  document.querySelectorAll('.filter-option').forEach((item) => item.classList.toggle('active', item === button));
}));
document.querySelector('#downloadButton').addEventListener('click', downloadStrip);
document.querySelector('#resetButton').addEventListener('click', resetSession);
document.querySelector('#sessionSelect').addEventListener('change', (event) => {
  setShootingMode('manual');
  shotsTarget = Number(event.target.value);
  document.querySelector('#captureHint').textContent = `Mode ${shotsTarget} foto · sesi di-reset`;
  resetSession();
});
document.querySelector('#zoomRange').addEventListener('input', async (event) => {
  const zoom = Number(event.target.value);
  document.querySelector('#zoomValue').textContent = `${zoom.toFixed(1)}×`;
  try { await stream?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ zoom }] }); } catch {}
});
document.querySelector('#layoutSelect').addEventListener('change', renderPhotos);
document.querySelector('#skinSelect').addEventListener('change', renderPhotos);
document.querySelector('#stickerSelect').addEventListener('change', renderPhotos);
document.querySelector('#captionInput').addEventListener('input', renderPhotos);
document.addEventListener('keydown', (event) => {
  const editing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (event.code === 'Space' && !editing && !captureButton.disabled) { event.preventDefault(); handleShutter(); }
});
if (navigator.mediaDevices?.addEventListener) navigator.mediaDevices.addEventListener('devicechange', listCameras);
if (window.matchMedia('(max-width: 680px)').matches) advancedControls.open = false;
window.addEventListener('pagehide', () => stream?.getTracks().forEach((track) => track.stop()));
document.querySelector('#stripDate').textContent = '';
