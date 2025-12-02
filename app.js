// Storage keys
const TEXTS_KEY = 'speedread_texts_v1';
const SETTINGS_KEY = 'speedread_settings_v1';

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
const downloadText = document.getElementById('downloadText');
const savedList = document.getElementById('savedList');

// State
let words = [];
let index = 0;
let timer = null;
let playing = false;
let settings = {
  size: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--size')) || 72,
  wpm: 300,
  bg: '#111111',
  fg: '#ffffff'
};

// Helpers
function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
function loadSettings(){
  const s = localStorage.getItem(SETTINGS_KEY);
  if(s){
    try{Object.assign(settings, JSON.parse(s));}catch(e){}
  }
  applySettingsToUI();
  applySettingsToUIVars();
}

function applySettingsToUI(){
  sizeRange.value = settings.size; sizeNumber.value = settings.size;
  wpmRange.value = settings.wpm; wpmNumber.value = settings.wpm;
  bgColor.value = settings.bg; fgColor.value = settings.fg;
}
function applySettingsToUIVars(){
  document.documentElement.style.setProperty('--size', settings.size + 'px');
  document.documentElement.style.setProperty('--bg', settings.bg);
  document.documentElement.style.setProperty('--fg', settings.fg);
  viewer.style.background = settings.bg;
  wordEl.style.color = settings.fg;
}

function msFromWpm(wpm){
  if(!wpm || wpm <= 0) return 60000 * 60 * 24; // effectively pause when WPM is 0 (very large interval)
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

// Load texts
function loadSavedTexts(){
  const raw = localStorage.getItem(TEXTS_KEY);
  try{return raw ? JSON.parse(raw) : [];}catch(e){return []}
}
function saveSavedTexts(list){
  localStorage.setItem(TEXTS_KEY, JSON.stringify(list));
}

function renderSavedList(){
  const arr = loadSavedTexts();
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
    const delBtn = document.createElement('button'); delBtn.textContent='Delete'; delBtn.className='small-btn btn'; delBtn.onclick = ()=>{ if(confirm('Delete this saved text?')){ const next = arr.filter(x=>x.id!==item.id); saveSavedTexts(next); renderSavedList(); }};
            right.appendChild(loadBtn); right.appendChild(loadViewerBtn); right.appendChild(dlSavedBtn); right.appendChild(delBtn);
    el.appendChild(left); el.appendChild(right); savedList.appendChild(el);
  })
}

function loadToViewer(item){
  // apply settings saved with text if present
  if(item.settings){ Object.assign(settings, item.settings); applySettingsToUI(); applySettingsToUIVars(); saveSettings(); }
  const content = (item.content || '').trim();
  words = content.split(/\s+/).filter(Boolean);
  index = 0; pause(); wordEl.textContent = words[0] || '';
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

// Keyboard accessibility: Space toggles play/pause, Escape closes modals
document.addEventListener('keydown', (e)=>{
  // If focus is on an input/textarea or a contentEditable element, don't intercept keys
  const tgt = e.target;
  if(tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)){
    return; // allow normal typing (including Space) inside form controls
  }

  if(e.code === 'Space'){
    // prevent page scroll when toggling
    e.preventDefault();
    toggle();
  } else if(e.key === 'Escape'){
    if(settingsModal.style.display === 'flex'){ settingsModal.style.display = 'none'; saveSettings(); }
    if(textsModal.style.display === 'flex'){ textsModal.style.display = 'none'; }
  }
});

sizeRange.addEventListener('input', (e)=>{ settings.size = parseInt(e.target.value); sizeNumber.value = settings.size; applySettingsToUIVars(); saveSettings(); });
sizeNumber.addEventListener('input', (e)=>{ settings.size = parseInt(e.target.value)||24; sizeRange.value = settings.size; applySettingsToUIVars(); saveSettings(); });

wpmRange.addEventListener('input', (e)=>{ settings.wpm = parseInt(e.target.value); wpmNumber.value = settings.wpm; saveSettings(); if(playing){pause(); start()} });
wpmNumber.addEventListener('input', (e)=>{ settings.wpm = parseInt(e.target.value)||0; wpmRange.value = settings.wpm; saveSettings(); if(playing){pause(); start()} });

bgColor.addEventListener('input', (e)=>{ settings.bg = e.target.value; applySettingsToUIVars(); saveSettings(); });
fgColor.addEventListener('input', (e)=>{ settings.fg = e.target.value; applySettingsToUIVars(); saveSettings(); });

textsBtn.addEventListener('click', ()=>{ textsModal.style.display='flex'; renderSavedList(); });
textsClose.addEventListener('click', ()=>{ textsModal.style.display='none'; });

saveText.addEventListener('click', ()=>{
  const content = textInput.value.trim(); if(!content){alert('Enter some text first'); return}
  const arr = loadSavedTexts();
  const id = Date.now()+Math.random();
  const title = (textTitle.value || content.slice(0,60)).trim();
  arr.unshift({id,title,content,settings:{...settings}});
  saveSavedTexts(arr);
  renderSavedList();
  alert('Saved');
});

loadTextToViewer.addEventListener('click', ()=>{
  const content = textInput.value.trim(); if(!content){alert('No text to load'); return}
  words = content.split(/\s+/).filter(Boolean); index = 0; pause(); wordEl.textContent = words[0] || ''; textsModal.style.display='none';
});

// Download current textarea content as .txt
downloadText.addEventListener('click', ()=>{
  const content = textInput.value.trim(); if(!content){alert('No text to download'); return}
  const filename = (textTitle.value || ('text-'+(new Date().toISOString().slice(0,10)))).replace(/[^\w\- ]+/g,'').slice(0,50) || 'text';
  const blob = new Blob([content], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename + '.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// Export/Import backup functions
function exportBackup(){
  const texts = loadSavedTexts();
  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    texts: texts
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'speedread-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  alert('Backup exported successfully!');
}

function importBackup(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const backup = JSON.parse(e.target.result);
      if(!backup.texts || !Array.isArray(backup.texts)){
        alert('Invalid backup file format');
        return;
      }
      const currentTexts = loadSavedTexts();
      const merged = [...backup.texts, ...currentTexts];
      saveSavedTexts(merged);
      renderSavedList();
      alert('Backup imported! ' + backup.texts.length + ' text(s) added.');
      document.getElementById('importFile').value = '';
    }catch(err){
      alert('Error reading backup file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// Hook up export/import buttons
const exportBackupBtn = document.getElementById('exportBackup');
const importBackupBtn = document.getElementById('importBackup');
const importFile = document.getElementById('importFile');

if(exportBackupBtn) exportBackupBtn.addEventListener('click', exportBackup);
if(importBackupBtn) importBackupBtn.addEventListener('click', ()=>{ importFile.click(); });
if(importFile) importFile.addEventListener('change', (e)=>{ importBackup(e.target.files[0]); });

// Init
loadSettings();
renderSavedList();

// Provide a helpful sample if empty
if(!localStorage.getItem(TEXTS_KEY)){
  const sample = `This is a SpeedRead demo. Click the screen to play and tap again to pause. Use the settings to change speed and font size.`;
  textInput.value = sample; textTitle.value = 'Demo sample';
}

// Save settings periodically (or on unload)
window.addEventListener('beforeunload', ()=>{ saveSettings(); });

// expose for console debugging
window.speedread = {loadSavedTexts, saveSavedTexts, settings, loadToViewer, exportBackup, importBackup};
