// Storage keys
const TEXTS_KEY = 'speedread_texts_v1';
const SETTINGS_KEY = 'speedread_settings_v1';
const DB_NAME = 'SpeedReadDB';
const DB_VERSION = 1;
const TEXTS_STORE = 'texts';
const SETTINGS_STORE = 'settings';

let db = null;

// IndexedDB initialization
function initDB(){
  return new Promise((resolve, reject)=>{
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = ()=> reject(request.error);
    request.onsuccess = ()=> {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e)=>{
      db = e.target.result;
      if(!db.objectStoreNames.contains(TEXTS_STORE)){
        db.createObjectStore(TEXTS_STORE, {keyPath:'id'});
      }
      if(!db.objectStoreNames.contains(SETTINGS_STORE)){
        db.createObjectStore(SETTINGS_STORE, {keyPath:'key'});
      }
    };
  });
}

// Helper to get IndexedDB transaction
function getTx(storeName, mode='readonly'){
  if(!db) return null;
  return db.transaction(storeName, mode).objectStore(storeName);
}

// Helper to convert IndexedDB request to promise
function promisify(req){
  return new Promise((resolve, reject)=>{
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

// Elements
const viewer = document.getElementById('viewer');
const wordEl = document.getElementById('word');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsClose = document.getElementById('settingsClose');
const sizeRange = document.getElementById('sizeRange');
const sizeNumber = document.getElementById('sizeNumber');
const wpmRange = document.getElementById('wpmRange');
const wpmNumber = document.getElementById('wpmNumber');
const bgColor = document.getElementById('bgColor');
const fgColor = document.getElementById('fgColor');

const textsBtn = document.getElementById('textsBtn');
const textsModal = document.getElementById('textsModal');
const textsClose = document.getElementById('textsClose');
const textInput = document.getElementById('textInput');
const textTitle = document.getElementById('textTitle');
const saveText = document.getElementById('saveText');
const loadTextToViewer = document.getElementById('loadTextToViewer');
const autoShuffle = document.getElementById('autoShuffle');
const downloadText = document.getElementById('downloadText');
const savedList = document.getElementById('savedList');

// Feedback buttons
const correctBtn = document.getElementById('correctBtn');
const wrongBtn = document.getElementById('wrongBtn');
const emojiCountRange = document.getElementById('emojiCountRange');
const emojiCountNumber = document.getElementById('emojiCountNumber');
const emojiSizeRange = document.getElementById('emojiSizeRange');
const emojiSizeNumber = document.getElementById('emojiSizeNumber');

// State
let words = [];
let index = 0;
let timer = null;
let playing = false;
let settings = {
  size: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--size')) || 72,
  wpm: 300,
  bg: '#111111',
  fg: '#ffffff',
  emojiCount: 3,
  emojiSize: 48,
  autoShuffle: false
};

// Helpers
async function saveSettings(){
  if(!db) return;
  const tx = getTx(SETTINGS_STORE, 'readwrite');
  await promisify(tx.put({key:SETTINGS_KEY, value:settings}));
}

async function loadSettings(){
  if(!db) return;
  try{
    const tx = getTx(SETTINGS_STORE, 'readonly');
    const result = await promisify(tx.get(SETTINGS_KEY));
    if(result && result.value){
      Object.assign(settings, result.value);
    }
  }catch(e){}
  applySettingsToUI();
  applySettingsToUIVars();
}

function applySettingsToUI(){
  sizeRange.value = settings.size; sizeNumber.value = settings.size;
  wpmRange.value = settings.wpm; wpmNumber.value = settings.wpm;
  bgColor.value = settings.bg; fgColor.value = settings.fg;
  emojiCountRange.value = settings.emojiCount; emojiCountNumber.value = settings.emojiCount;
  emojiSizeRange.value = settings.emojiSize; emojiSizeNumber.value = settings.emojiSize;
  if(autoShuffle) autoShuffle.checked = !!settings.autoShuffle;
}
function applySettingsToUIVars(){
  document.documentElement.style.setProperty('--size', settings.size + 'px');
  document.documentElement.style.setProperty('--bg', settings.bg);
  document.documentElement.style.setProperty('--fg', settings.fg);
  viewer.style.background = settings.bg;
  wordEl.style.color = settings.fg;
}

function msFromWpm(wpm){
  if(!wpm || wpm <= 0) return 60000 * 60 * 24;
  return Math.max(10, Math.round(60000 / wpm));
}

function start(){
  if(playing) return;
  if(words.length === 0) return;
  if(settings.wpm <= 0){ pause(); updateViewerState(); return; }
  playing = true;
  tick();
  timer = setInterval(tick, msFromWpm(settings.wpm));
}
function pause(){
  playing = false;
  if(timer){clearInterval(timer); timer=null}
}
function toggle(){
  if(playing) pause(); else start();
  updateViewerState();
}

function tick(){
  if(index >= words.length){pause(); index = 0; return}
  wordEl.textContent = words[index] || '';
  index++;
}

function updateViewerState(){
  viewer.setAttribute('data-playing', playing? '1':'0');
}

// Load texts from IndexedDB
async function loadSavedTexts(){
  if(!db) return [];
  try{
    const tx = getTx(TEXTS_STORE, 'readonly');
    const allRecords = await promisify(tx.getAll());
    return allRecords.sort((a,b)=> (b.id || 0) - (a.id || 0));
  }catch(e){
    return [];
  }
}

async function saveSavedTexts(list){
  if(!db) return;
  try{
    const tx = getTx(TEXTS_STORE, 'readwrite');
    await promisify(tx.clear());
    for(let item of list){
      await promisify(tx.put(item));
    }
  }catch(e){}
}

async function renderSavedList(){
  const arr = await loadSavedTexts();
  savedList.innerHTML = '';
  if(arr.length===0){savedList.innerHTML = '<div class="tiny">No saved texts</div>'; return}
  arr.forEach(item=>{
    const el = document.createElement('div'); el.className='saved-item';
    const left = document.createElement('div'); left.style.flex='1'; left.style.marginRight='8px'; left.innerHTML = '<strong>'+escapeHtml(item.title||item.content.slice(0,60))+'</strong><div class="tiny">'+(item.settings? 'Saved with settings':'')+'</div>';
    const right = document.createElement('div');
    const loadBtn = document.createElement('button'); loadBtn.textContent='Load'; loadBtn.className='small-btn btn'; loadBtn.onclick = ()=>{ textInput.value = item.content; textTitle.value = item.title || ''; };
        const dlSavedBtn = document.createElement('button'); dlSavedBtn.textContent='Download'; dlSavedBtn.className='small-btn btn'; dlSavedBtn.onclick = ()=>{
          const filename = (item.title || ('text-'+(new Date(item.id).toISOString().slice(0,10)))).replace(/[^\w\- ]+/g,'').slice(0,50) || 'text';
          const blob = new Blob([item.content], {type:'text/plain;charset=utf-8'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = filename + '.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        };
    const loadViewerBtn = document.createElement('button'); loadViewerBtn.textContent='Open'; loadViewerBtn.className='small-btn btn'; loadViewerBtn.onclick = ()=>{ loadToViewer(item); textsModal.style.display='none'; };
    const delBtn = document.createElement('button'); delBtn.textContent='Delete'; delBtn.className='small-btn btn'; delBtn.onclick = async ()=>{ if(confirm('Delete this saved text?')){ const next = arr.filter(x=>x.id!==item.id); await saveSavedTexts(next); renderSavedList(); }};
    right.appendChild(loadBtn); right.appendChild(loadViewerBtn); right.appendChild(dlSavedBtn); right.appendChild(delBtn);
    el.appendChild(left); el.appendChild(right); savedList.appendChild(el);
  })
}

function loadToViewer(item){
  if(item.settings){ Object.assign(settings, item.settings); applySettingsToUI(); applySettingsToUIVars(); saveSettings(); }
  const content = (item.content || '').trim();
  words = content.split(/\s+/).filter(Boolean);
  index = 0; pause(); wordEl.textContent = words[0] || '';
}

// Emoji animation and sound effects
function showFloatingEmojis(emoji, count=null){
  if(count === null) count = settings.emojiCount;
  for(let i=0; i<count; i++){
    setTimeout(()=>{
      const el = document.createElement('div');
      el.className = 'floating-emoji';
      el.textContent = emoji;
      el.style.fontSize = settings.emojiSize + 'px';
      el.style.left = Math.random()*80 + 10 + '%';
      el.style.top = Math.random()*30 + 50 + '%';
      document.body.appendChild(el);
      setTimeout(()=> el.remove(), 1500);
    }, i*100);
  }
}

function playSound(type){
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  if(type === 'correct'){
    // Popular "ding" sound - like game show correct answer
    // Creates uplifting, happy tone
    
    // Main ding tone - bright and cheerful
    const ding = audioCtx.createOscillator();
    const dingGain = audioCtx.createGain();
    ding.type = 'sine';
    ding.frequency.setValueAtTime(1046.50, audioCtx.currentTime); // C6 note
    ding.connect(dingGain);
    dingGain.connect(audioCtx.destination);
    dingGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    dingGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    ding.start(audioCtx.currentTime);
    ding.stop(audioCtx.currentTime + 0.4);
    
    // Second harmonic for fullness
    const ding2 = audioCtx.createOscillator();
    const ding2Gain = audioCtx.createGain();
    ding2.type = 'sine';
    ding2.frequency.value = 1046.50 * 1.5; // +perfect fifth
    ding2.connect(ding2Gain);
    ding2Gain.connect(audioCtx.destination);
    ding2Gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    ding2Gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    ding2.start(audioCtx.currentTime);
    ding2.stop(audioCtx.currentTime + 0.35);
    
    // Bright chime with triangle wave
    const chime = audioCtx.createOscillator();
    const chimeGain = audioCtx.createGain();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(2093, audioCtx.currentTime); // C7 - one octave higher
    chime.connect(chimeGain);
    chimeGain.connect(audioCtx.destination);
    chimeGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    chime.start(audioCtx.currentTime);
    chime.stop(audioCtx.currentTime + 0.3);
    
  } else if(type === 'wrong'){
    // Popular "buzzer" sound - like wrong answer in game show
    // Creates attention-grabbing, negative tone
    
    // Low buzzer tone
    const buzz = audioCtx.createOscillator();
    const buzzGain = audioCtx.createGain();
    buzz.type = 'square'; // Square wave for harsh buzzer sound
    buzz.frequency.setValueAtTime(200, audioCtx.currentTime);
    buzz.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.5);
    buzz.connect(buzzGain);
    buzzGain.connect(audioCtx.destination);
    buzzGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    buzzGain.gain.exponentialRampToValueAtTime(0.1, audioCtx.currentTime + 0.5);
    buzz.start(audioCtx.currentTime);
    buzz.stop(audioCtx.currentTime + 0.5);
    
    // Second layer - higher frequency buzz for richness
    const buzz2 = audioCtx.createOscillator();
    const buzz2Gain = audioCtx.createGain();
    buzz2.type = 'sawtooth'; // Sawtooth for harsher tone
    buzz2.frequency.setValueAtTime(300, audioCtx.currentTime);
    buzz2.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.5);
    buzz2.connect(buzz2Gain);
    buzz2Gain.connect(audioCtx.destination);
    buzz2Gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    buzz2Gain.gain.exponentialRampToValueAtTime(0.05, audioCtx.currentTime + 0.5);
    buzz2.start(audioCtx.currentTime);
    buzz2.stop(audioCtx.currentTime + 0.5);
    
    // Add some noise for classic buzzer feel
    const bufferSize = audioCtx.sampleRate * 0.5;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for(let i = 0; i < bufferSize; i++){
      const envelope = 1 - (i / bufferSize);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.15;
    noiseSource.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noiseSource.start(audioCtx.currentTime);
  }
}

// Utils
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))}

// Event wiring
// Use pointer events for responsive touch/mouse/pen support and faster response on mobile
viewer.addEventListener('pointerdown', (e)=>{
  if(e.target.closest('.panel') || e.target.closest('.btn') || e.target.closest('input')) return;
  toggle();
});

// Button listeners to open modals
settingsBtn.addEventListener('click', ()=>{ settingsModal.style.display='flex'; });
settingsClose.addEventListener('click', ()=>{ settingsModal.style.display='none'; saveSettings(); if(playing){pause(); start()} });

// Close modals when clicking the backdrop (outside the panel)
settingsModal.addEventListener('click', (e)=>{ if(e.target === settingsModal){ settingsModal.style.display='none'; saveSettings(); if(playing){pause(); start()} }});
textsModal.addEventListener('click', (e)=>{ if(e.target === textsModal){ textsModal.style.display='none'; }});

// Keyboard accessibility: Space toggles play/pause, Escape closes modals, +/- for feedback
document.addEventListener('keydown', (e)=>{
  const tgt = e.target;
  if(tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)){
    return;
  }
  if(e.code === 'Space'){
    e.preventDefault();
    toggle();
  } else if(e.key === 'Escape'){
    if(settingsModal.style.display === 'flex'){ settingsModal.style.display = 'none'; saveSettings(); }
    if(textsModal.style.display === 'flex'){ textsModal.style.display = 'none'; }
  } else if(e.key === '+' || e.key === '='){
    // "+" for correct (= key with shift on many keyboards)
    e.preventDefault();
    showFloatingEmojis('😊');
    playSound('correct');
  } else if(e.key === '-' || e.key === '_'){
    // "-" for wrong
    e.preventDefault();
    showFloatingEmojis('😢');
    playSound('wrong');
  }
});

sizeRange.addEventListener('input', (e)=>{ settings.size = parseInt(e.target.value); sizeNumber.value = settings.size; applySettingsToUIVars(); saveSettings(); });
sizeNumber.addEventListener('input', (e)=>{ settings.size = parseInt(e.target.value)||24; sizeRange.value = settings.size; applySettingsToUIVars(); saveSettings(); });

wpmRange.addEventListener('input', (e)=>{ settings.wpm = parseInt(e.target.value); wpmNumber.value = settings.wpm; saveSettings(); if(playing){pause(); start()} });
wpmNumber.addEventListener('input', (e)=>{ settings.wpm = parseInt(e.target.value)||0; wpmRange.value = settings.wpm; saveSettings(); if(playing){pause(); start()} });

bgColor.addEventListener('input', (e)=>{ settings.bg = e.target.value; applySettingsToUIVars(); saveSettings(); });
fgColor.addEventListener('input', (e)=>{ settings.fg = e.target.value; applySettingsToUIVars(); saveSettings(); });

emojiCountRange.addEventListener('input', (e)=>{ settings.emojiCount = parseInt(e.target.value); emojiCountNumber.value = settings.emojiCount; saveSettings(); });
emojiCountNumber.addEventListener('input', (e)=>{ settings.emojiCount = parseInt(e.target.value)||1; emojiCountRange.value = settings.emojiCount; saveSettings(); });

emojiSizeRange.addEventListener('input', (e)=>{ settings.emojiSize = parseInt(e.target.value); emojiSizeNumber.value = settings.emojiSize; saveSettings(); });
emojiSizeNumber.addEventListener('input', (e)=>{ settings.emojiSize = parseInt(e.target.value)||24; emojiSizeRange.value = settings.emojiSize; saveSettings(); });

if(autoShuffle){
  autoShuffle.addEventListener('change', (e)=>{ settings.autoShuffle = !!e.target.checked; saveSettings(); });
}

textsBtn.addEventListener('click', ()=>{ textsModal.style.display='flex'; renderSavedList(); });
textsClose.addEventListener('click', ()=>{ textsModal.style.display='none'; });

saveText.addEventListener('click', async ()=>{
  const content = textInput.value.trim(); if(!content){alert('Enter some text first'); return}
  const arr = await loadSavedTexts();
  const id = Date.now()+Math.random();
  const title = (textTitle.value || content.slice(0,60)).trim();
  arr.unshift({id,title,content,settings:{...settings}});
  await saveSavedTexts(arr);
  renderSavedList();
  alert('Saved');
});

loadTextToViewer.addEventListener('click', ()=>{
  const content = textInput.value.trim(); if(!content){alert('No text to load'); return}
  let arr = content.split(/\s+/).filter(Boolean);
  if(settings.autoShuffle){
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }
  words = arr; index = 0; pause(); wordEl.textContent = words[0] || ''; textsModal.style.display='none';
});

// (Manual shuffle button removed; use Auto-shuffle toggle or Load to Viewer)

// Download current textarea content as .txt
downloadText.addEventListener('click', ()=>{
  const content = textInput.value.trim(); if(!content){alert('No text to download'); return}
  const filename = (textTitle.value || ('text-'+(new Date().toISOString().slice(0,10)))).replace(/[^\w\- ]+/g,'').slice(0,50) || 'text';
  const blob = new Blob([content], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename + '.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// Feedback button listeners
correctBtn.addEventListener('click', ()=>{
  showFloatingEmojis('😊');
  playSound('correct');
});

wrongBtn.addEventListener('click', ()=>{
  showFloatingEmojis('😢');
  playSound('wrong');
});

// Init on page load with IndexedDB
(async ()=>{
  try{
    await initDB();
    await loadSettings();
    await renderSavedList();
    
    // Provide a helpful sample if empty
    const texts = await loadSavedTexts();
    if(texts.length === 0){
      const sample = `This is a SpeedRead demo. Click the screen to play and tap again to pause. Use the settings to change speed and font size.`;
      textInput.value = sample; 
      textTitle.value = 'Demo sample';
    }
  }catch(e){
    console.error('Failed to initialize IndexedDB:', e);
  }
})();

// Save settings on unload
window.addEventListener('beforeunload', ()=>{ saveSettings(); });

// expose for console debugging
window.speedread = {loadSavedTexts, saveSavedTexts, settings, loadToViewer, initDB};
