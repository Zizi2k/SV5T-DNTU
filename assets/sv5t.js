// Dán link Web App /exec của Google Apps Script vào đây trước khi upload lên GitHub Pages.
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbyoMap8EQZS2KtQty0ZgJ4SGLUjsDyd6AJ1z-D9GH0tJYjugG0XsBOvhjYIv-t3F8jmoA/exec';
const APP_BUILD = '20260625-split-portal';
const PORTAL = (document.body && document.body.dataset.portal) || 'student';

let API_URL = DEFAULT_API_URL;
try {
  const saved = localStorage.getItem('SV5T_API_URL');
  if (saved && saved.indexOf('script.google.com') >= 0 && saved.indexOf('/exec') >= 0) API_URL = saved;
  if (localStorage.getItem('SV5T_BUILD') !== APP_BUILD) {
    localStorage.removeItem('SV5T_API_URL');
    localStorage.setItem('SV5T_BUILD', APP_BUILD);
    API_URL = DEFAULT_API_URL;
  }
} catch (e) {}
const APP = {
  token: localStorage.getItem('SV5T_TOKEN') || '',
  user: JSON.parse(localStorage.getItem('SV5T_USER') || 'null'),
  criteria: [], groupedCriteria: [], myApp: null, maxFileMb: 8, maxPdfPerCriterion: 5, maxImagePerCriterion: 30,
  allowStudentEdit: false, studentEditUntil: '', studentEditWindow: { open: false, untilDisplay: '' },
  orgUnits: { faculties: [], classesByFaculty: {}, allowCustomClass: true }
};


if(!window.CSS) window.CSS = {};
if(!CSS.escape) CSS.escape = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
function displayGroupName(name){
  return String(name || '').replace(/^\s*\d+\s*[\.\)]\s*/, '').trim();
}
function cleanDisplayText(s){
  return String(s||'')
    .replace(/\s*[-–—]\s*Khoa Công nghệ thông tin/gi,'')
    .replace(/KHOA CÔNG NGHỆ THÔNG TIN/gi,'CLB SV5T')
    .replace(/Khoa Công nghệ thông tin/gi,'CLB SV5T')
    .replace(/\s{2,}/g,' ')
    .trim();
}
function applyBrandingFromApi(res){
  const title=cleanDisplayText(res.appTitle)||'Hệ thống xét Sinh viên 5 tốt';
  const appTitleEl=document.getElementById('appTitle');
  if(appTitleEl) appTitleEl.textContent=title;
  if(res.organizationLines&&res.organizationLines.length){
    const lines=res.organizationLines.map(cleanDisplayText).filter(Boolean);
    const orgEl=document.getElementById('orgText');
    if(orgEl && lines.length) orgEl.innerHTML=lines.map(esc).join('<br>');
  }
}

function isStudentPortal(){ return PORTAL === 'student'; }
function isAdminPortal(){ return PORTAL === 'admin'; }
function portalUrl(portal){
  const file = portal === 'admin' ? 'quan-ly.html' : 'index.html';
  const path = location.pathname || '/';
  if(/\/(index\.html|quan-ly\.html)$/.test(path)) return path.replace(/[^/]+$/, file);
  const base = path.endsWith('/') ? path : path + '/';
  return base + file;
}
function portalHome(){ return portalUrl(PORTAL); }
function otherPortalUrl(){ return portalUrl(isStudentPortal() ? 'admin' : 'student'); }
function redirectToPortal(portal){ location.replace(portalUrl(portal)); }
function ensurePortalRole(user){
  if(!user) return true;
  if(isStudentPortal() && user.role !== 'STUDENT'){ redirectToPortal('admin'); return false; }
  if(isAdminPortal() && user.role === 'STUDENT'){ redirectToPortal('student'); return false; }
  return true;
}

function esc(s){return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]))}
function showLoading(v){document.getElementById('loading').classList.toggle('active',!!v)}
function moneySize(b){const n=Number(b||0); if(n<1024)return n+' B'; if(n<1048576)return(n/1024).toFixed(1)+' KB'; return(n/1048576).toFixed(2)+' MB'}
function fmtDate(s){if(!s)return''; const d=new Date(s); return isNaN(d)?esc(s):d.toLocaleString('vi-VN')}
function badge(st){if(st==='PASS'||st===true||st==='ĐẠT')return'<span class="pill ok">Đạt</span>'; if(st==='FAIL'||st===false||st==='KHÔNG ĐẠT')return'<span class="pill bad">Không đạt</span>'; if(st==='NEED_MORE'||st==='NEED_SUPPLEMENT')return'<span class="pill warn">Cần bổ sung</span>'; if(st==='SUBMITTED')return'<span class="pill blue">Đã nộp</span>'; if(st==='FINALIZED')return'<span class="pill ok">Đã chốt</span>'; if(st==='DRAFT')return'<span class="pill warn">Nháp</span>'; return'<span class="pill warn">Chờ duyệt</span>'}
function showTab(name,btn){document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.getElementById('tab-'+name).classList.add('active'); if(btn)btn.classList.add('active')}
function apiReady(){return API_URL && API_URL.indexOf('script.google.com')>=0 && API_URL.indexOf('/exec')>=0 && API_URL.indexOf('PASTE_')<0}
async function jsonp(action, params={}){
  if(!apiReady()) throw new Error('Chưa cấu hình Apps Script Web App URL trong file HTML.');
  const qs=new URLSearchParams({...params,action});
  const url=API_URL+(API_URL.includes('?')?'&':'?')+qs.toString();
  try{
    const res=await fetch(url,{method:'GET',credentials:'omit',cache:'no-store',redirect:'follow'});
    if(!res.ok) throw new Error('API HTTP '+res.status+'. Kiểm tra deploy Web App (Bất kỳ ai).');
    const data=await res.json();
    if(data&&data.ok) return data;
    throw new Error((data&&data.message)||'API lỗi');
  }catch(err){
    if(err.message&&(err.message.indexOf('API HTTP')>=0||err.message.indexOf('API lỗi')>=0)) throw err;
    throw new Error('Không gọi được API. Kiểm tra link Web App. '+(err.message||''));
  }
}
function postApi(action,payload={}){
  return new Promise((resolve,reject)=>{
    if(!apiReady()) return reject(new Error('Chưa cấu hình Apps Script Web App URL trong file HTML.'));
    const requestId='REQ_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const iframe=document.createElement('iframe'); iframe.name='iframe_'+requestId; iframe.style.display='none';
    const form=document.createElement('form'); form.method='POST'; form.action=API_URL; form.target=iframe.name; form.style.display='none';
    [['action',action],['requestId',requestId],['payload',JSON.stringify(payload)]].forEach(([k,v])=>{const input=document.createElement('textarea'); input.name=k; input.value=v; form.appendChild(input)});
    document.body.appendChild(iframe); document.body.appendChild(form); form.submit();
    const start=Date.now();
    const poll=async()=>{try{const res=await jsonp('getRequestResult',{requestId}); if(res.pending&&Date.now()-start<180000)return setTimeout(poll,1200); if(res.pending)throw new Error('Xử lý quá lâu hoặc request hết hạn.'); cleanup(); resolve(res)}catch(err){cleanup(); reject(err)}};
    function cleanup(){form.remove(); setTimeout(()=>iframe.remove(),500)}
    setTimeout(poll,1200);
  });
}
function fileAsDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=()=>rej(new Error('Không đọc được file '+file.name));r.readAsDataURL(file)})}
async function sha256Client(text){
  const data = new TextEncoder().encode(String(text || ''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function init(){
  try{ await testApi(); }catch(e){}
  if(APP.token && APP.user){
    if(!ensurePortalRole(APP.user)) return;
    applyLoginUi();
  }
}
async function testApi(){
  try{
    const res=await jsonp('bootstrap');
    APP.criteria=res.criteria||[]; APP.groupedCriteria=res.groupedCriteria||[]; APP.maxFileMb=Number(res.maxFileMb||8);
    APP.maxPdfPerCriterion=Number(res.maxPdfPerCriterion||5);
    APP.maxImagePerCriterion=Number(res.maxImagePerCriterion||30);
    APP.allowStudentEdit=!!res.allowStudentEdit;
    APP.studentEditUntil=res.studentEditUntil||'';
    APP.studentEditWindow=res.studentEditWindow||{open:false,untilDisplay:''};
    if(res.orgUnits) APP.orgUnits=res.orgUnits;
    applyBrandingFromApi(res);
    if(isStudentPortal()){
      renderOrgUnitSelects();
      renderCriteriaTable();
    }
    const box=document.getElementById('apiStatusBox'); if(box){box.style.display='none';box.innerHTML='';}
  }catch(err){
    console.warn('SV5T API chưa sẵn sàng:', err.message);
    const box=document.getElementById('apiStatusBox');
    if(box){
      box.style.display='block';
      box.innerHTML='<div class="alert bad"><b>Backend chưa kết nối được.</b> '+esc(err.message)+'<br><span class="muted">API: '+esc(API_URL)+'<br>Test: <a href="'+esc(API_URL+'?action=ping')+'" target="_blank">mở link ping</a> — nếu ping OK mà trang vẫn lỗi, bấm Ctrl+F5 hoặc xóa cache trình duyệt.</span></div>';
    }
  }
}
function toggleRegister(){const b=document.getElementById('registerBox');b.style.display=b.style.display==='none'?'block':'none'}
async function registerStudent(){
  try{
    showLoading(true);
    const email = s_username.value.trim().toLowerCase();
    const raw = s_password.value;
    if(!email) throw new Error('Vui lòng nhập email sinh viên.');
    if(!raw) throw new Error('Vui lòng nhập mật khẩu.');
    const payload={
      username: email,
      email: email,
      passwordRaw: raw,
      passwordSha256: await sha256Client(raw)
    };
    const res=await postApi('register',payload);
    studentAuthResult.innerHTML='<div class="alert ok">'+esc(res.message)+'</div>';
  }catch(err){studentAuthResult.innerHTML='<div class="alert bad">'+esc(err.message)+'</div>'}
  finally{showLoading(false)}
}
async function login(){
  try{
    showLoading(true);
    const u=(isStudentPortal()?s_username.value:a_username.value).trim().toLowerCase();
    const p=isStudentPortal()?s_password.value:a_password.value;
    if(!u) throw new Error(isStudentPortal() ? 'Vui lòng nhập email sinh viên.' : 'Vui lòng nhập tài khoản quản lý.');
    if(!p) throw new Error('Vui lòng nhập mật khẩu.');
    const res=await jsonp('login',{username:u,passwordSha256:await sha256Client(p)});
    APP.token=res.token; APP.user=res.user; localStorage.setItem('SV5T_TOKEN',APP.token); localStorage.setItem('SV5T_USER',JSON.stringify(APP.user));
    if(!ensurePortalRole(APP.user)) return;
    applyLoginUi();
  }catch(err){
    const box=document.getElementById(isStudentPortal()?'studentAuthResult':'adminAuthResult');
    if(box) box.innerHTML='<div class="alert bad">'+esc(err.message)+'</div>';
  }
  finally{showLoading(false)}
}
function applyLoginUi(){
  const topUserEl=document.getElementById('topUser');
  if(topUserEl) topUserEl.textContent = APP.user ? (APP.user.fullName || APP.user.username) : '';
  if(isStudentPortal()){
    if(APP.user.role!=='STUDENT'){ redirectToPortal('admin'); return; }
    studentAuthBox.style.display='none'; studentProfileBox.style.display='block';
    studentInfoText.textContent=`${APP.user.fullName} - ${APP.user.studentId||''} - ${APP.user.faculty||''} - ${APP.user.className||''}`;
    loadMyApplication();
  } else {
    if(APP.user.role==='STUDENT'){ redirectToPortal('student'); return; }
    reviewerLoginBox.style.display='none'; reviewerDashboard.style.display='block';
    adminInfoText.textContent=`${APP.user.fullName||APP.user.username} - ${APP.user.role}`;
    loadDashboard();
  }
}
function logout(){
  localStorage.removeItem('SV5T_TOKEN');
  localStorage.removeItem('SV5T_USER');
  location.href = portalHome();
}

async function loadMyApplication(){
  try{
    showLoading(true);
    const res=await jsonp('myApplication',{token:APP.token});
    APP.myApp=res.application?res:null;
    studentApplicationBox.style.display='block';
    app_schoolYear.value=(res.application&&res.application.schoolYear)||'';
    if(!app_schoolYear.value){ const bs=await jsonp('bootstrap'); app_schoolYear.value=bs.schoolYear||'2025-2026'; }
    renderCriteriaTable(res);
    if(res.application){ fillApplication(res); renderWorkflow(res.application.status); updateStudentActionButtons(res.application.status); studentStatus.innerHTML=renderStudentStatus(res); if(res.editWindow) APP.studentEditWindow=res.editWindow; if(res.orgUnits) APP.orgUnits=res.orgUnits; }
    else { renderOrgUnitSelects(APP.user?.faculty||'', APP.user?.className||''); renderWorkflow('DRAFT'); updateStudentActionButtons('DRAFT'); studentStatus.innerHTML='<div class="alert warn">Bạn chưa có hồ sơ. Vui lòng nhập thông tin và nộp hồ sơ.</div>'; }
  }catch(err){studentStatus.innerHTML='<div class="alert bad">'+esc(err.message)+'</div>'}
  finally{showLoading(false)}
}
function updateStudentActionButtons(status){
  const saveBtn = document.getElementById('btnSaveDraft');
  const submitBtn = document.getElementById('btnSubmitApp');
  if(!saveBtn || !submitBtn) return;
  saveBtn.style.display = 'inline-flex';
  submitBtn.style.display = 'inline-flex';
  submitBtn.textContent = 'Nộp hồ sơ';
  saveBtn.textContent = 'Lưu nháp';
  saveBtn.disabled = false;
  submitBtn.disabled = false;

  if(status === 'SUBMITTED'){
    if(isStudentEditWindowOpen()){
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu minh chứng';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đã nộp — đang chờ duyệt';
    }else{
      saveBtn.disabled = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang chờ duyệt';
    }
  }else if(status === 'NEED_SUPPLEMENT'){
    saveBtn.style.display = 'none';
    submitBtn.textContent = 'Gửi bổ sung minh chứng';
  }else if(status === 'FINALIZED'){
    saveBtn.disabled = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đã chốt kết quả';
  }
}

function renderStudentStatus(res){
  const a = res.application || {};
  const ew = APP.studentEditWindow || {};
  if(a.status === 'SUBMITTED'){
    if(isStudentEditWindowOpen()){
      const until = ew.untilDisplay ? (' Hạn chỉnh sửa: <b>'+esc(ew.untilDisplay)+'</b>.') : ' Không giới hạn thời gian cho đến khi admin tắt.';
      return '<div class="alert warn"><b>Admin đang mở thời gian chỉnh sửa minh chứng.</b> Bạn có thể thêm, xóa PDF/ảnh theo từng tiêu chí.'+until+' Nhấn <b>Lưu minh chứng</b> sau khi thay đổi.</div>';
    }
    return '<div class="alert info"><b>Hồ sơ đã nộp và đang chờ duyệt.</b> Bạn chưa cần thao tác thêm. Khi người chấm yêu cầu bổ sung, hệ thống sẽ mở lại đúng tiêu chí cần bổ sung.</div>';
  }
  if(a.status === 'NEED_SUPPLEMENT') return '<div class="alert warn"><b>Hồ sơ cần bổ sung minh chứng.</b> Vui lòng xem cột <b>Kết quả</b> và <b>Lý do</b>, sau đó chỉ bổ sung minh chứng cho các tiêu chí bị Không đạt hoặc Cần bổ sung.</div>';
  if(a.status === 'FINALIZED') return '<div class="alert ok"><b>Hồ sơ đã chốt kết quả.</b> Kết quả cuối: '+badge(a.finalResult || '')+'</div>';
  return '<div class="alert info">Trạng thái hồ sơ: '+badge(a.status || 'DRAFT')+'</div>';
}

function renderWorkflow(status){
  const st = status || 'DRAFT';
  const step = (key, label, desc) => {
    let cls = '';
    if((key==='DRAFT' && st==='DRAFT') || (key==='SUBMITTED' && st==='SUBMITTED') || (key==='NEED_SUPPLEMENT' && st==='NEED_SUPPLEMENT') || (key==='FINALIZED' && st==='FINALIZED')) cls = 'active';
    if(key==='NEED_SUPPLEMENT' && st==='NEED_SUPPLEMENT') cls = 'warn';
    if((key==='DRAFT' && st!=='DRAFT') || (key==='SUBMITTED' && (st==='NEED_SUPPLEMENT'||st==='FINALIZED')) || (key==='NEED_SUPPLEMENT' && st==='FINALIZED')) cls = 'done';
    return `<div class="workflow-step ${cls}"><b>${label}</b><span>${desc}</span></div>`;
  };
  workflowBox.innerHTML = `<div class="workflow-box">
    ${step('DRAFT','1. Lưu hồ sơ','Nhập thông tin và tải minh chứng.')}
    ${step('SUBMITTED','2. Chờ duyệt','Sau khi nộp, admin có thể mở thời gian chỉnh sửa minh chứng.')}
    ${step('NEED_SUPPLEMENT','3. Bổ sung','Chỉ bổ sung khi người chấm yêu cầu và có lý do.')}
    ${step('FINALIZED','4. Chốt kết quả','Admin chốt kết quả cuối cùng.')}
  </div>`;
}

function orgUnitsData(){
  return APP.orgUnits || {faculties:[], classesByFaculty:{}, allowCustomClass:true};
}
function renderOrgUnitSelects(facultyVal, classVal){
  const org = orgUnitsData();
  const facSel = document.getElementById('app_faculty');
  const clsSel = document.getElementById('app_className');
  if(!facSel || !clsSel) return;
  facultyVal = facultyVal || '';
  classVal = classVal || '';
  facSel.innerHTML = '<option value="">Chọn khoa</option>' + org.faculties.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('');
  const matchFac = org.faculties.find(f=>String(f).toLowerCase()===String(facultyVal).toLowerCase()) || '';
  facSel.value = matchFac || org.faculties[0] || '';
  refreshClassOptions(classVal);
}
function refreshClassOptions(classVal){
  const org = orgUnitsData();
  const facSel = document.getElementById('app_faculty');
  const clsSel = document.getElementById('app_className');
  const customWrap = document.getElementById('app_classCustomWrap');
  const customInput = document.getElementById('app_classNameCustom');
  if(!facSel || !clsSel) return;
  const fac = facSel.value;
  const classes = org.classesByFaculty[fac] || [];
  let opts = '<option value="">Chọn lớp</option>' + classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(org.allowCustomClass) opts += '<option value="__CUSTOM__">Khác (nhập tay)</option>';
  clsSel.innerHTML = opts;
  classVal = classVal || '';
  const matchClass = classes.find(c=>String(c).toLowerCase()===String(classVal).toLowerCase());
  if(matchClass){
    clsSel.value = matchClass;
    if(customWrap) customWrap.style.display='none';
    if(customInput) customInput.value='';
  }else if(classVal && org.allowCustomClass){
    clsSel.value='__CUSTOM__';
    if(customWrap) customWrap.style.display='block';
    if(customInput) customInput.value=classVal;
  }else{
    clsSel.value='';
    if(customWrap) customWrap.style.display='none';
    if(customInput) customInput.value='';
  }
}
function onAppFacultyChange(){ refreshClassOptions(''); }
function onAppClassChange(){
  const wrap = document.getElementById('app_classCustomWrap');
  const clsSel = document.getElementById('app_className');
  if(wrap && clsSel) wrap.style.display = clsSel.value==='__CUSTOM__' ? 'block' : 'none';
}
function getAppClassNameValue(){
  const clsSel = document.getElementById('app_className');
  if(!clsSel) return '';
  if(clsSel.value==='__CUSTOM__') return (document.getElementById('app_classNameCustom')?.value||'').trim();
  return clsSel.value;
}
function facultySelectOptions(selected, includeAll){
  const org = orgUnitsData();
  let html = includeAll ? '<option value="*">Tất cả khoa</option>' : '<option value="">Chọn khoa</option>';
  html += org.faculties.map(f=>{
    const sel = String(f).toLowerCase()===String(selected||'').toLowerCase() ? ' selected' : '';
    return `<option value="${esc(f)}"${sel}>${esc(f)}</option>`;
  }).join('');
  return html;
}

function fillApplication(res){
  const a=res.application;
  app_fullName.value=a.fullName||APP.user.fullName||'';
  app_gender.value=a.gender||APP.user.gender||'';
  app_birthDate.value=(a.birthDate||APP.user.birthDate||'').slice(0,10);
  app_ethnicity.value=a.ethnicity||APP.user.ethnicity||'';
  app_yearOfStudy.value=a.yearOfStudy||APP.user.yearOfStudy||'';
  renderOrgUnitSelects(a.faculty||APP.user.faculty||'', a.className||APP.user.className||'');
  app_unionPosition.value=a.unionPosition||APP.user.unionPosition||'';
  app_phone.value=a.phone||APP.user.phone||'';
  app_schoolYear.value=a.schoolYear||app_schoolYear.value||'';
  app_studentNote.value=a.studentNote||'';
}
function getItemLevel(st, level){
  if(!st) return {status:'', comment:''};
  if(level==='CLUB') return {status:st.status, comment:st.reviewComment||st.reason||''};
  if(level==='PROVINCE') return {status:st.provinceStatus, comment:st.provinceComment||''};
  if(level==='CENTRAL') return {status:st.centralStatus, comment:st.centralComment||''};
  return {status:'', comment:''};
}
function renderLevelResultCell(st, level){
  const lv=getItemLevel(st, level);
  if(!lv.status) return '<td class="result-cell"><span class="pill warn">Chờ duyệt</span></td>';
  if(level==='CLUB' && (st.itemType==='REQUIRED_AUTO' || !st.itemType) && st.status==='PASS' && !st.reviewComment && st.reason) return `<td class="result-cell">${badge(st.status)}</td>`;
  return `<td class="result-cell">${badge(lv.status)}</td>`;
}
function renderLevelReasonCell(st, level){
  const lv=getItemLevel(st, level);
  const comment=lv.comment;
  const need=level==='CLUB' && st && (st.status==='FAIL' || st.status==='NEED_MORE');
  return `<td class="reason-cell">${comment ? esc(comment) : '<span class="reason-empty">Chưa có</span>'}${need ? '<div class="supplement-hint">Bạn có thể bổ sung minh chứng mới theo lý do này.</div>' : ''}</td>`;
}
function renderAllLevelCells(st){
  return renderLevelResultCell(st,'CLUB')+renderLevelReasonCell(st,'CLUB')+renderLevelResultCell(st,'PROVINCE')+renderLevelReasonCell(st,'PROVINCE')+renderLevelResultCell(st,'CENTRAL')+renderLevelReasonCell(st,'CENTRAL');
}
function levelLabel(level){
  if(level==='PROVINCE') return 'Cấp Tỉnh';
  if(level==='CENTRAL') return 'Cấp Trung ương';
  return 'Cấp CLB';
}
function fileKindOf(f){
  return String(f.fileKind||'').toUpperCase()==='IMAGE' ? 'IMAGE' : 'PDF';
}
function renderCriteriaTable(existing){
  if(!APP.groupedCriteria.length)return;
  const ev={}, itemStatus={};
  if(existing){
    (existing.evidences||[]).forEach(e=>(ev[e.criterionId]??=[]).push(e));
    (existing.groups||[]).forEach(g=>(g.items||[]).forEach(i=>itemStatus[i.criterionId]=i));
  }

  let html = '<div class="table-scroll"><table class="criteria-table"><thead><tr><th>STT</th><th>Tiêu chí lớn</th><th>Tiêu chí nhỏ / điều kiện</th><th>Minh chứng yêu cầu</th><th>Tài liệu minh chứng</th><th class="level-col-head">KQ<br>CLB</th><th class="level-col-head">Lý do<br>CLB</th><th class="level-col-head">KQ<br>Tỉnh</th><th class="level-col-head">Lý do<br>Tỉnh</th><th class="level-col-head">KQ<br>TW</th><th class="level-col-head">Lý do<br>TW</th></tr></thead><tbody>';

  APP.groupedCriteria.forEach((g,gi)=>{
    const items = g.items || [];
    const requiredItems = items.filter(x=>x.itemType==='REQUIRED_AUTO' || x.itemType==='REQUIRED_EVIDENCE');
    const optionItems = items.filter(x=>x.itemType==='OPTION_EVIDENCE');
    const optionNeed = Math.max(1, ...optionItems.map(x=>Number(x.minOptionPass||1)));
    const totalRows = (requiredItems.length ? 1 + requiredItems.length : 0) + (optionItems.length ? 1 + optionItems.length : 0) || 1;
    let firstRow = true;

    function openRow(){
      let row = '<tr>';
      if(firstRow){
        row += `<td class="order-cell" rowspan="${totalRows}">${gi+1}</td>`;
        row += `<td class="group-cell" rowspan="${totalRows}"><div class="group-label">${esc(displayGroupName(g.groupName))}</div></td>`;
        firstRow = false;
      }
      return row;
    }

    if(requiredItems.length){
      html += openRow() + `<td colspan="9"><div class="criteria-section-title">Các tiêu chí bắt buộc</div></td></tr>`;
      requiredItems.forEach(item=>{
        const files=ev[item.criterionId]||[], st=itemStatus[item.criterionId];
        html += openRow();
        if(item.itemType==='REQUIRED_AUTO'){
          html += `<td><span class="criterion-title raw-criterion">${esc(item.label)}</span></td>`;
          html += `<td><div class="auto-note">Hệ thống tự kiểm tra từ dữ liệu hồ sơ.</div></td><td><span class="muted">Không yêu cầu sinh viên tải minh chứng tại mục này.</span></td>${renderAllLevelCells(st)}`;
        }else{
          html += `<td><span class="criterion-title raw-criterion">${esc(item.label)}</span></td>`;
          html += `<td><b>Yêu cầu:</b><br><span class="muted">${esc(item.sourceText||'Tải giấy chứng nhận/xác nhận/danh sách minh chứng phù hợp với tiêu chí.')}</span></td>`;
          html += `<td>${renderEvidenceCell(item,files,st)}</td>${renderAllLevelCells(st)}`;
        }
        html += '</tr>';
      });
    }

    if(optionItems.length){
      const label = optionNeed <= 1
        ? 'Đạt thêm 01 trong các tiêu chí sau:'
        : `Đạt tối thiểu ${optionNeed} trong các tiêu chí sau:`;
      html += openRow() + `<td colspan="9"><div class="criteria-section-title">${label}</div></td></tr>`;
      optionItems.forEach((item, idx)=>{
        const files=ev[item.criterionId]||[], st=itemStatus[item.criterionId];
        html += openRow();
        html += `<td><span class="criterion-title raw-criterion">${idx+1}. ${esc(item.label)}</span></td>`;
        html += `<td><b>Yêu cầu:</b><br><span class="muted">${esc(item.sourceText||'Tải giấy chứng nhận/xác nhận/danh sách minh chứng phù hợp với tiêu chí.')}</span></td>`;
        html += `<td>${renderEvidenceCell(item,files,st)}</td>${renderAllLevelCells(st)}`;
        html += '</tr>';
      });
    }

    if(firstRow){
      html += `<tr><td class="order-cell">${gi+1}</td><td class="group-cell"><div class="group-label">${esc(displayGroupName(g.groupName))}</div></td><td colspan="9"><span class="muted">Chưa có tiêu chí.</span></td></tr>`;
    }
  });

  html += '</tbody></table></div>';
  criteriaContainer.innerHTML = html;
}

function renderReasonCell(st){
  if(!st) return '<span class="reason-empty">Chưa có</span>';
  const reason = st.reviewComment || st.reason || '';
  const need = (st.status === 'FAIL' || st.status === 'NEED_MORE');
  return `${reason ? esc(reason) : '<span class="reason-empty">Chưa có</span>'}${need ? '<div class="supplement-hint">Bạn có thể bổ sung minh chứng mới theo lý do này.</div>' : ''}`;
}

function isStudentEditWindowOpen(){
  const w = APP.studentEditWindow || {};
  return !!w.open;
}
function canManageEvidenceForCriterion(st){
  const app = APP.myApp && APP.myApp.application ? APP.myApp.application : null;
  if(!app) return true;
  if(app.status === 'FINALIZED') return false;
  if(app.status === 'DRAFT') return true;
  if(app.status === 'NEED_SUPPLEMENT') return !!st && (st.status === 'FAIL' || st.status === 'NEED_MORE');
  if(app.status === 'SUBMITTED') return isStudentEditWindowOpen();
  return false;
}
function canAddEvidenceForCriterion(st){
  return canManageEvidenceForCriterion(st);
}
function renderEvidenceList(files, criterionId, st){
  const canManage = canManageEvidenceForCriterion(st);
  if(!files.length) return '<div class="muted">Chưa có tài liệu minh chứng.</div>';
  const pdfs=files.filter(f=>fileKindOf(f)==='PDF');
  const imgs=files.filter(f=>fileKindOf(f)==='IMAGE');
  const renderItem=(f,tag)=>{
    const actions = canManage ? `<button type="button" class="btn bad small" style="margin-left:6px" onclick="deleteEvidence('${esc(f.evidenceId)}')">Xóa</button>` : '';
    return `<li><span class="file-tag ${tag}">${tag.toUpperCase()}</span> <a href="${esc(f.fileUrl)}" target="_blank">${esc(f.evidenceTitle||f.fileName)}</a> <span class="muted">(${moneySize(f.sizeBytes)})</span>${actions}</li>`;
  };
  const renderList=(list,tag,label)=>list.length?`<div class="muted" style="margin-top:8px"><b>${label} (${list.length})</b></div><ul class="existing-files">${list.sort((a,b)=>Number(a.evidenceOrder||0)-Number(b.evidenceOrder||0)).map(f=>renderItem(f,tag)).join('')}</ul>`:'';
  return `<div class="muted"><b>Minh chứng đã tải:</b></div>${renderList(pdfs,'pdf','PDF')}${renderList(imgs,'image','Ảnh')}`;
}
async function deleteEvidence(evidenceId){
  if(!confirm('Xóa minh chứng này? Thao tác không thể hoàn tác.')) return;
  try{
    showLoading(true);
    await postApi('studentDeleteEvidence',{token:APP.token,evidenceId});
    await loadMyApplication();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}
function countExistingKind(criterionId, kind){
  return (APP.myApp?.evidences||[]).filter(e=>e.criterionId===criterionId && fileKindOf(e)===kind).length;
}
function countPendingKind(criterionId, kind){
  return document.querySelectorAll(`.evidence-row[data-criterion="${CSS.escape(criterionId)}"][data-kind="${kind}"]`).length;
}
function renderEvidenceCell(item,files,st){
  const app = APP.myApp && APP.myApp.application ? APP.myApp.application : null;
  const canAdd = canAddEvidenceForCriterion(st);
  const existing = renderEvidenceList(files, item.criterionId, st);
  let action = '';
  if(canAdd){
    const pdfLeft = Math.max(0, APP.maxPdfPerCriterion - countExistingKind(item.criterionId,'PDF') - countPendingKind(item.criterionId,'PDF'));
    action = `<div class="evidence-upload-grid">
      <div class="ev-kind-box">
        <div class="ev-kind-head"><b>PDF</b><span class="muted">Còn ${pdfLeft}/${APP.maxPdfPerCriterion}</span></div>
        <button type="button" class="btn blue small" ${pdfLeft?`onclick="addEvidenceRow('${esc(item.criterionId)}','PDF')"`:'disabled'}>+ Thêm PDF</button>
        <div id="evRows_${esc(item.criterionId)}_PDF"></div>
      </div>
      <div class="ev-kind-box">
        <div class="ev-kind-head"><b>Ảnh</b><span class="muted">JPG, PNG, WEBP...</span></div>
        <button type="button" class="btn blue small" onclick="pickImageFiles('${esc(item.criterionId)}')">+ Chọn nhiều ảnh</button>
        <button type="button" class="btn secondary small" onclick="addEvidenceRow('${esc(item.criterionId)}','IMAGE')">+ Thêm 1 ảnh</button>
        <div id="evRows_${esc(item.criterionId)}_IMAGE"></div>
      </div>
    </div>`;
  }else{
    let msg = 'Hồ sơ đang khóa tải minh chứng.';
    if(app && app.status === 'SUBMITTED'){
      if(APP.allowStudentEdit && !isStudentEditWindowOpen()){
        msg = APP.studentEditWindow && APP.studentEditWindow.untilDisplay
          ? 'Đã hết thời gian chỉnh sửa minh chứng (hạn: '+APP.studentEditWindow.untilDisplay+').'
          : 'Admin chưa mở hoặc đã đóng thời gian chỉnh sửa minh chứng.';
      }else{
        msg = 'Đã nộp hồ sơ, chờ người chấm duyệt.';
      }
    }
    if(app && app.status === 'FINALIZED') msg = 'Hồ sơ đã chốt kết quả, không thể bổ sung.';
    if(app && app.status === 'NEED_SUPPLEMENT') msg = 'Chỉ được bổ sung cho tiêu chí bị Không đạt hoặc Cần bổ sung.';
    action = `<div class="locked-evidence" style="margin-top:10px">${msg}</div>`;
  }
  return `<div class="evidence-panel">${existing}${action}</div>`;
}

function addEvidenceRow(criterionId, fileKind='PDF'){
  if(fileKind==='PDF'){
    const left = APP.maxPdfPerCriterion - countExistingKind(criterionId,'PDF') - countPendingKind(criterionId,'PDF');
    if(left <= 0){ alert('Đã đủ '+APP.maxPdfPerCriterion+' file PDF cho tiêu chí này.'); return; }
  }
  const box=document.getElementById('evRows_'+criterionId+'_'+fileKind);
  if(!box) return;
  const index=box.querySelectorAll('.evidence-row').length+1;
  const existingCount=(APP.myApp?.evidences||[]).filter(e=>e.criterionId===criterionId).length;
  const displayNo=existingCount+index;
  const row=document.createElement('div');
  row.className='evidence-row';
  row.dataset.criterion=criterionId;
  row.dataset.kind=fileKind;
  row.dataset.order=displayNo;
  const accept=fileKind==='PDF'?'.pdf,application/pdf':'image/*';
  row.innerHTML=`<div class="evidence-row-head"><span class="mc-badge">${fileKind==='PDF'?'PDF':'Ảnh'} ${index}</span><button type="button" class="btn secondary small" onclick="this.closest('.evidence-row').remove()">Xóa</button></div>
    <label>Tên minh chứng <span class="req">*</span></label>
    <input class="ev-title" placeholder="${fileKind==='PDF'?'VD: Bảng điểm PDF':'VD: Ảnh hoạt động tình nguyện'}" oninput="enableEvidenceFile(this)">
    <label style="margin-top:8px">File ${fileKind==='PDF'?'PDF':'ảnh'}</label>
    <input class="ev-file file-disabled" type="file" accept="${accept}" disabled onchange="previewEvidenceFile(this)">
    <div class="muted ev-preview">Nhập tên minh chứng trước, sau đó chọn file.</div>`;
  box.appendChild(row);
}
function pickImageFiles(criterionId){
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.multiple=true;
  input.onchange=()=>{
    Array.from(input.files||[]).forEach(file=>{
      addEvidenceRow(criterionId,'IMAGE');
      const box=document.getElementById('evRows_'+criterionId+'_IMAGE');
      const row=box.lastElementChild;
      if(!row) return;
      const title=row.querySelector('.ev-title');
      title.value=file.name.replace(/\.[^.]+$/,'');
      const fileInput=row.querySelector('.ev-file');
      const dt=new DataTransfer();
      dt.items.add(file);
      fileInput.files=dt.files;
      enableEvidenceFile(title);
      previewEvidenceFile(fileInput);
    });
  };
  input.click();
}
function enableEvidenceFile(input){
  const row=input.closest('.evidence-row');
  const file=row.querySelector('.ev-file');
  const ok=input.value.trim().length>0;
  file.disabled=!ok;
  file.classList.toggle('file-disabled',!ok);
  if(!ok) file.value='';
  row.querySelector('.ev-preview').textContent=ok?'Có thể chọn file tài liệu cho tên minh chứng này.':'Nhập tên minh chứng trước, sau đó mới chọn file tài liệu.';
}
function previewEvidenceFile(input){
  const row=input.closest('.evidence-row');
  const f=input.files&&input.files[0];
  row.querySelector('.ev-preview').innerHTML=f?`Đã chọn: <b>${esc(f.name)}</b> - ${moneySize(f.size)}`:'Chưa chọn file.';
}
async function collectFiles(){
  const rows=Array.from(document.querySelectorAll('.evidence-row'));
  const out=[];
  const pendingPdf={};
  const pendingImage={};
  for(const row of rows){
    const criterionId=row.dataset.criterion;
    const fileKind=row.dataset.kind||'PDF';
    const title=row.querySelector('.ev-title').value.trim();
    const fileInput=row.querySelector('.ev-file');
    const file=fileInput.files&&fileInput.files[0];
    if(!title && !file) continue;
    if(!title) throw new Error('Chưa nhập tên minh chứng.');
    if(!file) throw new Error('Minh chứng "'+title+'" chưa chọn file.');
    if(file.size>APP.maxFileMb*1024*1024) throw new Error('File '+file.name+' vượt quá '+APP.maxFileMb+'MB.');
    if(fileKind==='PDF'){
      if(file.type && file.type!=='application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('File "'+file.name+'" không phải PDF.');
      pendingPdf[criterionId]=(pendingPdf[criterionId]||0)+1;
    }else{
      if(file.type && file.type.indexOf('image/')!==0) throw new Error('File "'+file.name+'" không phải ảnh.');
      pendingImage[criterionId]=(pendingImage[criterionId]||0)+1;
    }
    out.push({
      criterionId:criterionId,
      fileKind:fileKind,
      evidenceOrder:Number(row.dataset.order||out.length+1),
      criterionEvidenceNo:criterionId+'-'+fileKind+'-'+(row.dataset.order||out.length+1),
      evidenceTitle:title,
      fileName:file.name,
      mimeType:file.type||(fileKind==='PDF'?'application/pdf':'image/jpeg'),
      size:file.size,
      base64:await fileAsDataURL(file),
      note:title
    });
  }
  Object.keys(pendingPdf).forEach(cid=>{
    const total=countExistingKind(cid,'PDF')+pendingPdf[cid];
    if(total>APP.maxPdfPerCriterion) throw new Error('Tiêu chí vượt quá '+APP.maxPdfPerCriterion+' file PDF.');
  });
  Object.keys(pendingImage).forEach(cid=>{
    const total=countExistingKind(cid,'IMAGE')+pendingImage[cid];
    if(total>APP.maxImagePerCriterion) throw new Error('Tiêu chí vượt quá '+APP.maxImagePerCriterion+' ảnh.');
  });
  return out;
}
function collectClaims(){
  const existing = APP.myApp && APP.myApp.evidences ? APP.myApp.evidences : [];
  return APP.criteria.filter(i=>i.itemType==='OPTION_EVIDENCE' || i.itemType==='REQUIRED_EVIDENCE').map(item=>{
    const hasNew = document.querySelectorAll(`.evidence-row[data-criterion="${CSS.escape(item.criterionId)}"]`).length > 0;
    const hasOld = existing.some(e=>e.criterionId===item.criterionId);
    return {criterionId:item.criterionId,selected:hasNew||hasOld,studentNote:''};
  });
}
async function saveApplication(submitNow){
  try{
    showLoading(true);
    const files = await collectFiles();
    const app = APP.myApp && APP.myApp.application ? APP.myApp.application : null;

    if(app && app.status === 'FINALIZED') throw new Error('Hồ sơ đã chốt kết quả, không thể cập nhật.');
    if(app && app.status === 'SUBMITTED' && !isStudentEditWindowOpen()) throw new Error('Hồ sơ đã nộp và đang chờ duyệt. Chỉ được sửa minh chứng trong thời gian admin cho phép.');

    if(app && app.status === 'NEED_SUPPLEMENT'){
      if(!files.length) throw new Error('Vui lòng tải ít nhất 01 minh chứng bổ sung.');
      const payload={token:APP.token,claims:collectClaims(),files};
      const res=await postApi('studentSupplement',payload);
      applicationResult.innerHTML='<div class="alert ok">'+esc(res.message)+'</div>';
      await loadMyApplication();
      return;
    }

    const payload={token:APP.token,application:{fullName:app_fullName.value,gender:app_gender.value,birthDate:app_birthDate.value,ethnicity:app_ethnicity.value,yearOfStudy:app_yearOfStudy.value,faculty:app_faculty.value,className:getAppClassNameValue(),unionPosition:app_unionPosition.value,phone:app_phone.value,schoolYear:app_schoolYear.value,studentNote:app_studentNote.value},claims:collectClaims(),files};
    const res=await postApi(submitNow?'studentSubmitApplication':'studentSaveApplication',payload);
    applicationResult.innerHTML='<div class="alert ok">'+esc(res.message)+'</div>';
    await loadMyApplication();
  }catch(err){applicationResult.innerHTML='<div class="alert bad">'+esc(err.message)+'</div>'}
  finally{showLoading(false)}
}


function showAdminSection(section, btn){
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const map = {
    applications:['reviewerDashboard'],
    users:['userManageBox'],
    criteria:['criteriaManageBox'],
    data:['dataToolsBox']
  };
  ['applicationList','userManageBox','criteriaManageBox','dataToolsBox'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });
  if(section==='applications'){
    applicationList.style.display='block';
  }
  if(section==='users'){
    userManageBox.style.display='block';
    if(APP.user.role==='ADMIN') loadUsers();
  }
  if(section==='criteria'){
    criteriaManageBox.style.display='block';
    if(APP.user.role==='ADMIN') loadCriteriaAdmin();
  }
  if(section==='data'){
    dataToolsBox.style.display='block';
    renderDataTools();
  }
}

async function changeMyPassword(){
  try{
    const oldPass = prompt('Nhập mật khẩu cũ');
    if(oldPass === null) return;
    const newPass = prompt('Nhập mật khẩu mới, tối thiểu 6 ký tự');
    if(newPass === null) return;
    if(newPass.length < 6){ alert('Mật khẩu mới phải có ít nhất 6 ký tự.'); return; }
    showLoading(true);
    await postApi('changeMyPassword',{
      token:APP.token,
      oldPasswordRaw:oldPass,
      oldPasswordSha256:await sha256Client(oldPass),
      newPasswordRaw:newPass,
      newPasswordSha256:await sha256Client(newPass)
    });
    alert('Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
    logout();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}

function renderOrgClassAdminGrid(faculties, classesByFaculty){
  faculties = faculties || [];
  classesByFaculty = classesByFaculty || {};
  if(!faculties.length) return '<div class="muted">Nhập danh sách khoa rồi bấm "Áp dụng danh sách khoa".</div>';
  return `<div class="field-grid">${faculties.map(f=>{
    const classes = (classesByFaculty[f]||[]).join('\n');
    return `<div class="field col-6"><label>Lớp — ${esc(f)}</label><textarea class="cfg-class-list" data-faculty="${esc(f)}" rows="5" placeholder="Mỗi dòng một lớp">${esc(classes)}</textarea></div>`;
  }).join('')}</div>`;
}
function syncOrgClassInputs(){
  const org = orgUnitsData();
  const faculties = (document.getElementById('cfgFaculties')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const grid = document.getElementById('cfgClassesGrid');
  if(!grid) return;
  const existing = {};
  document.querySelectorAll('.cfg-class-list').forEach(ta=>{
    const f = ta.dataset.faculty;
    if(f) existing[f] = ta.value.split('\n').map(s=>s.trim()).filter(Boolean);
  });
  const merged = {};
  faculties.forEach(f=>{ merged[f] = existing[f] || org.classesByFaculty[f] || []; });
  grid.innerHTML = renderOrgClassAdminGrid(faculties, merged);
}

function renderDataTools(){
  if(APP.user.role !== 'ADMIN'){
    dataToolsBox.innerHTML = '<div class="alert bad">Chỉ admin mới được sử dụng chức năng dữ liệu.</div>';
    return;
  }
  const ew = APP.studentEditWindow || {};
  const org = orgUnitsData();
  const untilVal = APP.studentEditUntil ? String(APP.studentEditUntil).replace(' ', 'T').slice(0, 16) : '';
  dataToolsBox.innerHTML = `<div class="box-title"><div><h2>Quản trị dữ liệu</h2><div class="desc">Cấu hình khoa/lớp, thời gian chỉnh sửa minh chứng và các thao tác dữ liệu.</div></div></div>
    <div class="config-zone" style="margin-bottom:20px;padding:16px;border:1px solid var(--line);border-radius:12px;background:#f8fafc">
      <h3>Cấu hình khoa và lớp</h3>
      <p class="muted">Sinh viên chọn <b>Khoa</b> và <b>Lớp</b> từ danh sách này khi nộp hồ sơ. Mỗi khoa có danh sách lớp riêng.</p>
      <div class="field" style="margin-top:12px"><label>Danh sách khoa (mỗi dòng một khoa)</label><textarea id="cfgFaculties" rows="4" placeholder="VD: Khoa Công nghệ thông tin">${esc((org.faculties||[]).join('\n'))}</textarea></div>
      <button type="button" class="btn secondary small" style="margin:8px 0" onclick="syncOrgClassInputs()">Áp dụng danh sách khoa</button>
      <div id="cfgClassesGrid">${renderOrgClassAdminGrid(org.faculties, org.classesByFaculty)}</div>
      <div class="field" style="margin-top:12px"><label><input type="checkbox" id="cfgAllowCustomClass" ${org.allowCustomClass?'checked':''}> Cho phép sinh viên nhập lớp khác (ngoài danh sách)</label></div>
      <button class="btn primary" style="margin-top:12px" onclick="saveOrgUnitsConfig()">Lưu cấu hình khoa/lớp</button>
    </div>
    <div class="config-zone" style="margin-bottom:20px;padding:16px;border:1px solid var(--line);border-radius:12px;background:#f8fafc">
      <h3>Thời gian chỉnh sửa minh chứng (sinh viên)</h3>
      <p class="muted">Khi bật, sinh viên đã nộp hồ sơ (trạng thái <b>Đã nộp</b>) có thể thêm/xóa PDF và ảnh theo từng tiêu chí cho đến hết thời hạn.</p>
      <div class="field-grid" style="margin-top:12px">
        <div class="field col-12"><label><input type="checkbox" id="cfgAllowStudentEdit" ${APP.allowStudentEdit?'checked':''}> Cho phép sinh viên sửa minh chứng đã nộp</label></div>
        <div class="field col-6"><label>Hạn chỉnh sửa (để trống = không giới hạn thời gian)</label><input type="datetime-local" id="cfgStudentEditUntil" value="${esc(untilVal)}"></div>
        <div class="field col-6"><label>Trạng thái hiện tại</label><div class="alert ${ew.open?'ok':'info'}" style="margin:0">${ew.open?'Đang mở cho sinh viên sửa':(APP.allowStudentEdit?'Đã bật nhưng hết hạn hoặc chưa đến hạn':'Đang tắt')}${ew.untilDisplay?' · Hạn: '+esc(ew.untilDisplay):''}</div></div>
      </div>
      <button class="btn primary" style="margin-top:12px" onclick="saveStudentEditConfig()">Lưu cấu hình chỉnh sửa</button>
    </div>
    <div class="danger-zone">
      <h3>Xóa toàn bộ dữ liệu hồ sơ</h3>
      <p class="muted">Chức năng này xóa toàn bộ hồ sơ, minh chứng, kết quả duyệt trong Google Sheet và đưa thư mục minh chứng hồ sơ vào thùng rác. Tài khoản và tiêu chí vẫn được giữ lại.</p>
      <button class="btn bad" onclick="clearApplicationData()">Xóa toàn bộ dữ liệu hồ sơ</button>
    </div>`;
}

async function saveOrgUnitsConfig(){
  try{
    showLoading(true);
    const faculties = (document.getElementById('cfgFaculties')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean);
    const classesByFaculty = {};
    faculties.forEach(f=>{
      const ta = Array.from(document.querySelectorAll('.cfg-class-list')).find(el => el.dataset.faculty === f);
      classesByFaculty[f] = ta ? ta.value.split('\n').map(s=>s.trim()).filter(Boolean) : [];
    });
    const allowCustomClass = !!document.getElementById('cfgAllowCustomClass')?.checked;
    const res = await postApi('updateOrgUnits',{token:APP.token,orgUnits:{faculties,classesByFaculty,allowCustomClass}});
    if(res.orgUnits) APP.orgUnits = res.orgUnits;
    alert(res.message || 'Đã lưu.');
    renderDataTools();
    renderOrgUnitSelects();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}

async function saveStudentEditConfig(){
  try{
    showLoading(true);
    const allow = document.getElementById('cfgAllowStudentEdit').checked;
    let until = document.getElementById('cfgStudentEditUntil').value || '';
    if(until) until = until.replace('T', ' ') + ':00';
    const res = await postApi('updateStudentEditConfig',{token:APP.token,allowStudentEdit:allow,studentEditUntil:until});
    APP.allowStudentEdit = allow;
    APP.studentEditUntil = until;
    if(res.studentEditWindow) APP.studentEditWindow = res.studentEditWindow;
    alert(res.message || 'Đã lưu.');
    renderDataTools();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}

async function clearApplicationData(){
  const c = prompt('Nhập chính xác XOA DU LIEU để xác nhận xóa toàn bộ hồ sơ');
  if(c !== 'XOA DU LIEU') return;
  try{
    showLoading(true);
    const res = await postApi('clearApplicationData',{token:APP.token,confirmText:c});
    alert(res.message);
    await loadDashboard();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}

async function deleteApplication(appId){
  if(!confirm('Xóa hồ sơ '+appId+' và toàn bộ minh chứng liên quan?')) return;
  try{
    showLoading(true);
    const res = await postApi('deleteApplication',{token:APP.token,applicationId:appId});
    alert(res.message);
    detailBox.style.display='none';
    await loadDashboard();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}

async function setUserActive(username, active){
  if(!confirm((active?'Mở':'Khóa')+' tài khoản '+username+'?')) return;
  try{
    showLoading(true);
    await postApi('setUserActive',{token:APP.token,username,active});
    await loadUsers();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}

async function resetUserDefault(username){
  if(!confirm('Chuyển mật khẩu của '+username+' về mặc định 123456?')) return;
  try{
    showLoading(true);
    await postApi('resetUserPassword',{token:APP.token,username,newPassword:'123456'});
    alert('Đã chuyển mật khẩu về mặc định 123456.');
    await loadUsers();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}

async function adminChangeUserPassword(username){
  const pass = prompt('Nhập mật khẩu mới cho '+username);
  if(pass === null) return;
  if(pass.length < 6){ alert('Mật khẩu mới phải có ít nhất 6 ký tự.'); return; }
  try{
    showLoading(true);
    await postApi('resetUserPassword',{token:APP.token,username,newPassword:pass});
    alert('Đã đổi mật khẩu tài khoản '+username+'.');
    await loadUsers();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}


async function loadDashboard(){await Promise.all([loadStats(),loadApplications()]); if(APP.user.role==='ADMIN'){loadUsers();loadCriteriaAdmin();renderDataTools()} else { if(adminTabs) adminTabs.style.display='none'; }}
async function loadStats(){try{const r=await jsonp('stats',{token:APP.token}); const s=r.stats; statsBox.innerHTML=[['total','Tổng'],['submitted','Đã nộp'],['needSupplement','Cần bổ sung'],['finalized','Đã chốt'],['pass','Đạt'],['fail','Không đạt']].map(([k,l])=>`<div class="stat"><div class="num">${s[k]}</div><div class="label">${l}</div></div>`).join('')}catch(e){statsBox.innerHTML='<div class="alert bad">'+esc(e.message)+'</div>'}}
async function loadApplications(){
  try{const r=await jsonp('listApplications',{token:APP.token,q:filterQ.value,status:filterStatus.value}); const rows=r.applications||[]; applicationList.innerHTML=rows.length?`<table><thead><tr><th>Mã hồ sơ</th><th>Sinh viên</th><th>Lớp/Khoa</th><th>Trạng thái</th><th>Nhóm đạt</th><th></th></tr></thead><tbody>${rows.map(a=>`<tr><td><b>${esc(a.applicationId)}</b><br><span class="muted">${fmtDate(a.updatedAt)}</span></td><td>${esc(a.fullName)}<br><span class="muted">${esc(a.studentId)}</span></td><td>${esc(a.className)}<br><span class="muted">${esc(a.faculty)}</span></td><td>${badge(a.status)} ${a.finalResult?'<br>'+badge(a.finalResult):''}</td><td>${a.passGroups||0}/6</td><td><div class="account-actions"><button class="btn primary small" onclick="openDetail('${esc(a.applicationId)}')">Mở chấm</button>${APP.user.role==='ADMIN'?`<button class="btn bad small" onclick="deleteApplication('${esc(a.applicationId)}')">Xóa</button>`:''}</div></td></tr>`).join('')}</tbody></table>`:'<div class="alert warn">Không có hồ sơ.</div>'}catch(e){applicationList.innerHTML='<div class="alert bad">'+esc(e.message)+'</div>'}
}
async function openDetail(id){
  try{showLoading(true); const r=await jsonp('applicationDetail',{token:APP.token,applicationId:id}); detailBox.style.display='block'; detailBox.innerHTML=renderDetailTable(r); detailBox.scrollIntoView({behavior:'smooth'});}catch(e){alert(e.message)}finally{showLoading(false)}
}
function renderReviewBlock(appId, critId, level, item){
  const lv=getItemLevel(item, level);
  const canReview=item.itemType==='OPTION_EVIDENCE' || item.itemType==='REQUIRED_EVIDENCE';
  if(!canReview) return '';
  const cmtId='cmt_'+level+'_'+critId;
  return `<div class="review-level-box">
    <div class="review-level-label">${levelLabel(level)} · ${badge(lv.status||'PENDING')}</div>
    <label>Nhận xét</label>
    <input id="${cmtId}" value="${esc(lv.comment||'')}">
    <div class="toolbar" style="margin-top:8px">
      <button class="btn ok small" onclick="review('${esc(appId)}','${esc(critId)}','PASS','${level}')">Đạt</button>
      <button class="btn bad small" onclick="review('${esc(appId)}','${esc(critId)}','FAIL','${level}')">Không đạt</button>
      <button class="btn warn small" onclick="review('${esc(appId)}','${esc(critId)}','NEED_MORE','${level}')">Yêu cầu bổ sung</button>
    </div>
  </div>`;
}
function renderDetailTable(r){
  const a=r.application, ev={}; (r.evidences||[]).forEach(e=>(ev[e.criterionId]??=[]).push(e));
  let html=`<div class="box-title"><div><h2>Chấm hồ sơ ${esc(a.applicationId)}</h2><div class="desc">${esc(a.fullName)} - ${esc(a.studentId||'')} - ${esc(a.className)}</div></div><button class="btn secondary small" onclick="detailBox.style.display='none'">Đóng</button></div><div class="alert info">Tóm tắt CLB: ${badge(r.summary.overallPass?'ĐẠT':'KHÔNG ĐẠT')} Nhóm đạt <b>${r.summary.passGroups}/${r.summary.totalRequiredGroups}</b></div>`;
  html += '<div class="table-scroll"><table class="criteria-table"><thead><tr><th>STT</th><th>Tiêu chí lớn</th><th>Tiêu chí nhỏ</th><th>Tài liệu minh chứng</th><th class="level-col-head">KQ CLB</th><th class="level-col-head">Lý do CLB</th><th class="level-col-head">KQ Tỉnh</th><th class="level-col-head">Lý do Tỉnh</th><th class="level-col-head">KQ TW</th><th class="level-col-head">Lý do TW</th><th>Chấm duyệt</th></tr></thead><tbody>';

  (r.groups||[]).forEach((g,gi)=>{
    const items=g.items||[];
    const requiredItems=items.filter(x=>x.itemType==='REQUIRED_AUTO'||x.itemType==='REQUIRED_EVIDENCE');
    const optionItems=items.filter(x=>x.itemType==='OPTION_EVIDENCE');
    const optionNeed=Math.max(1,...optionItems.map(x=>Number(x.optionNeeded||x.minOptionPass||1)));
    const totalRows=(requiredItems.length?1+requiredItems.length:0)+(optionItems.length?1+optionItems.length:0)||1;
    let firstRow=true;

    function openRow(){
      let row='<tr>';
      if(firstRow){
        row += `<td class="order-cell" rowspan="${totalRows}">${gi+1}</td><td class="group-cell" rowspan="${totalRows}"><div class="group-label">${esc(displayGroupName(g.groupName))}</div></td>`;
        firstRow=false;
      }
      return row;
    }
    function itemRow(item, idxPrefix){
      const files=(ev[item.criterionId]||[]).sort((a,b)=>Number(a.evidenceOrder||0)-Number(b.evidenceOrder||0));
      let row=openRow();
      row += `<td><div class="criterion-title">${idxPrefix ? idxPrefix+'. ' : ''}${esc(item.label)}</div></td>`;
      row += `<td>${files.length?renderEvidenceList(files):'<div class="alert warn">Chưa có minh chứng.</div>'}</td>`;
      row += renderLevelResultCell(item,'CLUB')+renderLevelReasonCell(item,'CLUB')+renderLevelResultCell(item,'PROVINCE')+renderLevelReasonCell(item,'PROVINCE')+renderLevelResultCell(item,'CENTRAL')+renderLevelReasonCell(item,'CENTRAL');
      if(item.itemType==='OPTION_EVIDENCE' || item.itemType==='REQUIRED_EVIDENCE'){
        row += `<td>${renderReviewBlock(a.applicationId, item.criterionId, 'CLUB', item)}${renderReviewBlock(a.applicationId, item.criterionId, 'PROVINCE', item)}${renderReviewBlock(a.applicationId, item.criterionId, 'CENTRAL', item)}</td>`;
      }else{
        row += '<td><span class="muted">Tiêu chí tự động</span></td>';
      }
      return row+'</tr>';
    }

    if(requiredItems.length){
      html += openRow()+`<td colspan="9"><div class="criteria-section-title">Các tiêu chí bắt buộc</div></td></tr>`;
      requiredItems.forEach(item=>{ html += itemRow(item,''); });
    }
    if(optionItems.length){
      const label=optionNeed<=1?'Đạt thêm 01 trong các tiêu chí sau:':`Đạt tối thiểu ${optionNeed} trong các tiêu chí sau:`;
      html += openRow()+`<td colspan="9"><div class="criteria-section-title">${label}</div></td></tr>`;
      optionItems.forEach((item,i)=>{ html += itemRow(item,String(i+1)); });
    }
  });

  html += `</tbody></table></div><div class="box" style="margin-top:14px"><h3>Chốt kết quả</h3><label>Ghi chú</label><input id="finalNote_${esc(a.applicationId)}"><div class="toolbar" style="margin-top:10px"><button class="btn primary" onclick="finalize('${esc(a.applicationId)}','AUTO')">Chốt tự động</button><button class="btn ok" onclick="finalize('${esc(a.applicationId)}','PASS')">Chốt ĐẠT</button><button class="btn bad" onclick="finalize('${esc(a.applicationId)}','FAIL')">Chốt KHÔNG ĐẠT</button></div></div>`;
  return html;
}
async function review(appId,critId,status,level='CLUB'){
  try{
    const comment = document.getElementById('cmt_'+level+'_'+critId)?.value.trim() || '';
    if((status==='FAIL' || status==='NEED_MORE') && !comment){
      alert('Vui lòng ghi rõ lý do khi chấm Không đạt hoặc Yêu cầu bổ sung.');
      return;
    }
    showLoading(true);
    await postApi('reviewCriterion',{token:APP.token,applicationId:appId,criterionId:critId,status,comment,reviewLevel:level});
    await openDetail(appId);
    await loadDashboard();
  }catch(e){alert(e.message)}finally{showLoading(false)}
}
async function finalize(appId,mode){try{showLoading(true); await postApi('finalizeApplication',{token:APP.token,applicationId:appId,mode,note:document.getElementById('finalNote_'+appId)?.value||''}); await openDetail(appId); await loadDashboard()}catch(e){alert(e.message)}finally{showLoading(false)}}
async function exportResults(){try{const r=await jsonp('exportResults',{token:APP.token}); window.open(r.url,'_blank')}catch(e){alert(e.message)}}
async function exportResultsPdf(){try{showLoading(true); const r=await jsonp('exportResultsPdf',{token:APP.token}); window.open(r.url,'_blank')}catch(e){alert(e.message)}finally{showLoading(false)}}

async function loadUsers(){if(APP.user.role!=='ADMIN')return; try{const r=await jsonp('listUsers',{token:APP.token}); userManageBox.style.display='block'; userManageBox.innerHTML=`<div class="box-title"><div><h2>Quản lý tài khoản</h2><div class="desc">Admin có thể tạo tài khoản, khóa/mở tài khoản, đổi mật khẩu hoặc chuyển về mật khẩu mặc định 123456.</div></div></div>
<div class="field-grid">
  <div class="field col-3"><label>Email / Username</label><input id="u_username" placeholder="reviewer@dntu.edu.vn"></div>
  <div class="field col-3"><label>Mật khẩu</label><input id="u_password" placeholder="Để trống sẽ dùng 123456"></div>
  <div class="field col-3"><label>Họ tên</label><input id="u_fullName"></div>
  <div class="field col-3"><label>Email</label><input id="u_email"></div>
  <div class="field col-3"><label>Vai trò</label><select id="u_role"><option>REVIEWER</option><option>ADMIN</option><option>STUDENT</option></select></div>
  <div class="field col-3"><label>Khoa (người chấm)</label><select id="u_faculty">${facultySelectOptions('', true)}</select></div>
  <div class="field col-3"><label>Trạng thái</label><select id="u_active"><option value="true">Hoạt động</option><option value="false">Khóa</option></select></div>
</div>
<button class="btn primary" style="margin:10px 0" onclick="saveUser()">Tạo / cập nhật tài khoản</button>
<div class="table-scroll"><table><thead><tr><th>Email / Username</th><th>Họ tên</th><th>Vai trò</th><th>Khoa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${(r.users||[]).map(u=>`<tr><td><b>${esc(u.username)}</b><div class="mini-note">${esc(u.email||'')}</div></td><td>${esc(u.fullName||'')}</td><td>${esc(u.role)}</td><td>${esc(u.faculty||'')}</td><td>${u.active?'<span class="pill ok">Hoạt động</span>':'<span class="pill bad">Đã khóa</span>'}</td><td><div class="account-actions"><button class="btn ${u.active?'warn':'ok'} small" onclick="setUserActive('${esc(u.username)}',${!u.active})">${u.active?'Khóa':'Mở'}</button><button class="btn secondary small" onclick="resetUserDefault('${esc(u.username)}')">MK mặc định</button><button class="btn primary small" onclick="adminChangeUserPassword('${esc(u.username)}')">Đổi MK</button></div></td></tr>`).join('')}</tbody></table></div>`}catch(e){userManageBox.innerHTML='<div class="alert bad">'+esc(e.message)+'</div>'}}
async function saveUser(){try{await postApi('upsertUser',{token:APP.token,user:{username:u_username.value,passwordRaw:u_password.value,fullName:u_fullName.value,email:u_email.value,role:u_role.value,faculty:u_faculty.value,active:u_active.value==='true'}}); await loadUsers()}catch(e){alert(e.message)}}
async function loadCriteriaAdmin(){if(APP.user.role!=='ADMIN')return; try{const r=await jsonp('listCriteria',{token:APP.token}); criteriaManageBox.style.display='block'; criteriaManageBox.innerHTML=`<div class="box-title"><div><h2>Quản lý tiêu chí</h2><div class="desc">Admin có thể chỉnh sửa tiêu chí trực tiếp trong Google Sheet CRITERIA hoặc dùng phần này để thêm nhanh.</div></div></div><div class="field-grid"><div class="field col-3"><label>Group ID</label><input id="c_groupId" placeholder="VD: HOC_TAP"></div><div class="field col-3"><label>Tên nhóm</label><input id="c_groupName"></div><div class="field col-6"><label>Nội dung tiêu chí</label><input id="c_label"></div><div class="field col-3"><label>Loại</label><select id="c_itemType"><option value="REQUIRED_EVIDENCE">Tiêu chí bắt buộc có minh chứng</option><option value="OPTION_EVIDENCE">Tiêu chí lựa chọn chỉ cần đạt 01</option><option value="REQUIRED_AUTO">Tự động</option></select></div><div class="field col-3"><label>Rule tự động</label><input id="c_rule" placeholder="GPA_3, NO_F..."></div><div class="field col-3"><label>Thứ tự nhóm</label><input id="c_groupOrder" type="number" value="1"></div><div class="field col-3"><label>Thứ tự tiêu chí</label><input id="c_criterionOrder" type="number" value="1"></div></div><button class="btn primary" style="margin:10px 0" onclick="saveCriterion()">Thêm tiêu chí</button><table><thead><tr><th>Nhóm</th><th>Nội dung</th><th>Loại</th><th>Minh chứng</th><th>Trạng thái</th></tr></thead><tbody>${(r.criteria||[]).map(c=>`<tr><td>${esc(c.groupName)}</td><td>${esc(c.label)}</td><td>${esc(c.itemType)}</td><td>${c.evidenceRequired?'Bắt buộc':''}</td><td>${c.active?badge('PASS'):badge('FAIL')}</td></tr>`).join('')}</tbody></table>`}catch(e){}}
async function saveCriterion(){try{await postApi('upsertCriterion',{token:APP.token,criterion:{groupId:c_groupId.value,groupName:c_groupName.value,label:c_label.value,itemType:c_itemType.value,rule:c_rule.value,groupOrder:c_groupOrder.value,criterionOrder:c_criterionOrder.value,minOptionPass:1,active:true}}); await loadCriteriaAdmin(); await testApi()}catch(e){alert(e.message)}}

window.addEventListener('load', init);
