const CASE_INFO = {
  N: {label:"ناجح دور ثان", cls:"pass"},
  R: {label:"راسب دور ثان", cls:"fail"},
  A: {label:"غياب كلي دور ثان", cls:"absent"}
};

let records = [];      // {seat, name, degree, code}
let seatIndex = new Map();
let ready = false;

const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const qEl = document.getElementById('q');
const goBtn = document.getElementById('go');

function b64ToBytes(b64){
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for(let i=0;i<len;i++){ bytes[i] = binary.charCodeAt(i); }
  return bytes;
}

async function decompress(bytes){
  if(typeof DecompressionStream !== 'undefined'){
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return new TextDecoder('utf-8').decode(buf);
  }
  // fallback: pako from CDN
  await new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  const out = pako.inflate(bytes);
  return new TextDecoder('utf-8').decode(out);
}

async function loadData(){
  statusEl.textContent = "جاري تحميل بيانات النتيجة…";
  try{
    const bytes = b64ToBytes(DATA_B64);
    const text = await decompress(bytes);
    const lines = text.split('\n');
    for(let i=0;i<lines.length;i++){
      const line = lines[i];
      if(!line) continue;
      const parts = line.split('\t');
      const seat = parts[0];
      const name = parts[1];
      const degree = parts[2];
      const code = parts[3];
      const rec = {seat, name, degree, code};
      records.push(rec);
      seatIndex.set(seat, rec);
    }
    ready = true;
    statusEl.textContent = "";
  }catch(err){
    statusEl.textContent = "تعذّر تحميل بيانات النتيجة. حاول تحديث الصفحة.";
    console.error(err);
  }
}
loadData();

function renderCard(rec){
  const info = CASE_INFO[rec.code] || {label: rec.code, cls:"absent"};
  const degreeText = rec.degree === "" ? "—" : rec.degree;
  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <div class="result-top">
      <div>
        <div class="r-name">${escapeHtml(rec.name)}</div>
        <div class="r-seat">رقم الجلوس: ${rec.seat}</div>
      </div>
      <span class="badge ${info.cls}">${info.label}</span>
    </div>
    <div class="r-degree">مجموع الدرجات: <b>${degreeText}</b></div>
  `;
  return card;
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function doSearch(){
  const raw = qEl.value.trim();
  resultsEl.innerHTML = '';
  if(!ready){
    statusEl.textContent = "البيانات ما زالت قيد التحميل، حاول بعد لحظات…";
    return;
  }
  if(!raw){
    statusEl.textContent = "الرجاء إدخال رقم الجلوس أو اسم الطالب.";
    return;
  }
  const isDigits = /^[0-9]+$/.test(raw);
  if(isDigits){
    // exact seat match first
    const exact = seatIndex.get(raw);
    if(exact){
      statusEl.textContent = '';
      resultsEl.appendChild(renderCard(exact));
      return;
    }
    // prefix match on seating numbers
    const matches = [];
    for(const rec of records){
      if(rec.seat.startsWith(raw)){
        matches.push(rec);
        if(matches.length >= 50) break;
      }
    }
    if(matches.length === 0){
      statusEl.textContent = "لا توجد نتيجة لهذا الرقم.";
      return;
    }
    statusEl.textContent = `تم العثور على ${matches.length} نتيجة${matches.length>=50 ? ' (أول 50)':''}:`;
    matches.forEach(m => resultsEl.appendChild(renderCard(m)));
    return;
  }
  // name search
  const needle = raw.replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
  const matches = [];
  for(const rec of records){
    const normName = rec.name.replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
    if(normName.indexOf(needle) !== -1){
      matches.push(rec);
      if(matches.length >= 50) break;
    }
  }
  if(matches.length === 0){
    statusEl.textContent = "لا توجد نتائج مطابقة لهذا الاسم.";
    return;
  }
  statusEl.textContent = `تم العثور على ${matches.length} نتيجة${matches.length>=50 ? ' (أول 50، برجاء تدقيق الاسم)':''}:`;
  matches.forEach(m => resultsEl.appendChild(renderCard(m)));
}

goBtn.addEventListener('click', doSearch);
qEl.addEventListener('keydown', e => { if(e.key === 'Enter') doSearch(); });
