// Dán link Web App /exec của Google Apps Script vào đây trước khi upload lên GitHub Pages.
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbyoMap8EQZS2KtQty0ZgJ4SGLUjsDyd6AJ1z-D9GH0tJYjugG0XsBOvhjYIv-t3F8jmoA/exec';
const APP_BUILD = '20260625-user-list';
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
  orgUnits: { faculties: [], classesByFaculty: {}, allowCustomClass: true },
  personalEditing: false,
  applicationEditing: false,
  reviewAppId: ''
};
const PERSONAL_FIELD_IDS = ['app_fullName','app_gender','app_birthDate','app_ethnicity','app_yearOfStudy','app_faculty','app_className','app_classNameCustom','app_unionPosition','app_phone','app_studentNote'];


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
    showDashApp();
    applyLoginUi();
  }else{
    showAuthScreen();
  }
}
function showDashApp(){
  const auth=document.getElementById('authScreen');
  const dash=document.getElementById('dashApp');
  if(auth) auth.style.display='none';
  if(dash) dash.classList.add('active');
  closeDashSidebar();
}
function toggleDashSidebar(){
  const app=document.getElementById('dashApp');
  if(!app) return;
  const open=app.classList.toggle('nav-open');
  document.body.classList.toggle('dash-nav-locked', open);
}
function closeDashSidebar(){
  const app=document.getElementById('dashApp');
  if(app) app.classList.remove('nav-open');
  document.body.classList.remove('dash-nav-locked');
}
function showAuthScreen(){
  closeDashSidebar();
  const auth=document.getElementById('authScreen');
  const dash=document.getElementById('dashApp');
  if(auth) auth.style.display='flex';
  if(dash) dash.classList.remove('active');
}
function renderMiniCalendar(){
  const d=new Date();
  const y=d.getFullYear(), m=d.getMonth();
  const first=new Date(y,m,1).getDay();
  const days=new Date(y,m+1,0).getDate();
  const months=['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  let cells='';
  const pad=first===0?6:first-1;
  for(let i=0;i<pad;i++) cells+='<div class="cal-day muted"></div>';
  for(let day=1;day<=days;day++){
    cells+=`<div class="cal-day ${day===d.getDate()?'today':''}">${day}</div>`;
  }
  return `<div class="dash-mini-cal"><h4>${months[m]} ${y}</h4><div class="cal-grid">
    <div class="cal-head">T2</div><div class="cal-head">T3</div><div class="cal-head">T4</div><div class="cal-head">T5</div><div class="cal-head">T6</div><div class="cal-head">T7</div><div class="cal-head">CN</div>
    ${cells}</div></div>`;
}
function profileDisplayName(u){
  return (u.fullName||u.username||u.email||'?').trim();
}
function profileInitials(u){
  const name = profileDisplayName(u);
  const parts = name.split(/\s+/).filter(Boolean);
  if(parts.length >= 2) return (parts[0].charAt(0)+parts[parts.length-1].charAt(0)).toUpperCase();
  return name.charAt(0).toUpperCase();
}
function profileRoleLabel(u){
  return u.role==='STUDENT'?'Sinh viên':(u.role==='ADMIN'?'Admin':'Người chấm');
}
function renderAvatarBlock(u){
  const initials = profileInitials(u);
  const inner = u.avatarUrl
    ? `<img src="${esc(u.avatarUrl)}" class="dash-avatar-img" alt="Ảnh đại diện">`
    : `<span class="dash-avatar-text">${esc(initials)}</span>`;
  return `<label class="dash-avatar-wrap" title="Nhấn để đổi ảnh đại diện">
    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="dash-avatar-input" onchange="uploadAvatar(this)">
    ${inner}
    <span class="dash-avatar-edit" aria-hidden="true">📷</span>
  </label>`;
}
function renderProfileActions(){
  return `<div class="dash-profile-actions">
    <button type="button" class="btn secondary small" onclick="changeMyPassword()">Đổi mật khẩu</button>
    <button type="button" class="btn secondary small" onclick="logout()">Đăng xuất</button>
  </div>`;
}
function renderDashProfileCard(u, opts={}){
  const name = profileDisplayName(u);
  const loginId = (u.username||u.email||'').trim();
  const hint = opts.showHint ? '<span class="dash-avatar-hint">Nhấn ảnh để đổi</span>' : '';
  return `<div class="dash-profile-block">
    <div class="dash-profile">
      ${renderAvatarBlock(u)}
      <div class="dash-profile-meta">
        <b title="${esc(name)}">${esc(name)}</b>
        ${loginId && loginId.toLowerCase()!==name.toLowerCase() ? `<span class="dash-profile-email" title="${esc(loginId)}">${esc(loginId)}</span>` : ''}
        <span class="dash-profile-role">${esc(profileRoleLabel(u))}</span>
        ${hint}
      </div>
    </div>
    ${renderProfileActions()}
  </div>`;
}
async function uploadAvatar(input){
  const file = input && input.files && input.files[0];
  if(!file) return;
  if(!String(file.type||'').startsWith('image/')){ alert('Chỉ chấp nhận file ảnh.'); input.value=''; return; }
  if(file.size > 2*1024*1024){ alert('Ảnh đại diện tối đa 2MB.'); input.value=''; return; }
  try{
    showLoading(true);
    const res = await postApi('uploadAvatar',{
      token: APP.token,
      file: { fileName: file.name, mimeType: file.type, size: file.size, base64: await fileAsDataURL(file) }
    });
    if(res.user){
      APP.user = res.user;
    }else if(res.avatarUrl && APP.user){
      APP.user.avatarUrl = res.avatarUrl;
    }
    if(APP.user) localStorage.setItem('SV5T_USER', JSON.stringify(APP.user));
    renderDashProfiles();
    alert(res.message || 'Đã cập nhật ảnh đại diện.');
  }catch(e){ alert(e.message || 'Không tải được ảnh. Kiểm tra đã deploy Code.gs mới chưa.'); }
  finally{ showLoading(false); if(input) input.value=''; }
}
window.uploadAvatar = uploadAvatar;
function renderDashProfiles(){
  if(!APP.user) return;
  const u = APP.user;
  const aside=document.getElementById('dashAside');
  if(aside){
    aside.innerHTML=`
      ${renderDashProfileCard(u)}
      ${renderMiniCalendar()}
      <div class="dash-notice">
        <h4>Thông báo</h4>
        <div class="dash-notice-item"><b>Hệ thống SV5T</b><span>Nộp minh chứng đúng hạn xét duyệt.</span></div>
        <div class="dash-notice-item"><b>CLB Sinh viên 5 tốt</b><span>ĐH Công nghệ Đồng Nai</span></div>
      </div>`;
  }
  const sidebarProfile=document.getElementById('dashSidebarProfile');
  if(sidebarProfile) sidebarProfile.innerHTML = renderDashProfileCard(u);
  const studentProfile=document.getElementById('studentDashProfile');
  if(studentProfile) studentProfile.innerHTML = renderDashProfileCard(u, { showHint: true });
}
function renderDashAside(){ renderDashProfiles(); }
function renderDashCharts(s){
  const el=document.getElementById('dashCharts');
  if(!el) return;
  const pass=Number(s.pass||0), fail=Number(s.fail||0), sum=pass+fail||1;
  const passPct=Math.round(pass/sum*100);
  const max=Math.max(Number(s.total||0),Number(s.submitted||0),Number(s.needSupplement||0),Number(s.finalized||0),1);
  const bar=(val,label,blue)=>`<div class="dash-bar-col"><div class="dash-bar ${blue?'blue':''}" style="height:${Math.max(12,Math.round((val||0)/max*130))}px"></div><div class="dash-bar-label">${label}</div></div>`;
  el.innerHTML=`
    <div class="dash-chart-card"><h3>Phân bổ kết quả</h3>
      <div class="dash-donut-wrap">
        <div class="dash-donut" style="background:conic-gradient(var(--dash-orange) 0 ${passPct}%, var(--dash-blue) ${passPct}% 100%)">
          <div class="dash-donut-center">${pass+fail}</div>
        </div>
        <div class="dash-legend">
          <div class="dash-legend-item"><span class="dash-legend-dot orange"></span> Đạt: ${pass}</div>
          <div class="dash-legend-item"><span class="dash-legend-dot blue"></span> Không đạt: ${fail}</div>
        </div>
      </div>
    </div>
    <div class="dash-chart-card"><h3>Trạng thái hồ sơ</h3>
      <div class="dash-bars">${bar(s.submitted,'Đã nộp',false)}${bar(s.needSupplement,'Bổ sung',true)}${bar(s.finalized,'Đã chốt',false)}${bar(s.total,'Tổng',true)}</div>
    </div>`;
}
function showStudentSection(section, btn){
  closeDashSidebar();
  const overview=document.getElementById('studentOverviewSection');
  const appSec=document.getElementById('studentApplicationSection');
  document.querySelectorAll('.dash-sidebar .dash-nav .dash-nav-item').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const title=document.getElementById('dashPageTitle');
  if(section==='overview'){
    if(title) title.textContent='Tổng quan';
    if(overview) overview.style.display='block';
    if(appSec) appSec.style.display='none';
  }else{
    if(title) title.textContent='Hồ sơ & minh chứng';
    if(overview) overview.style.display='none';
    if(appSec) appSec.style.display='block';
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
  if(isStudentPortal()){
    if(APP.user.role!=='STUDENT'){ redirectToPortal('admin'); return; }
    showDashApp();
    const info=document.getElementById('studentInfoText');
    if(info) info.textContent=`${APP.user.fullName} - ${APP.user.studentId||''} - ${APP.user.faculty||''} - ${APP.user.className||''}`;
    renderDashAside();
    const navBtn=document.querySelector('.dash-sidebar .dash-nav .dash-nav-item');
    showStudentSection('overview', navBtn);
    loadMyApplication();
  } else {
    if(APP.user.role==='STUDENT'){ redirectToPortal('student'); return; }
    showDashApp();
    const info=document.getElementById('adminInfoText');
    if(info) info.textContent=`${APP.user.fullName||APP.user.username} - ${APP.user.role}`;
    document.querySelectorAll('[data-section="users"],[data-section="criteria"],[data-section="data"]').forEach(el=>{
      el.style.display=APP.user.role==='ADMIN'?'flex':'none';
    });
    renderDashAside();
    const navBtn=document.querySelector('.dash-nav-item[data-section="applications"]');
    showAdminSection('applications', navBtn);
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
    app_schoolYear.value=(res.application&&res.application.schoolYear)||'';
    if(!app_schoolYear.value){ const bs=await jsonp('bootstrap'); app_schoolYear.value=bs.schoolYear||'2025-2026'; }
    if(res.editWindow) APP.studentEditWindow = res.editWindow;
    if(res.orgUnits) APP.orgUnits = res.orgUnits;
    if(res.application){
      APP.applicationEditing = false;
      APP.personalEditing = false;
    }
    renderCriteriaTable(res);
    if(res.application){
      fillApplication(res);
      renderWorkflow(res.application.status);
      updateStudentActionButtons(res.application.status);
      studentStatus.innerHTML=renderStudentStatus(res);
      syncPersonalFormState(res.application.status, true);
      updateEditWindowBanner(res.application.status);
    }
    else { renderOrgUnitSelects(APP.user?.faculty||'', APP.user?.className||''); renderWorkflow('DRAFT'); updateStudentActionButtons('DRAFT'); studentStatus.innerHTML='<div class="alert warn">Bạn chưa có hồ sơ. Vui lòng nhập thông tin và nộp hồ sơ.</div>'; syncPersonalFormState('DRAFT', false); updateEditWindowBanner('DRAFT'); }
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
      saveBtn.disabled = !APP.applicationEditing;
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
  updatePersonalActionButtons(status);
  updateEditWindowBanner(status);
}

function isSubmittedEditPeriod(){
  const app = APP.myApp && APP.myApp.application ? APP.myApp.application : null;
  return !!(app && app.status === 'SUBMITTED' && isStudentEditWindowOpen());
}
function updateEditWindowBanner(status){
  const banner = document.getElementById('editWindowBanner');
  const text = document.getElementById('editWindowText');
  const editBtn = document.getElementById('btnEditApplication');
  const cancelBtn = document.getElementById('btnCancelApplicationEdit');
  const saveBtn = document.getElementById('btnSaveEvidence');
  if(!banner || !text || !editBtn || !cancelBtn || !saveBtn) return;

  if(!isSubmittedEditPeriod()){
    banner.style.display = 'none';
    return;
  }

  const ew = APP.studentEditWindow || {};
  const until = ew.untilDisplay ? (' Hạn: <b>'+esc(ew.untilDisplay)+'</b>.') : ' Không giới hạn thời gian cho đến khi admin tắt.';
  const editing = !!APP.applicationEditing;
  banner.style.display = 'block';
  banner.classList.toggle('is-editing', editing);
  text.innerHTML = editing
    ? '<b>Đang sửa hồ sơ.</b> Bạn có thể cập nhật thông tin cá nhân, thêm hoặc <b>xóa minh chứng</b> theo từng tiêu chí.'+until
    : '<b>Đang trong thời gian chỉnh sửa hồ sơ.</b>'+until+' Nhấn <b>Sửa hồ sơ</b> để chỉnh thông tin và minh chứng.';

  editBtn.style.display = editing ? 'none' : 'inline-flex';
  cancelBtn.style.display = editing ? 'inline-flex' : 'none';
  saveBtn.style.display = editing ? 'inline-flex' : 'none';
  saveBtn.disabled = !editing;
}
function rerenderCriteriaTable(){
  const res = APP.myApp && APP.myApp.application ? APP.myApp : null;
  renderCriteriaTable(res);
}
function toggleApplicationEdit(on){
  if(!isSubmittedEditPeriod()) return;
  APP.applicationEditing = on !== false;
  APP.personalEditing = APP.applicationEditing;
  syncPersonalFormState('SUBMITTED', false);
  rerenderCriteriaTable();
  updateEditWindowBanner('SUBMITTED');
  updateStudentActionButtons('SUBMITTED');
  const box = document.getElementById('personalInfoResult');
  if(box && APP.applicationEditing){
    box.innerHTML = '<div class="alert info">Bạn đang sửa hồ sơ. Có thể chỉnh thông tin cá nhân và xóa/thêm minh chứng. Nhấn <b>Lưu minh chứng</b> khi hoàn tất.</div>';
  }
}
function cancelApplicationEdit(){
  if(!isSubmittedEditPeriod()) return;
  if(APP.myApp) fillApplication(APP.myApp);
  APP.applicationEditing = false;
  APP.personalEditing = false;
  document.querySelectorAll('.evidence-row').forEach(row=>row.remove());
  syncPersonalFormState('SUBMITTED', false);
  rerenderCriteriaTable();
  updateEditWindowBanner('SUBMITTED');
  updateStudentActionButtons('SUBMITTED');
  const box = document.getElementById('personalInfoResult');
  if(box) box.innerHTML = '';
}

function canEditPersonalInfo(status){
  const st = status || (APP.myApp && APP.myApp.application && APP.myApp.application.status) || 'DRAFT';
  if(st === 'DRAFT') return true;
  if(st === 'SUBMITTED' && isStudentEditWindowOpen()) return !!APP.applicationEditing;
  return false;
}
function shouldAutoLockPersonal(status){
  const st = status || 'DRAFT';
  if(!APP.myApp || !APP.myApp.application) return false;
  if(st === 'DRAFT') return true;
  if(st === 'SUBMITTED' && isStudentEditWindowOpen()) return !APP.applicationEditing;
  if(st === 'SUBMITTED' && !isStudentEditWindowOpen()) return true;
  if(st === 'NEED_SUPPLEMENT' || st === 'FINALIZED') return true;
  return false;
}
function setPersonalFieldsLocked(locked){
  PERSONAL_FIELD_IDS.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.disabled = !!locked;
    el.classList.toggle('field-locked', !!locked);
  });
  const fac = document.getElementById('app_faculty');
  const cls = document.getElementById('app_className');
  if(fac) fac.disabled = !!locked;
  if(cls) cls.disabled = !!locked;
}
function syncPersonalFormState(status, afterLoad){
  const st = status || 'DRAFT';
  const hasApp = !!(APP.myApp && APP.myApp.application);
  if(afterLoad) APP.personalEditing = hasApp ? !shouldAutoLockPersonal(st) : true;
  else if(!hasApp) APP.personalEditing = true;
  const locked = hasApp && shouldAutoLockPersonal(st) && !APP.personalEditing;
  setPersonalFieldsLocked(locked);
  updatePersonalActionButtons(st);
}
function updatePersonalActionButtons(status){
  const editBtn = document.getElementById('btnEditPersonal');
  const cancelBtn = document.getElementById('btnCancelPersonal');
  const saveBtn = document.getElementById('btnSavePersonal');
  if(!editBtn || !cancelBtn || !saveBtn) return;
  const st = status || 'DRAFT';
  if(st === 'SUBMITTED' && isStudentEditWindowOpen()){
    editBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    saveBtn.style.display = 'none';
    return;
  }
  const canEdit = canEditPersonalInfo(st);
  const locked = shouldAutoLockPersonal(st) && !APP.personalEditing;
  const editing = APP.personalEditing && canEdit;

  editBtn.style.display = (canEdit && locked) ? 'inline-flex' : 'none';
  cancelBtn.style.display = editing ? 'inline-flex' : 'none';
  saveBtn.style.display = (canEdit && (!locked || editing)) ? 'inline-flex' : 'none';
  saveBtn.disabled = !canEdit;
  editBtn.disabled = !canEdit;
}
function togglePersonalEdit(on){
  const st = (APP.myApp && APP.myApp.application && APP.myApp.application.status) || 'DRAFT';
  if(!canEditPersonalInfo(st)) return;
  APP.personalEditing = on !== false;
  syncPersonalFormState(st, false);
  const box = document.getElementById('personalInfoResult');
  if(box && APP.personalEditing) box.innerHTML = '<div class="alert info">Bạn đang chỉnh sửa thông tin cá nhân. Nhấn <b>Lưu thông tin cá nhân</b> khi hoàn tất.</div>';
}
function cancelPersonalEdit(){
  if(APP.myApp) fillApplication(APP.myApp);
  else if(APP.user){
    renderOrgUnitSelects(APP.user.faculty||'', APP.user.className||'');
    app_fullName.value = APP.user.fullName||'';
    app_gender.value = APP.user.gender||'';
    app_birthDate.value = (APP.user.birthDate||'').slice(0,10);
    app_ethnicity.value = APP.user.ethnicity||'';
    app_yearOfStudy.value = APP.user.yearOfStudy||'';
    app_unionPosition.value = APP.user.unionPosition||'';
    app_phone.value = APP.user.phone||'';
    app_studentNote.value = '';
  }
  APP.personalEditing = false;
  const st = (APP.myApp && APP.myApp.application && APP.myApp.application.status) || 'DRAFT';
  syncPersonalFormState(st, false);
  const box = document.getElementById('personalInfoResult');
  if(box) box.innerHTML = '';
}
function validatePersonalFields(){
  const req = [
    ['app_fullName','Họ tên'],
    ['app_gender','Giới tính'],
    ['app_birthDate','Ngày sinh'],
    ['app_ethnicity','Dân tộc'],
    ['app_yearOfStudy','Năm thứ'],
    ['app_faculty','Khoa'],
    ['app_unionPosition','Chức vụ Đoàn, Hội'],
    ['app_phone','Số điện thoại']
  ];
  for(const [id, label] of req){
    const el = document.getElementById(id);
    if(!el || !String(el.value||'').trim()) return 'Vui lòng nhập '+label+'.';
  }
  if(!getAppClassNameValue()) return 'Vui lòng chọn hoặc nhập Lớp.';
  return '';
}
async function savePersonalInfo(){
  const box = document.getElementById('personalInfoResult');
  try{
    const err = validatePersonalFields();
    if(err) throw new Error(err);
    showLoading(true);
    const app = APP.myApp && APP.myApp.application ? APP.myApp.application : null;
    if(app && app.status === 'FINALIZED') throw new Error('Hồ sơ đã chốt kết quả, không thể cập nhật thông tin.');
    if(app && app.status === 'SUBMITTED' && (!isStudentEditWindowOpen() || !APP.applicationEditing)) throw new Error('Hồ sơ đã nộp và đang chờ duyệt. Nhấn Sửa hồ sơ trong thời gian admin cho phép để chỉnh thông tin cá nhân.');
    if(app && app.status === 'NEED_SUPPLEMENT') throw new Error('Hồ sơ đang cần bổ sung minh chứng. Vui lòng chỉ bổ sung minh chứng, không đổi thông tin cá nhân.');

    const payload={
      token:APP.token,
      application:{
        fullName:app_fullName.value,
        gender:app_gender.value,
        birthDate:app_birthDate.value,
        ethnicity:app_ethnicity.value,
        yearOfStudy:app_yearOfStudy.value,
        faculty:app_faculty.value,
        className:getAppClassNameValue(),
        unionPosition:app_unionPosition.value,
        phone:app_phone.value,
        schoolYear:app_schoolYear.value,
        studentNote:app_studentNote.value
      },
      claims:collectClaims(),
      files:[]
    };
    const res = await postApi('studentSaveApplication', payload);
    if(box) box.innerHTML = '<div class="alert ok">'+esc(res.message || 'Đã lưu thông tin cá nhân.')+'</div>';
    APP.personalEditing = false;
    if(app && app.status === 'SUBMITTED') APP.applicationEditing = false;
    await loadMyApplication();
  }catch(e){
    if(box) box.innerHTML = '<div class="alert bad">'+esc(e.message)+'</div>';
  }finally{
    showLoading(false);
  }
}

function renderStudentStatus(res){
  const a = res.application || {};
  const ew = APP.studentEditWindow || {};
  if(a.status === 'SUBMITTED'){
    if(isStudentEditWindowOpen()){
      const until = ew.untilDisplay ? (' Hạn chỉnh sửa: <b>'+esc(ew.untilDisplay)+'</b>.') : ' Không giới hạn thời gian cho đến khi admin tắt.';
      return '<div class="alert warn"><b>Admin đang mở thời gian chỉnh sửa hồ sơ.</b>'+until+' Vào <b>Hồ sơ &amp; minh chứng</b>, nhấn <b>Sửa hồ sơ</b> để chỉnh thông tin và xóa/thêm minh chứng, sau đó <b>Lưu minh chứng</b>.</div>';
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

  let html = '<div class="table-scroll criteria-scroll"><table class="criteria-table"><thead><tr><th>STT</th><th>Tiêu chí lớn</th><th>Tiêu chí nhỏ / điều kiện</th><th>Minh chứng yêu cầu</th><th>Tài liệu minh chứng</th><th class="level-col-head">KQ<br>CLB</th><th class="level-col-head">Lý do<br>CLB</th><th class="level-col-head">KQ<br>Tỉnh</th><th class="level-col-head">Lý do<br>Tỉnh</th><th class="level-col-head">KQ<br>TW</th><th class="level-col-head">Lý do<br>TW</th></tr></thead><tbody>';

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
  if(app.status === 'SUBMITTED') return isStudentEditWindowOpen() && !!APP.applicationEditing;
  return false;
}
function canAddEvidenceForCriterion(st){
  return canManageEvidenceForCriterion(st);
}
function renderEvidenceList(files, criterionId, st, readOnly){
  const canManage = readOnly ? false : canManageEvidenceForCriterion(st);
  if(!files.length) return '<div class="muted">Chưa có tài liệu minh chứng.</div>';
  const pdfs=files.filter(f=>fileKindOf(f)==='PDF');
  const imgs=files.filter(f=>fileKindOf(f)==='IMAGE');
  const renderItem=(f,tag)=>{
    const actions = canManage ? `<button type="button" class="btn bad small" style="margin-left:6px" onclick="deleteEvidence('${esc(f.evidenceId)}')">Xóa minh chứng</button>` : '';
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
    if(app && app.status === 'SUBMITTED' && !isStudentEditWindowOpen()) throw new Error('Hồ sơ đã nộp và đang chờ duyệt. Chỉ được sửa trong thời gian admin cho phép.');
    if(app && app.status === 'SUBMITTED' && isStudentEditWindowOpen() && !APP.applicationEditing) throw new Error('Nhấn Sửa hồ sơ trước khi lưu thay đổi minh chứng.');

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
    APP.applicationEditing = false;
    APP.personalEditing = false;
    await loadMyApplication();
  }catch(err){applicationResult.innerHTML='<div class="alert bad">'+esc(err.message)+'</div>'}
  finally{showLoading(false)}
}


function showAdminSection(section, btn){
  closeDashSidebar();
  document.querySelectorAll('.dash-nav-item[data-section]').forEach(b=>{
    b.classList.toggle('active', b===btn);
  });
  const titles={applications:'Dashboard',users:'Tài khoản',criteria:'Tiêu chí',data:'Cấu hình'};
  const titleEl=document.getElementById('dashPageTitle');
  if(titleEl) titleEl.textContent=titles[section]||'Dashboard';
  const searchWrap=document.getElementById('dashSearchWrap');
  if(searchWrap) searchWrap.style.display=section==='applications'?'block':'none';
  const reviewerDash=document.getElementById('reviewerDashboard');
  if(section!=='applications'){
    closeDetail();
  }else if(!APP.reviewAppId){
    if(reviewerDash) reviewerDash.style.display='block';
    if(detailBox) detailBox.style.display='none';
  }else{
    if(reviewerDash) reviewerDash.style.display='none';
  }
  ['userManageBox','criteriaManageBox','dataToolsBox'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });
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

async function deleteStudentUser(username){
  if(!confirm('Xóa tài khoản sinh viên '+username+'? Hồ sơ và minh chứng liên quan cũng sẽ bị xóa. Thao tác không thể hoàn tác.')) return;
  const typed = prompt('Nhập lại email/username để xác nhận: '+username);
  if(typed === null) return;
  if(String(typed).trim().toLowerCase() !== String(username).trim().toLowerCase()){
    alert('Xác nhận không khớp. Tài khoản chưa được xóa.');
    return;
  }
  try{
    showLoading(true);
    const res = await postApi('deleteUser',{token:APP.token,username});
    alert(res.message || 'Đã xóa tài khoản sinh viên.');
    await loadUsers();
    if(typeof loadDashboard === 'function') await loadDashboard();
  }catch(e){ alert(e.message); }
  finally{ showLoading(false); }
}


async function loadDashboard(){
  await Promise.all([loadStats(),loadApplications()]);
  if(APP.user.role==='ADMIN'){loadUsers();loadCriteriaAdmin();renderDataTools();}
}
async function loadStats(){
  try{
    const r=await jsonp('stats',{token:APP.token});
    const s=r.stats;
    const cards=[
      ['total','Tổng hồ sơ','orange'],
      ['submitted','Đã nộp','orange2'],
      ['needSupplement','Cần bổ sung','orange3'],
      ['pass','Đạt','blue']
    ];
    if(!statsBox) return;
    statsBox.innerHTML=cards.map(([k,l,cls])=>`<div class="dash-stat ${cls}"><div class="dash-stat-label">${l}</div><div class="dash-stat-num">${s[k]||0}</div></div>`).join('');
    renderDashCharts(s);
  }catch(e){
    if(statsBox) statsBox.innerHTML='<div class="alert bad">'+esc(e.message)+'</div>';
  }
}
function renderApplicationRow(a){
  const adminDelete = APP.user.role==='ADMIN'
    ? `<button type="button" class="btn bad small" onclick="deleteApplication('${esc(a.applicationId)}')">Xóa</button>`
    : '';
  return `<tr>
    <td data-label="Mã hồ sơ" class="app-col-id">
      <b class="app-id">${esc(a.applicationId)}</b>
      <span class="muted app-updated">${fmtDate(a.updatedAt)}</span>
    </td>
    <td data-label="Sinh viên" class="app-col-student">
      <span class="app-name">${esc(a.fullName)}</span>
      ${a.studentId ? `<span class="muted">${esc(a.studentId)}</span>` : ''}
    </td>
    <td data-label="Lớp/Khoa" class="app-col-class">
      <span>${esc(a.className)}</span>
      <span class="muted">${esc(a.faculty)}</span>
    </td>
    <td data-label="Trạng thái" class="app-col-status">
      ${badge(a.status)}${a.finalResult ? ' '+badge(a.finalResult) : ''}
    </td>
    <td data-label="Nhóm đạt" class="app-col-groups">${a.passGroups||0}/6</td>
    <td data-label="Thao tác" class="app-col-actions">
      <div class="account-actions app-row-actions">
        <button type="button" class="btn primary small" onclick="openDetail('${esc(a.applicationId)}')">Mở chấm</button>
        ${adminDelete}
      </div>
    </td>
  </tr>`;
}
async function loadApplications(){
  try{
    const r=await jsonp('listApplications',{token:APP.token,q:filterQ.value,status:filterStatus.value});
    const rows=r.applications||[];
    applicationList.innerHTML=rows.length
      ? `<div class="table-scroll app-list-scroll"><table class="app-list-table"><thead><tr>
          <th>Mã hồ sơ</th><th>Sinh viên</th><th>Lớp/Khoa</th><th>Trạng thái</th><th>Nhóm đạt</th><th>Thao tác</th>
        </tr></thead><tbody>${rows.map(renderApplicationRow).join('')}</tbody></table></div>`
      : '<div class="alert warn">Không có hồ sơ.</div>';
  }catch(e){applicationList.innerHTML='<div class="alert bad">'+esc(e.message)+'</div>'}
}
async function openDetail(id){
  try{
    showLoading(true);
    const r=await jsonp('applicationDetail',{token:APP.token,applicationId:id});
    APP.reviewAppId = id;
    const dash=document.getElementById('reviewerDashboard');
    if(dash) dash.style.display='none';
    detailBox.style.display='block';
    detailBox.classList.add('is-open');
    detailBox.innerHTML=renderDetailTable(r);
    const navBtn=document.querySelector('.dash-nav-item[data-section="applications"]');
    showAdminSection('applications', navBtn);
    detailBox.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){alert(e.message)}finally{showLoading(false)}
}
function closeDetail(){
  APP.reviewAppId = '';
  if(detailBox){
    detailBox.style.display='none';
    detailBox.classList.remove('is-open');
    detailBox.innerHTML='';
  }
  const dash=document.getElementById('reviewerDashboard');
  if(dash) dash.style.display='';
}
function adminReviewLevels(){
  return APP.user && APP.user.role === 'ADMIN' ? ['CLUB','PROVINCE','CENTRAL'] : ['CLUB'];
}
function renderReviewBlock(appId, critId, level, item){
  const lv=getItemLevel(item, level);
  const canReview=item.itemType==='OPTION_EVIDENCE' || item.itemType==='REQUIRED_EVIDENCE';
  if(!canReview) return '<span class="muted">—</span>';
  const boxId='review_'+level+'_'+critId;
  const cmtId='cmt_'+level+'_'+critId;
  const curStatus=lv.status || '';
  return `<div class="review-compact" id="${boxId}" data-status="${esc(curStatus)}">
    <div class="review-compact-head"><span class="review-level-tag">${levelLabel(level)}</span>${badge(curStatus||'PENDING')}</div>
    <label class="review-note-label">Ghi chú</label>
    <textarea id="${cmtId}" class="review-note" rows="2" placeholder="Nhận xét, lý do không đạt...">${esc(lv.comment||'')}</textarea>
    <div class="review-compact-actions">
      <button type="button" class="btn ok small review-status-btn${curStatus==='PASS'?' active':''}" onclick="setReviewStatus(this,'PASS')">Đạt</button>
      <button type="button" class="btn bad small review-status-btn${curStatus==='FAIL'?' active':''}" onclick="setReviewStatus(this,'FAIL')">Không đạt</button>
      <button type="button" class="btn warn small review-status-btn${curStatus==='NEED_MORE'?' active':''}" onclick="setReviewStatus(this,'NEED_MORE')">Bổ sung</button>
      <button type="button" class="btn primary small" onclick="saveReview('${esc(appId)}','${esc(critId)}','${level}')">Lưu</button>
    </div>
  </div>`;
}
function setReviewStatus(btn, status){
  const box=btn.closest('.review-compact');
  if(!box) return;
  box.dataset.status=status;
  box.querySelectorAll('.review-status-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
async function saveReview(appId,critId,level){
  const box=document.getElementById('review_'+level+'_'+critId);
  const status=box && box.dataset.status;
  if(!status || status==='PENDING'){
    alert('Vui lòng chọn Đạt, Không đạt hoặc Bổ sung trước khi lưu.');
    return;
  }
  const comment=document.getElementById('cmt_'+level+'_'+critId)?.value.trim()||'';
  await review(appId,critId,status,level,comment);
}
function renderDetailTable(r){
  const a=r.application, ev={}; (r.evidences||[]).forEach(e=>(ev[e.criterionId]??=[]).push(e));
  const levels=adminReviewLevels();
  const totalCols=4+levels.length;
  const sectionColspan=totalCols-2;
  const levelHeads=levels.map(l=>`<th class="level-col-head review-col-head">${esc(levelLabel(l))}</th>`).join('');

  let html=`<div class="detail-review-head">
    <div class="box-title"><div><h2>Chấm hồ sơ ${esc(a.applicationId)}</h2><div class="desc">${esc(a.fullName)} · ${esc(a.studentId||'')} · ${esc(a.className)} · ${esc(a.faculty||'')}</div></div>
    <button type="button" class="btn secondary small" onclick="closeDetail()">Đóng</button></div>
    <div class="alert info detail-review-summary">Tóm tắt CLB: ${badge(r.summary.overallPass?'ĐẠT':'KHÔNG ĐẠT')} · Nhóm đạt <b>${r.summary.passGroups}/${r.summary.totalRequiredGroups}</b> · ${badge(a.status)}</div>
  </div>`;
  html += `<div class="table-scroll criteria-scroll admin-review-scroll"><table class="criteria-table admin-review-table"><thead><tr>
    <th>STT</th><th>Tiêu chí lớn</th><th>Tiêu chí nhỏ</th><th>Tài liệu minh chứng</th>${levelHeads}
  </tr></thead><tbody>`;

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
      const canReview=item.itemType==='OPTION_EVIDENCE' || item.itemType==='REQUIRED_EVIDENCE';
      let row=openRow();
      row += `<td><div class="criterion-title">${idxPrefix ? idxPrefix+'. ' : ''}${esc(item.label)}</div></td>`;
      row += `<td class="evidence-cell">${files.length?renderEvidenceList(files, item.criterionId, item, true):'<div class="alert warn" style="margin:0">Chưa có minh chứng.</div>'}</td>`;
      if(canReview){
        levels.forEach(lv=>{ row += `<td class="review-col">${renderReviewBlock(a.applicationId, item.criterionId, lv, item)}</td>`; });
      }else{
        row += `<td colspan="${levels.length}" class="muted review-auto-cell">Tiêu chí tự động</td>`;
      }
      return row+'</tr>';
    }

    if(requiredItems.length){
      html += openRow()+`<td colspan="${sectionColspan}"><div class="criteria-section-title">Các tiêu chí bắt buộc</div></td></tr>`;
      requiredItems.forEach(item=>{ html += itemRow(item,''); });
    }
    if(optionItems.length){
      const label=optionNeed<=1?'Đạt thêm 01 trong các tiêu chí sau:':`Đạt tối thiểu ${optionNeed} trong các tiêu chí sau:`;
      html += openRow()+`<td colspan="${sectionColspan}"><div class="criteria-section-title">${label}</div></td></tr>`;
      optionItems.forEach((item,i)=>{ html += itemRow(item,String(i+1)); });
    }
  });

  html += `</tbody></table></div>`;
  if(APP.user.role==='ADMIN'){
    html += `<div class="detail-finalize box"><h3>Chốt kết quả</h3>
      <label>Ghi chú chốt</label>
      <input id="finalNote_${esc(a.applicationId)}" class="review-final-note" placeholder="Ghi chú khi chốt kết quả cuối...">
      <div class="toolbar detail-finalize-actions">
        <button type="button" class="btn primary" onclick="finalize('${esc(a.applicationId)}','AUTO')">Chốt tự động</button>
        <button type="button" class="btn ok" onclick="finalize('${esc(a.applicationId)}','PASS')">Chốt ĐẠT</button>
        <button type="button" class="btn bad" onclick="finalize('${esc(a.applicationId)}','FAIL')">Chốt KHÔNG ĐẠT</button>
      </div></div>`;
  }
  return html;
}
async function review(appId,critId,status,level='CLUB',comment){
  try{
    if(comment === undefined){
      comment = document.getElementById('cmt_'+level+'_'+critId)?.value.trim() || '';
    }
    if((status==='FAIL' || status==='NEED_MORE') && !comment){
      alert('Vui lòng ghi chú / lý do khi chấm Không đạt hoặc Yêu cầu bổ sung.');
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

function renderUserRow(u){
  const role=String(u.role||'').toUpperCase();
  const isStudent=role==='STUDENT';
  const deleteBtn=isStudent
    ? `<button type="button" class="btn bad small" onclick="deleteStudentUser('${esc(u.username)}')">Xóa SV</button>`
    : '';
  const rolePill=role==='ADMIN'?'blue':role==='STUDENT'?'warn':'navy';
  return `<tr>
    <td data-label="Email / Username" class="user-col-login">
      <b class="user-login">${esc(u.username)}</b>
      ${u.email ? `<span class="muted user-email">${esc(u.email)}</span>` : ''}
    </td>
    <td data-label="Họ tên" class="user-col-name">${esc(u.fullName||'—')}</td>
    <td data-label="Vai trò" class="user-col-role"><span class="pill ${rolePill}">${esc(u.role)}</span></td>
    <td data-label="Khoa" class="user-col-faculty">${esc(u.faculty||'—')}</td>
    <td data-label="Trạng thái" class="user-col-status">${u.active?'<span class="pill ok">Hoạt động</span>':'<span class="pill bad">Đã khóa</span>'}</td>
    <td data-label="Thao tác" class="user-col-actions">
      <div class="account-actions user-row-actions">
        <button type="button" class="btn ${u.active?'warn':'ok'} small" onclick="setUserActive('${esc(u.username)}',${!u.active})">${u.active?'Khóa':'Mở'}</button>
        <button type="button" class="btn secondary small" onclick="resetUserDefault('${esc(u.username)}')">MK mặc định</button>
        <button type="button" class="btn primary small" onclick="adminChangeUserPassword('${esc(u.username)}')">Đổi MK</button>
        ${deleteBtn}
      </div>
    </td>
  </tr>`;
}
async function loadUsers(){
  if(APP.user.role!=='ADMIN') return;
  try{
    const r=await jsonp('listUsers',{token:APP.token});
    userManageBox.style.display='block';
    const users=r.users||[];
    userManageBox.innerHTML=`
      <div class="box-title">
        <div>
          <h2>Quản lý tài khoản</h2>
          <div class="desc">Admin có thể tạo tài khoản, khóa/mở, đổi mật khẩu, hoặc <b>xóa tài khoản sinh viên</b> (kèm hồ sơ liên quan).</div>
        </div>
      </div>
      <div class="user-form-panel">
        <h3 class="user-form-title">Tạo / cập nhật tài khoản</h3>
        <div class="field-grid user-form-grid">
          <div class="field col-3"><label>Email / Username</label><input id="u_username" placeholder="reviewer@dntu.edu.vn"></div>
          <div class="field col-3"><label>Mật khẩu</label><input id="u_password" placeholder="Để trống sẽ dùng 123456"></div>
          <div class="field col-3"><label>Họ tên</label><input id="u_fullName"></div>
          <div class="field col-3"><label>Email</label><input id="u_email"></div>
          <div class="field col-3"><label>Vai trò</label><select id="u_role"><option>REVIEWER</option><option>ADMIN</option><option>STUDENT</option></select></div>
          <div class="field col-3"><label>Khoa (người chấm)</label><select id="u_faculty">${facultySelectOptions('', true)}</select></div>
          <div class="field col-3"><label>Trạng thái</label><select id="u_active"><option value="true">Hoạt động</option><option value="false">Khóa</option></select></div>
        </div>
        <div class="user-form-actions">
          <button type="button" class="btn primary" onclick="saveUser()">Lưu tài khoản</button>
        </div>
      </div>
      <div class="user-list-head">
        <h3>Danh sách tài khoản</h3>
        <span class="user-list-count">${users.length} tài khoản</span>
      </div>
      ${users.length
        ? `<div class="table-scroll user-list-scroll"><table class="user-list-table"><thead><tr>
            <th>Email / Username</th><th>Họ tên</th><th>Vai trò</th><th>Khoa</th><th>Trạng thái</th><th>Thao tác</th>
          </tr></thead><tbody>${users.map(renderUserRow).join('')}</tbody></table></div>`
        : '<div class="alert warn">Chưa có tài khoản nào.</div>'}`;
  }catch(e){
    userManageBox.innerHTML='<div class="alert bad">'+esc(e.message)+'</div>';
  }
}
async function saveUser(){try{await postApi('upsertUser',{token:APP.token,user:{username:u_username.value,passwordRaw:u_password.value,fullName:u_fullName.value,email:u_email.value,role:u_role.value,faculty:u_faculty.value,active:u_active.value==='true'}}); await loadUsers()}catch(e){alert(e.message)}}
async function loadCriteriaAdmin(){if(APP.user.role!=='ADMIN')return; try{const r=await jsonp('listCriteria',{token:APP.token}); criteriaManageBox.style.display='block'; criteriaManageBox.innerHTML=`<div class="box-title"><div><h2>Quản lý tiêu chí</h2><div class="desc">Admin có thể chỉnh sửa tiêu chí trực tiếp trong Google Sheet CRITERIA hoặc dùng phần này để thêm nhanh.</div></div></div><div class="field-grid"><div class="field col-3"><label>Group ID</label><input id="c_groupId" placeholder="VD: HOC_TAP"></div><div class="field col-3"><label>Tên nhóm</label><input id="c_groupName"></div><div class="field col-6"><label>Nội dung tiêu chí</label><input id="c_label"></div><div class="field col-3"><label>Loại</label><select id="c_itemType"><option value="REQUIRED_EVIDENCE">Tiêu chí bắt buộc có minh chứng</option><option value="OPTION_EVIDENCE">Tiêu chí lựa chọn chỉ cần đạt 01</option><option value="REQUIRED_AUTO">Tự động</option></select></div><div class="field col-3"><label>Rule tự động</label><input id="c_rule" placeholder="GPA_3, NO_F..."></div><div class="field col-3"><label>Thứ tự nhóm</label><input id="c_groupOrder" type="number" value="1"></div><div class="field col-3"><label>Thứ tự tiêu chí</label><input id="c_criterionOrder" type="number" value="1"></div></div><button class="btn primary" style="margin:10px 0" onclick="saveCriterion()">Thêm tiêu chí</button><table><thead><tr><th>Nhóm</th><th>Nội dung</th><th>Loại</th><th>Minh chứng</th><th>Trạng thái</th></tr></thead><tbody>${(r.criteria||[]).map(c=>`<tr><td>${esc(c.groupName)}</td><td>${esc(c.label)}</td><td>${esc(c.itemType)}</td><td>${c.evidenceRequired?'Bắt buộc':''}</td><td>${c.active?badge('PASS'):badge('FAIL')}</td></tr>`).join('')}</tbody></table>`}catch(e){}}
async function saveCriterion(){try{await postApi('upsertCriterion',{token:APP.token,criterion:{groupId:c_groupId.value,groupName:c_groupName.value,label:c_label.value,itemType:c_itemType.value,rule:c_rule.value,groupOrder:c_groupOrder.value,criterionOrder:c_criterionOrder.value,minOptionPass:1,active:true}}); await loadCriteriaAdmin(); await testApi()}catch(e){alert(e.message)}}

window.addEventListener('load', init);
window.addEventListener('resize', ()=>{ if(window.innerWidth > 1024) closeDashSidebar(); });
