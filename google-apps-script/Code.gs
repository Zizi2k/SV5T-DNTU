/**
 * HỆ THỐNG XÉT SINH VIÊN 5 TỐT - BACKEND 01 SCRIPT
 * Mô hình triển khai:
 * - Frontend tách riêng: index.html upload GitHub Pages.
 * - Backend duy nhất: Google Apps Script Web App.
 * - Database: Google Sheets tự tạo.
 * - Lưu minh chứng: Google Drive tự tạo.
 *
 * Cách dùng:
 * 1) Tạo Apps Script project mới.
 * 2) Dán toàn bộ file này vào Code.gs.
 * 3) Chạy setupSV5T() một lần.
 * 4) Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone with the link
 * 5) Copy link /exec dán vào biến API_URL trong file index.html hoặc nhập trong giao diện cấu hình.
 *
 * Tài khoản mặc định:
 * - admin / 123456
 */

const SV5T = {
  APP_NAME: 'Hệ thống xét Sinh viên 5 tốt - CLB SV5T',
  PROP: {
    SS_ID: 'SV5T_SPREADSHEET_ID',
    ROOT_ID: 'SV5T_ROOT_FOLDER_ID',
    EVIDENCE_ID: 'SV5T_EVIDENCE_FOLDER_ID',
    EXPORT_ID: 'SV5T_EXPORT_FOLDER_ID',
    BACKUP_ID: 'SV5T_BACKUP_FOLDER_ID'
  },
  SHEETS: {
    CONFIG: 'CONFIG',
    USERS: 'USERS',
    CRITERIA: 'CRITERIA',
    APPLICATIONS: 'APPLICATIONS',
    CLAIMS: 'CLAIMS',
    EVIDENCES: 'EVIDENCES',
    REVIEWS: 'REVIEWS',
    AUDIT_LOG: 'AUDIT_LOG'
  },
  ROLE: {
    STUDENT: 'STUDENT',
    REVIEWER: 'REVIEWER',
    ADMIN: 'ADMIN'
  },
  APP_STATUS: {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    NEED_SUPPLEMENT: 'NEED_SUPPLEMENT',
    FINALIZED: 'FINALIZED',
    CANCELLED: 'CANCELLED'
  },
  REVIEW: {
    PENDING: 'PENDING',
    PASS: 'PASS',
    FAIL: 'FAIL',
    NEED_MORE: 'NEED_MORE'
  }
};

const HEADERS = {
  CONFIG: ['key', 'value', 'note', 'updatedAt'],
  USERS: [
    'userId', 'username', 'passwordHash', 'passwordRaw', 'passwordSha256',
    'fullName', 'email', 'phone',
    'role', 'studentId', 'gender', 'birthDate', 'ethnicity',
    'faculty', 'className', 'unionPosition', 'yearOfStudy',
    'active', 'createdAt', 'updatedAt', 'lastLoginAt'
  ],
  CRITERIA: [
    'criterionId', 'groupId', 'groupName', 'groupOrder', 'criterionOrder',
    'itemType', 'label', 'rule', 'minOptionPass', 'evidenceRequired',
    'allowMultipleEvidence', 'active', 'sourceText', 'updatedAt'
  ],
  APPLICATIONS: [
    'applicationId', 'studentUserId', 'studentId', 'fullName', 'gender',
    'birthDate', 'ethnicity', 'email', 'phone', 'faculty',
    'className', 'unionPosition', 'yearOfStudy', 'schoolYear',
    'gpa', 'noF', 'conductScore', 'noViolation', 'nominated',
    'status', 'studentNote', 'createdAt', 'submittedAt', 'updatedAt',
    'finalResult', 'finalNote', 'finalizedBy', 'finalizedAt',
    'driveFolderId', 'computedJson'
  ],
  CLAIMS: [
    'claimId', 'applicationId', 'criterionId', 'groupId',
    'selected', 'studentNote', 'createdAt', 'updatedAt'
  ],
  EVIDENCES: [
    'evidenceId', 'applicationId', 'criterionId', 'groupId',
    'evidenceOrder', 'criterionEvidenceNo', 'evidenceTitle',
    'fileId', 'fileName', 'fileUrl', 'mimeType',
    'sizeBytes', 'uploadedBy', 'uploadedAt', 'note'
  ],
  REVIEWS: [
    'reviewId', 'applicationId', 'criterionId', 'reviewerUserId',
    'reviewerUsername', 'status', 'comment', 'reviewedAt'
  ],
  AUDIT_LOG: [
    'logId', 'actorUserId', 'actorUsername', 'action',
    'targetType', 'targetId', 'timestamp', 'payloadJson'
  ]
};

/***********************
 * WEB APP ENTRYPOINTS
 ***********************/
function doGet(e) {
  ensureSetup_();
  const p = (e && e.parameter) || {};
  const action = clean_(p.action || 'ping');
  const callback = clean_(p.callback || '');

  try {
    const result = routeGet_(action, p);
    return output_(result, callback);
  } catch (err) {
    return output_(fail_(err), callback);
  }
}

function doPost(e) {
  ensureSetup_();

  const p = (e && e.parameter) || {};
  const action = clean_(p.action);
  const requestId = clean_(p.requestId) || Utilities.getUuid();
  const payloadText = p.payload || '{}';

  let result;
  try {
    const payload = JSON.parse(payloadText || '{}');
    result = routePost_(action, payload);
  } catch (err) {
    result = fail_(err);
  }

  CacheService.getScriptCache().put('SV5T_REQ_' + requestId, JSON.stringify(result), 600);

  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"></head><body>OK</body></html>'
  );
}

function routeGet_(action, p) {
  switch (action) {
    case 'ping':
      return ok_({ message: 'SV5T API is running', appName: SV5T.APP_NAME });
    case 'bootstrap':
      return apiBootstrap_();
    case 'getRequestResult':
      return apiGetRequestResult_(p.requestId);
    case 'login':
      return apiLogin_(p.username, p.password, p.passwordSha256);
    case 'logout':
      return apiLogout_(p.token);
    case 'me':
      return apiMe_(p.token);
    case 'myApplication':
      return apiMyApplication_(p.token);
    case 'applicationDetail':
      return apiApplicationDetail_(p.token, p.applicationId);
    case 'listApplications':
      return apiListApplications_(p.token, {
        q: p.q || '',
        status: p.status || '',
        schoolYear: p.schoolYear || ''
      });
    case 'stats':
      return apiStats_(p.token);
    case 'listUsers':
      return apiListUsers_(p.token);
    case 'listCriteria':
      return apiListCriteria_(p.token);
    case 'exportResults':
      return apiExportResults_(p.token);
    default:
      throw new Error('Action GET không hợp lệ: ' + action);
  }
}

function routePost_(action, payload) {
  payload = payload || {};
  switch (action) {
    case 'register':
      return apiRegister_(payload);
    case 'studentSaveApplication':
      return apiStudentSaveApplication_(payload.token, payload.application, payload.claims, payload.files, false);
    case 'studentSubmitApplication':
      return apiStudentSaveApplication_(payload.token, payload.application, payload.claims, payload.files, true);
    case 'studentSupplement':
      return apiStudentSupplement_(payload.token, payload.claims, payload.files);
    case 'reviewCriterion':
      return apiReviewCriterion_(payload.token, payload);
    case 'finalizeApplication':
      return apiFinalizeApplication_(payload.token, payload);
    case 'upsertUser':
      return apiUpsertUser_(payload.token, payload.user);
    case 'resetUserPassword':
      return apiResetUserPassword_(payload.token, payload.username, payload.newPassword);
    case 'setUserActive':
      return apiSetUserActive_(payload.token, payload.username, payload.active);
    case 'changeMyPassword':
      return apiChangeMyPassword_(payload.token, payload.oldPasswordSha256, payload.oldPasswordRaw, payload.newPasswordRaw, payload.newPasswordSha256);
    case 'deleteApplication':
      return apiDeleteApplication_(payload.token, payload.applicationId);
    case 'clearApplicationData':
      return apiClearApplicationData_(payload.token, payload.confirmText);
    case 'upsertCriterion':
      return apiUpsertCriterion_(payload.token, payload.criterion);
    case 'toggleCriterion':
      return apiToggleCriterion_(payload.token, payload.criterionId, payload.active);
    case 'updateConfig':
      return apiUpdateConfig_(payload.token, payload.key, payload.value, payload.note);
    default:
      throw new Error('Action POST không hợp lệ: ' + action);
  }
}

function output_(obj, callback) {
  const json = JSON.stringify(obj || {});
  if (callback) {
    return ContentService
      .createTextOutput(String(callback) + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/***********************
 * SETUP
 ***********************/
function setupSV5T() {
  const info = install_(true);
  Logger.log(JSON.stringify(info, null, 2));
  return info;
}

function ensureSetup_() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty(SV5T.PROP.SS_ID);
  const rootId = props.getProperty(SV5T.PROP.ROOT_ID);
  if (!ssId || !rootId) return install_(false);

  try {
    SpreadsheetApp.openById(ssId).getName();
    DriveApp.getFolderById(rootId).getName();
    return { spreadsheetId: ssId, rootFolderId: rootId };
  } catch (err) {
    return install_(false);
  }
}

function install_(force) {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(SV5T.PROP.SS_ID);
  let rootId = props.getProperty(SV5T.PROP.ROOT_ID);
  let evidenceId = props.getProperty(SV5T.PROP.EVIDENCE_ID);
  let exportId = props.getProperty(SV5T.PROP.EXPORT_ID);
  let backupId = props.getProperty(SV5T.PROP.BACKUP_ID);

  if (force) {
    ssId = '';
    rootId = '';
    evidenceId = '';
    exportId = '';
    backupId = '';
  }

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');

  if (!ssId) {
    const ss = SpreadsheetApp.create('SV5T_DATABASE_CNTT_' + stamp);
    ssId = ss.getId();
    props.setProperty(SV5T.PROP.SS_ID, ssId);
  }

  if (!rootId) {
    const folder = DriveApp.createFolder('SV5T_DRIVE_CNTT_' + stamp);
    rootId = folder.getId();
    props.setProperty(SV5T.PROP.ROOT_ID, rootId);
  }

  const root = DriveApp.getFolderById(rootId);

  if (!evidenceId) {
    evidenceId = getOrCreateChildFolder_(root, '01_MINH_CHUNG').getId();
    props.setProperty(SV5T.PROP.EVIDENCE_ID, evidenceId);
  }
  if (!exportId) {
    exportId = getOrCreateChildFolder_(root, '02_XUAT_BAO_CAO').getId();
    props.setProperty(SV5T.PROP.EXPORT_ID, exportId);
  }
  if (!backupId) {
    backupId = getOrCreateChildFolder_(root, '03_BACKUP').getId();
    props.setProperty(SV5T.PROP.BACKUP_ID, backupId);
  }

  const ss = SpreadsheetApp.openById(ssId);
  Object.keys(HEADERS).forEach(function (key) {
    createOrRepairSheet_(ss, SV5T.SHEETS[key], HEADERS[key]);
  });

  seedConfig_();
  seedCriteria_();
  seedAdmin_();

  return {
    ok: true,
    message: 'Đã tạo/cập nhật hệ thống SV5T thành công.',
    spreadsheetId: ssId,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + ssId + '/edit',
    rootFolderId: rootId,
    rootFolderUrl: 'https://drive.google.com/drive/folders/' + rootId,
    evidenceFolderId: evidenceId,
    exportFolderId: exportId,
    defaultAdmin: 'admin / 123456'
  };
}

function createOrRepairSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
    const missing = headers.filter(function (h) { return current.indexOf(h) === -1; });
    if (current.join('|') !== headers.join('|')) {
      const finalHeaders = current.filter(function (h) { return h; }).concat(missing);
      sh.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
    }
  }
  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, sh.getLastColumn()); } catch (err) {}
}

function seedConfig_() {
  const sh = getSheet_(SV5T.SHEETS.CONFIG);
  if (sh.getLastRow() > 1) return;
  appendObjects_(SV5T.SHEETS.CONFIG, [
    { key: 'APP_TITLE', value: 'Hệ thống xét Sinh viên 5 tốt - CLB SV5T', note: 'Tiêu đề hiển thị', updatedAt: new Date() },
    { key: 'SCHOOL_YEAR', value: '2025-2026', note: 'Năm học mặc định', updatedAt: new Date() },
    { key: 'ALLOW_REGISTER', value: 'TRUE', note: 'TRUE: cho phép sinh viên đăng ký tài khoản', updatedAt: new Date() },
    { key: 'ALLOW_SUBMIT', value: 'TRUE', note: 'TRUE: cho phép nộp/bổ sung hồ sơ', updatedAt: new Date() },
    { key: 'MAX_FILE_MB', value: '8', note: 'Giới hạn dung lượng mỗi file minh chứng', updatedAt: new Date() },
    { key: 'SHARE_EVIDENCE_BY_LINK', value: 'TRUE', note: 'TRUE: minh chứng mở được bằng link', updatedAt: new Date() },
    { key: 'ORGANIZATION_LINE_1', value: 'HỘI SINH VIÊN VIỆT NAM', note: 'Dòng đơn vị 1', updatedAt: new Date() },
    { key: 'ORGANIZATION_LINE_2', value: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ ĐỒNG NAI', note: 'Dòng đơn vị 2', updatedAt: new Date() },
    { key: 'ORGANIZATION_LINE_3', value: 'CLB SV5T', note: 'Dòng đơn vị 3', updatedAt: new Date() }
  ]);
}

function seedAdmin_() {
  const users = readObjects_(SV5T.SHEETS.USERS);
  if (users.length) return;
  const now = new Date();
  appendObjects_(SV5T.SHEETS.USERS, [{
    userId: Utilities.getUuid(),
    username: 'admin',
    passwordHash: hashPassword_('admin', '123456'),
    passwordRaw: '123456',
    passwordSha256: sha256Hex_('123456'),
    fullName: 'Quản trị hệ thống',
    email: 'admin',
    phone: '',
    role: SV5T.ROLE.ADMIN,
    studentId: '',
    faculty: '*',
    className: '',
    yearOfStudy: '',
    active: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: ''
  }]);
}

function seedCriteria_() {
  const sh = getSheet_(SV5T.SHEETS.CRITERIA);
  if (sh.getLastRow() > 1) return;
  appendObjects_(SV5T.SHEETS.CRITERIA, defaultCriteria_());
}

function capNhatTieuChiCapKhoa_XACNHAN() {
  ensureSetup_();
  const sh = getSheet_(SV5T.SHEETS.CRITERIA);
  const last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
  appendObjects_(SV5T.SHEETS.CRITERIA, defaultCriteria_());
  Logger.log('Đã cập nhật lại bộ tiêu chí cấp Khoa. Tất cả tiêu chí xét đều dùng minh chứng.');
  return { ok: true, message: 'Đã cập nhật lại bộ tiêu chí cấp Khoa.' };
}


function defaultCriteria_() {
  return [
    // 0. Tiêu chuẩn chung - bắt buộc
    crit_('GEN_STUDY_STANDARD', 'GENERAL', '0. Tiêu chuẩn chung', 0, 1, 'REQUIRED_EVIDENCE', 'Điểm học tập đạt theo tiêu chuẩn quy định.', '', 0, true, true, 'Minh chứng: bảng điểm/kết quả học tập năm học hoặc xác nhận của đơn vị có thẩm quyền.'),
    crit_('GEN_LCH_NOMINATE', 'GENERAL', '0. Tiêu chuẩn chung', 0, 2, 'REQUIRED_EVIDENCE', 'Được Liên chi hội đề nghị xét ở cấp trường/cấp xét tương ứng.', '', 0, true, true, 'Minh chứng: danh sách đề nghị, biên bản họp xét, xác nhận của Liên chi hội/Khoa/Đoàn - Hội.'),

    // 1. Đạo đức tốt
    crit_('DD_CONDUCT_80', 'DAO_DUC', '1. Đạo đức tốt', 1, 1, 'REQUIRED_EVIDENCE', 'Điểm rèn luyện đạt từ 80 điểm trở lên trên thang điểm 100 theo quy định đánh giá công tác học sinh, sinh viên.', '', 0, true, true, 'Minh chứng: bảng điểm/kết quả đánh giá rèn luyện năm học có xác nhận hoặc ảnh chụp từ hệ thống hợp lệ.'),
    crit_('DD_NO_VIOLATION', 'DAO_DUC', '1. Đạo đức tốt', 1, 2, 'REQUIRED_EVIDENCE', 'Không vi phạm pháp luật và các quy chế, nội quy của Nhà trường, quy định của địa phương và cộng đồng.', '', 0, true, true, 'Minh chứng: bản xác nhận của Khoa/Đoàn - Hội/Lớp hoặc bản cam kết/xác nhận theo mẫu được duyệt.'),
    crit_('DD_MARX_LENIN', 'DAO_DUC', '1. Đạo đức tốt', 1, 3, 'OPTION_EVIDENCE', 'Là thành viên đội thi tìm hiểu về Chủ nghĩa Mác - Lênin, tư tưởng Hồ Chí Minh hoặc tham gia các cuộc thi tìm hiểu Mác - Lênin, tư tưởng Hồ Chí Minh trực tuyến từ cấp Khoa trở lên.', '', 1, true, true, 'Minh chứng: xác nhận của Hội Sinh viên/Đoàn Thanh niên, giấy chứng nhận, danh sách tham gia hoặc xác nhận thành viên đội tuyển.'),
    crit_('DD_GOOD_PERSON', 'DAO_DUC', '1. Đạo đức tốt', 1, 4, 'OPTION_EVIDENCE', 'Là thanh niên tiêu biểu, thanh niên tiên tiến, gương người tốt, việc tốt, có hành động dũng cảm cứu người hoặc được biểu dương.', '', 1, true, true, 'Minh chứng: giấy khen, giấy chứng nhận, quyết định khen thưởng, bài đăng/xác nhận của đơn vị có thẩm quyền.'),

    // 2. Học tập tốt
    crit_('HT_GPA_3_NO_F', 'HOC_TAP', '2. Học tập tốt', 2, 1, 'REQUIRED_EVIDENCE', 'Điểm trung bình học tập cả năm đạt từ 3.0/4.0 trở lên và không có môn điểm F.', '', 0, true, true, 'Minh chứng: bảng điểm/kết quả học tập năm học thể hiện điểm trung bình và không có môn điểm F.'),
    crit_('HT_RESEARCH_AWARD', 'HOC_TAP', '2. Học tập tốt', 2, 2, 'OPTION_EVIDENCE', 'Có đề tài nghiên cứu khoa học sinh viên đạt giải từ cấp Khoa trở lên.', '', 1, true, true, 'Minh chứng: quyết định công nhận, giấy chứng nhận, giấy khen hoặc danh sách đạt giải.'),
    crit_('HT_JOURNAL', 'HOC_TAP', '2. Học tập tốt', 2, 3, 'OPTION_EVIDENCE', 'Có ít nhất 01 bài viết đăng trên tạp chí chuyên ngành.', '', 1, true, true, 'Minh chứng: bài báo, trang bìa, mục lục, đường dẫn hoặc xác nhận đăng bài.'),
    crit_('HT_CONFERENCE', 'HOC_TAP', '2. Học tập tốt', 2, 4, 'OPTION_EVIDENCE', 'Có bài tham luận tham gia các hội thảo khoa học từ cấp Khoa trở lên.', '', 1, true, true, 'Minh chứng: giấy chứng nhận, thư mời, chương trình hội thảo, kỷ yếu hoặc xác nhận tham gia.'),
    crit_('HT_PATENT_PRODUCT', 'HOC_TAP', '2. Học tập tốt', 2, 5, 'OPTION_EVIDENCE', 'Có sản phẩm sáng tạo được cấp bằng sáng chế hoặc sản phẩm sáng tạo được công nhận.', '', 1, true, true, 'Minh chứng: bằng sáng chế, giấy chứng nhận, quyết định công nhận, hình ảnh sản phẩm hoặc xác nhận của đơn vị.'),
    crit_('HT_ACADEMIC_TEAM', 'HOC_TAP', '2. Học tập tốt', 2, 6, 'OPTION_EVIDENCE', 'Là thành viên các đội tuyển tham gia các kỳ thi học thuật từ cấp Khoa trở lên.', '', 1, true, true, 'Minh chứng: danh sách đội tuyển, giấy chứng nhận tham gia hoặc xác nhận của đơn vị phụ trách.'),
    crit_('HT_CREATIVE_CONTEST', 'HOC_TAP', '2. Học tập tốt', 2, 7, 'OPTION_EVIDENCE', 'Đạt giải trong các cuộc thi ý tưởng sáng tạo hoặc được tuyên dương từ cấp Khoa trở lên.', '', 1, true, true, 'Minh chứng: giấy chứng nhận, giấy khen, quyết định hoặc thông báo kết quả.'),

    // 3. Thể lực tốt - đạt 01 trong 02
    crit_('TL_THANH_NIEN_KHOE', 'THE_LUC', '3. Thể lực tốt', 3, 1, 'OPTION_EVIDENCE', 'Đạt danh hiệu “Thanh niên khỏe” từ cấp Khoa trở lên.', '', 1, true, true, 'Minh chứng: giấy chứng nhận, danh sách công nhận hoặc xác nhận danh hiệu Thanh niên khỏe.'),
    crit_('TL_SPORT_AWARD', 'THE_LUC', '3. Thể lực tốt', 3, 2, 'OPTION_EVIDENCE', 'Tham gia và đạt giải cấp Khoa trở lên tại các hoạt động thể thao phong trào.', '', 1, true, true, 'Minh chứng: giấy chứng nhận, giấy khen, danh sách đạt giải hoặc xác nhận của đơn vị tổ chức.'),

    // 4. Tình nguyện tốt - đạt 01 trong 02
    crit_('TN_VOLUNTEER_5_DAYS', 'TINH_NGUYEN', '4. Tình nguyện tốt', 4, 1, 'OPTION_EVIDENCE', 'Tham gia ít nhất 05 ngày/hoạt động tình nguyện của năm học.', '', 1, true, true, 'Minh chứng: chứng nhận, xác nhận từ tổ chức thực hiện, danh sách tình nguyện viên hoặc hình ảnh kèm xác nhận.'),
    crit_('TN_VOLUNTEER_AWARD', 'TINH_NGUYEN', '4. Tình nguyện tốt', 4, 2, 'OPTION_EVIDENCE', 'Được khen thưởng từ cấp Khoa trở lên về hoạt động tình nguyện.', '', 1, true, true, 'Minh chứng: giấy khen, quyết định khen thưởng, giấy chứng nhận hoặc danh sách khen thưởng.'),

    // 5. Hội nhập tốt - các tiêu chí trong quy định
    crit_('HN_SKILL_OR_AWARD', 'HOI_NHAP', '5. Hội nhập tốt', 5, 1, 'REQUIRED_EVIDENCE', 'Hoàn thành ít nhất 01 khóa kỹ năng thực hành xã hội hoặc được Hội Sinh viên, Đoàn Thanh niên từ cấp Khoa trở lên khen thưởng về thành tích xuất sắc trong công tác Hội/Sinh viên hoặc công tác Đoàn/thanh niên trường học trong năm học.', '', 0, true, true, 'Minh chứng: chứng nhận khóa kỹ năng, giấy khen, quyết định khen thưởng hoặc xác nhận của đơn vị tổ chức.'),
    crit_('HN_INTEGRATION_EVENT', 'HOI_NHAP', '5. Hội nhập tốt', 5, 2, 'REQUIRED_EVIDENCE', 'Tham gia tích cực 01 hoạt động về hội nhập do cấp Khoa trở lên tổ chức như giao lưu sinh viên quốc tế, hội thảo quốc tế và có giấy chứng nhận/xác nhận hoặc danh sách kèm theo.', '', 0, true, true, 'Minh chứng: giấy chứng nhận, xác nhận tham gia, danh sách tham gia hoặc thông báo chương trình kèm xác nhận.'),
    crit_('HN_LANGUAGE_CERT', 'HOI_NHAP', '5. Hội nhập tốt', 5, 3, 'REQUIRED_EVIDENCE', 'Đạt chứng chỉ ngoại ngữ trình độ A hoặc tương đương đối với sinh viên năm 1,2; bằng B hoặc tương đương trở lên đối với sinh viên năm 3,4.', '', 0, true, true, 'Minh chứng: chứng chỉ ngoại ngữ, kết quả thi hoặc giấy xác nhận trình độ tương đương.')
  ];
}

function crit_(criterionId, groupId, groupName, groupOrder, criterionOrder, itemType, label, rule, minOptionPass, evidenceRequired, allowMultipleEvidence, sourceText) {
  return {
    criterionId: criterionId,
    groupId: groupId,
    groupName: groupName,
    groupOrder: groupOrder,
    criterionOrder: criterionOrder,
    itemType: itemType,
    label: label,
    rule: rule,
    minOptionPass: minOptionPass,
    evidenceRequired: evidenceRequired,
    allowMultipleEvidence: allowMultipleEvidence,
    active: true,
    sourceText: sourceText,
    updatedAt: new Date()
  };
}

/***********************
 * PUBLIC / AUTH APIs
 ***********************/
function apiBootstrap_() {
  const criteria = getCriteria_();
  return ok_({
    appTitle: getConfig_('APP_TITLE', SV5T.APP_NAME),
    schoolYear: getConfig_('SCHOOL_YEAR', '2025-2026'),
    allowRegister: getConfigBool_('ALLOW_REGISTER', true),
    allowSubmit: getConfigBool_('ALLOW_SUBMIT', true),
    maxFileMb: Number(getConfig_('MAX_FILE_MB', '8')),
    organizationLines: [
      getConfig_('ORGANIZATION_LINE_1', 'HỘI SINH VIÊN VIỆT NAM'),
      getConfig_('ORGANIZATION_LINE_2', 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ ĐỒNG NAI'),
      getConfig_('ORGANIZATION_LINE_3', 'CLB SV5T')
    ],
    criteria: criteria,
    groupedCriteria: groupCriteria_(criteria)
  });
}

function apiGetRequestResult_(requestId) {
  if (!requestId) throw new Error('Thiếu requestId.');
  const raw = CacheService.getScriptCache().get('SV5T_REQ_' + requestId);
  if (!raw) return ok_({ pending: true });
  return JSON.parse(raw);
}

function apiRegister_(payload) {
  if (!getConfigBool_('ALLOW_REGISTER', true)) throw new Error('Hệ thống đang khóa đăng ký tài khoản.');

  payload = payload || {};
  const email = clean_(payload.email || payload.username).toLowerCase();
  const passwordRaw = String(payload.passwordRaw || payload.password || '');
  const passwordSha256 = clean_(payload.passwordSha256).toLowerCase();

  if (!email) throw new Error('Vui lòng nhập email sinh viên.');
  if (email.indexOf('@') === -1) throw new Error('Email sinh viên không hợp lệ.');
  if (!passwordRaw) throw new Error('Vui lòng nhập mật khẩu.');
  if (passwordRaw.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');

  const expectedSha = sha256Hex_(passwordRaw);
  if (passwordSha256 && passwordSha256 !== expectedSha) {
    throw new Error('Mã SHA-256 mật khẩu không khớp. Vui lòng tải lại trang và thử lại.');
  }

  const users = readObjects_(SV5T.SHEETS.USERS);
  if (users.some(function (u) { return String(u.username).toLowerCase() === email || String(u.email).toLowerCase() === email; })) {
    throw new Error('Email sinh viên này đã có tài khoản.');
  }

  const now = new Date();
  const user = {
    userId: Utilities.getUuid(),
    username: email,
    passwordHash: hashPassword_(email, passwordRaw),
    passwordRaw: passwordRaw,
    passwordSha256: expectedSha,
    fullName: clean_(payload.fullName) || '',
    email: email,
    phone: clean_(payload.phone),
    role: SV5T.ROLE.STUDENT,
    studentId: clean_(payload.studentId),
    gender: clean_(payload.gender),
    birthDate: clean_(payload.birthDate),
    ethnicity: clean_(payload.ethnicity),
    faculty: 'CLB SV5T',
    className: clean_(payload.className),
    unionPosition: clean_(payload.unionPosition),
    yearOfStudy: clean_(payload.yearOfStudy),
    active: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: ''
  };
  appendObjects_(SV5T.SHEETS.USERS, [user]);
  audit_(user, 'REGISTER', 'USER', user.userId, { email: email });

  return ok_({ message: 'Đăng ký tài khoản thành công. Vui lòng đăng nhập bằng email sinh viên.', username: email });
}

function apiLogin_(username, password, passwordSha256) {
  username = clean_(username).toLowerCase();
  password = String(password || '');
  passwordSha256 = clean_(passwordSha256).toLowerCase();

  const users = readObjects_(SV5T.SHEETS.USERS);
  const user = users.find(function (u) {
    const loginName = String(u.username || '').toLowerCase();
    const email = String(u.email || '').toLowerCase();
    return (loginName === username || email === username) && bool_(u.active);
  });
  if (!user) throw new Error('Tài khoản không tồn tại hoặc đã bị khóa.');

  let okLogin = false;

  // Cách mới: frontend gửi SHA-256 của mật khẩu, Apps Script tự băm mật khẩu gốc đang lưu trong Sheet để so sánh.
  if (passwordSha256) {
    const storedRaw = String(user.passwordRaw || '');
    const storedSha = String(user.passwordSha256 || (storedRaw ? sha256Hex_(storedRaw) : '')).toLowerCase();
    okLogin = passwordSha256 === storedSha;
  }

  // Tương thích dữ liệu cũ: nếu frontend cũ còn gửi password gốc.
  if (!okLogin && password) {
    if (String(user.passwordRaw || '') && String(user.passwordRaw) === password) okLogin = true;
    if (String(user.passwordHash) === hashPassword_(String(user.username || username).toLowerCase(), password)) okLogin = true;
  }

  if (!okLogin) throw new Error('Sai mật khẩu.');

  const sessionUser = publicUser_(user);
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('SV5T_SESSION_' + token, JSON.stringify(sessionUser), 21600);

  const updateObj = { lastLoginAt: new Date(), updatedAt: new Date() };
  if (!user.passwordSha256 && user.passwordRaw) updateObj.passwordSha256 = sha256Hex_(user.passwordRaw);
  updateRowFields_(SV5T.SHEETS.USERS, user._row, updateObj);

  audit_(user, 'LOGIN', 'USER', user.userId, {});
  return ok_({ token: token, user: sessionUser });
}

function apiLogout_(token) {
  if (token) CacheService.getScriptCache().remove('SV5T_SESSION_' + token);
  return ok_({ message: 'Đã đăng xuất.' });
}

function apiMe_(token) {
  const user = requireLogin_(token);
  return ok_({ user: user });
}

/***********************
 * STUDENT APIs
 ***********************/
function apiMyApplication_(token) {
  const user = requireRole_(token, [SV5T.ROLE.STUDENT, SV5T.ROLE.ADMIN]);
  const app = findMyApplication_(user);
  if (!app) return ok_({ application: null });

  return ok_(applicationPayload_(app, user, false));
}

function apiStudentSaveApplication_(token, application, claims, files, submitNow) {
  const user = requireRole_(token, [SV5T.ROLE.STUDENT, SV5T.ROLE.ADMIN]);
  if (!getConfigBool_('ALLOW_SUBMIT', true)) throw new Error('Hệ thống đang khóa nộp/bổ sung hồ sơ.');

  application = application || {};
  claims = Array.isArray(claims) ? claims : [];
  files = Array.isArray(files) ? files : [];

  let app = findMyApplication_(user);
  const now = new Date();

  if (app && String(app.status) === SV5T.APP_STATUS.FINALIZED) {
    throw new Error('Hồ sơ đã chốt kết quả, không thể cập nhật.');
  }
  if (app && String(app.status) === SV5T.APP_STATUS.SUBMITTED) {
    throw new Error('Hồ sơ đã nộp và đang chờ duyệt. Chỉ được bổ sung khi người chấm yêu cầu.');
  }
  if (app && String(app.status) === SV5T.APP_STATUS.NEED_SUPPLEMENT) {
    throw new Error('Hồ sơ đang cần bổ sung. Vui lòng dùng chức năng Gửi bổ sung minh chứng.');
  }

  const schoolYear = clean_(application.schoolYear) || getConfig_('SCHOOL_YEAR', '2025-2026');

  if (!app) {
    const applicationId = 'SV5T-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const evidenceRoot = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty(SV5T.PROP.EVIDENCE_ID));
    const folderName = clean_(application.fullName) || user.fullName || user.username;
    const folder = evidenceRoot.createFolder(applicationId + '_' + sanitizeFileName_(folderName));

    app = {
      applicationId: applicationId,
      studentUserId: user.userId,
      studentId: user.studentId,
      fullName: user.fullName,
      gender: user.gender,
      birthDate: user.birthDate,
      ethnicity: user.ethnicity,
      email: user.email,
      phone: user.phone,
      faculty: 'CLB SV5T',
      className: user.className,
      unionPosition: user.unionPosition,
      yearOfStudy: user.yearOfStudy,
      schoolYear: schoolYear,
      gpa: '',
      noF: '',
      conductScore: '',
      noViolation: '',
      nominated: '',
      status: SV5T.APP_STATUS.DRAFT,
      studentNote: '',
      createdAt: now,
      submittedAt: '',
      updatedAt: now,
      finalResult: '',
      finalNote: '',
      finalizedBy: '',
      finalizedAt: '',
      driveFolderId: folder.getId(),
      computedJson: ''
    };
    appendObjects_(SV5T.SHEETS.APPLICATIONS, [app]);
    app = getApplication_(applicationId);
  }

  const update = {
    fullName: clean_(application.fullName) || user.fullName,
    gender: clean_(application.gender),
    birthDate: clean_(application.birthDate),
    ethnicity: clean_(application.ethnicity),
    email: clean_(application.email) || user.email,
    phone: clean_(application.phone) || user.phone,
    faculty: 'CLB SV5T',
    className: clean_(application.className) || user.className,
    unionPosition: clean_(application.unionPosition),
    yearOfStudy: clean_(application.yearOfStudy) || user.yearOfStudy,
    schoolYear: schoolYear,
    gpa: Number(application.gpa || 0),
    noF: bool_(application.noF),
    conductScore: Number(application.conductScore || 0),
    noViolation: bool_(application.noViolation),
    nominated: bool_(application.nominated),
    studentNote: clean_(application.studentNote),
    status: submitNow ? SV5T.APP_STATUS.SUBMITTED : String(app.status || SV5T.APP_STATUS.DRAFT),
    updatedAt: now
  };
  if (submitNow && !app.submittedAt) update.submittedAt = now;

  updateRowFields_(SV5T.SHEETS.APPLICATIONS, app._row, update);
  app = getApplication_(app.applicationId);

  saveClaims_(app, claims);
  if (files.length) uploadEvidenceFiles_(app, user, files);

  if (submitNow) validateSubmission_(app.applicationId);

  const compute = computeApplication_(getApplication_(app.applicationId));
  saveComputed_(app.applicationId, compute);

  audit_(user, submitNow ? 'STUDENT_SUBMIT_APPLICATION' : 'STUDENT_SAVE_APPLICATION', 'APPLICATION', app.applicationId, {
    fileCount: files.length
  });

  return ok_({
    message: submitNow ? 'Đã nộp hồ sơ thành công.' : 'Đã lưu hồ sơ nháp.',
    applicationId: app.applicationId,
    status: submitNow ? SV5T.APP_STATUS.SUBMITTED : app.status,
    summary: compute.summary
  });
}

function apiStudentSupplement_(token, claims, files) {
  const user = requireRole_(token, [SV5T.ROLE.STUDENT, SV5T.ROLE.ADMIN]);
  if (!getConfigBool_('ALLOW_SUBMIT', true)) throw new Error('Hệ thống đang khóa nộp/bổ sung hồ sơ.');

  const app = findMyApplication_(user);
  if (!app) throw new Error('Bạn chưa có hồ sơ để bổ sung.');
  if (String(app.status) === SV5T.APP_STATUS.FINALIZED) throw new Error('Hồ sơ đã chốt kết quả, không thể bổ sung.');
  if (String(app.status) !== SV5T.APP_STATUS.NEED_SUPPLEMENT) {
    throw new Error('Hồ sơ hiện không ở trạng thái cần bổ sung minh chứng.');
  }

  claims = Array.isArray(claims) ? claims : [];
  files = Array.isArray(files) ? files : [];
  if (!files.length) throw new Error('Vui lòng tải ít nhất 01 minh chứng bổ sung.');

  const reviews = readObjects_(SV5T.SHEETS.REVIEWS).filter(function (r) {
    return r.applicationId === app.applicationId;
  });
  const needMap = {};
  reviews.forEach(function (r) {
    if (r.status === SV5T.REVIEW.FAIL || r.status === SV5T.REVIEW.NEED_MORE) needMap[r.criterionId] = r;
  });

  const fileCriterionIds = {};
  files.forEach(function (f) { fileCriterionIds[clean_(f.criterionId)] = true; });
  const invalid = Object.keys(fileCriterionIds).filter(function (criterionId) { return !needMap[criterionId]; });
  if (invalid.length) {
    throw new Error('Chỉ được bổ sung minh chứng cho các tiêu chí đang Không đạt hoặc Cần bổ sung.');
  }

  saveClaims_(app, claims);
  uploadEvidenceFiles_(app, user, files);

  // Sau khi sinh viên bổ sung, các tiêu chí đó trở về trạng thái chờ duyệt lại.
  Object.keys(fileCriterionIds).forEach(function (criterionId) {
    const oldReview = needMap[criterionId];
    if (oldReview) {
      updateRowFields_(SV5T.SHEETS.REVIEWS, oldReview._row, {
        status: SV5T.REVIEW.PENDING,
        comment: 'Sinh viên đã bổ sung minh chứng mới, chờ duyệt lại. Lý do trước đó: ' + clean_(oldReview.comment),
        reviewedAt: new Date()
      });
    }
  });

  updateRowFields_(SV5T.SHEETS.APPLICATIONS, app._row, {
    status: SV5T.APP_STATUS.SUBMITTED,
    updatedAt: new Date()
  });

  const compute = computeApplication_(getApplication_(app.applicationId));
  saveComputed_(app.applicationId, compute);

  audit_(user, 'STUDENT_SUPPLEMENT_EVIDENCE', 'APPLICATION', app.applicationId, {
    fileCount: files.length,
    criterionIds: Object.keys(fileCriterionIds)
  });

  return ok_({
    message: 'Đã gửi minh chứng bổ sung. Hồ sơ chuyển về trạng thái chờ người chấm duyệt lại.',
    applicationId: app.applicationId,
    status: SV5T.APP_STATUS.SUBMITTED,
    summary: compute.summary
  });
}

function validateSubmission_(applicationId) {
  const app = getApplication_(applicationId);
  if (!app.fullName || !app.gender || !app.birthDate || !app.ethnicity || !app.yearOfStudy || !app.className || !app.unionPosition || !app.phone) {
    throw new Error('Vui lòng nhập đủ thông tin: Họ tên, giới tính, ngày sinh, dân tộc, sinh viên năm thứ, lớp, chức vụ Đoàn/Hội và số điện thoại.');
  }

  const criteria = getCriteria_();
  const evidence = readObjects_(SV5T.SHEETS.EVIDENCES).filter(function (e) {
    return e.applicationId === applicationId;
  });

  if (!evidence.length) throw new Error('Vui lòng tải ít nhất 01 minh chứng.');

  const evidenceMap = {};
  evidence.forEach(function (e) { evidenceMap[e.criterionId] = (evidenceMap[e.criterionId] || 0) + 1; });

  const missingRequired = criteria.filter(function (c) {
    return c.itemType === 'REQUIRED_EVIDENCE' && !(evidenceMap[c.criterionId] > 0);
  });
  if (missingRequired.length) {
    throw new Error('Các tiêu chí bắt buộc chưa có minh chứng: ' + missingRequired.map(function (x) { return x.label; }).join('; '));
  }

  const groups = groupCriteria_(criteria);
  const missingOptionGroups = [];
  groups.forEach(function (g) {
    const options = g.items.filter(function (c) { return c.itemType === 'OPTION_EVIDENCE'; });
    if (!options.length) return;
    const need = Math.max.apply(null, [0].concat(options.map(function (c) { return Number(c.minOptionPass || 1); }))) || 1;
    const has = options.filter(function (c) { return evidenceMap[c.criterionId] > 0; }).length;
    if (has < need) missingOptionGroups.push(g.groupName + ' cần tối thiểu ' + need + ' minh chứng ở nhóm tiêu chí lựa chọn');
  });
  if (missingOptionGroups.length) throw new Error(missingOptionGroups.join('; '));
}

/***********************
 * REVIEWER / ADMIN APIs
 ***********************/
function apiListApplications_(token, filter) {
  const user = requireRole_(token, [SV5T.ROLE.REVIEWER, SV5T.ROLE.ADMIN]);
  filter = filter || {};
  const q = clean_(filter.q).toLowerCase();
  const status = clean_(filter.status);
  const schoolYear = clean_(filter.schoolYear);

  let rows = readObjects_(SV5T.SHEETS.APPLICATIONS);
  rows = rows.filter(function (a) {
    if (status && String(a.status) !== status) return false;
    if (schoolYear && String(a.schoolYear) !== schoolYear) return false;
    if (user.role === SV5T.ROLE.REVIEWER && user.faculty && user.faculty !== '*' && String(a.faculty).toLowerCase() !== String(user.faculty).toLowerCase()) return false;
    if (q) {
      const hay = [a.applicationId, a.studentId, a.fullName, a.className, a.faculty, a.phone, a.email].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  rows.sort(function (a, b) {
    return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
  });

  const out = rows.slice(0, 500).map(function (a) {
    const compute = safeJson_(a.computedJson, {});
    return {
      applicationId: a.applicationId,
      studentId: a.studentId,
      fullName: a.fullName,
      faculty: a.faculty,
      className: a.className,
      schoolYear: a.schoolYear,
      status: a.status,
      submittedAt: toIso_(a.submittedAt),
      updatedAt: toIso_(a.updatedAt),
      finalResult: a.finalResult,
      passGroups: compute.summary ? compute.summary.passGroups : '',
      overallPass: compute.summary ? compute.summary.overallPass : ''
    };
  });

  return ok_({ applications: out, total: rows.length });
}

function apiApplicationDetail_(token, applicationId) {
  const user = requireRole_(token, [SV5T.ROLE.REVIEWER, SV5T.ROLE.ADMIN]);
  const app = getApplication_(applicationId);
  if (user.role === SV5T.ROLE.REVIEWER && user.faculty && user.faculty !== '*' && String(app.faculty).toLowerCase() !== String(user.faculty).toLowerCase()) {
    throw new Error('Bạn không có quyền xem hồ sơ ngoài phạm vi khoa được phân công.');
  }

  return ok_(applicationPayload_(app, user, true));
}

function apiReviewCriterion_(token, payload) {
  const user = requireRole_(token, [SV5T.ROLE.REVIEWER, SV5T.ROLE.ADMIN]);
  const applicationId = clean_(payload.applicationId);
  const criterionId = clean_(payload.criterionId);
  const status = clean_(payload.status).toUpperCase();
  const comment = clean_(payload.comment);

  if (!applicationId || !criterionId) throw new Error('Thiếu mã hồ sơ hoặc mã tiêu chí.');
  if ([SV5T.REVIEW.PENDING, SV5T.REVIEW.PASS, SV5T.REVIEW.FAIL, SV5T.REVIEW.NEED_MORE].indexOf(status) === -1) {
    throw new Error('Trạng thái duyệt không hợp lệ.');
  }
  if ((status === SV5T.REVIEW.FAIL || status === SV5T.REVIEW.NEED_MORE) && !comment) {
    throw new Error('Vui lòng ghi rõ lý do khi chấm Không đạt hoặc Yêu cầu bổ sung.');
  }

  const app = getApplication_(applicationId);
  if (String(app.status) === SV5T.APP_STATUS.FINALIZED && user.role !== SV5T.ROLE.ADMIN) {
    throw new Error('Hồ sơ đã chốt, chỉ admin mới được sửa.');
  }

  const criterion = getCriteria_().find(function (c) { return c.criterionId === criterionId; });
  if (!criterion) throw new Error('Không tìm thấy tiêu chí.');

  if ((criterion.itemType === 'OPTION_EVIDENCE' || criterion.itemType === 'REQUIRED_EVIDENCE') && status === SV5T.REVIEW.PASS) {
    const evidenceCount = readObjects_(SV5T.SHEETS.EVIDENCES).filter(function (e) {
      return e.applicationId === applicationId && e.criterionId === criterionId;
    }).length;
    if (evidenceCount <= 0) throw new Error('Tiêu chí này chưa có minh chứng nên không thể duyệt ĐẠT.');
  }

  const reviews = readObjects_(SV5T.SHEETS.REVIEWS);
  const existed = reviews.find(function (r) {
    return r.applicationId === applicationId && r.criterionId === criterionId;
  });

  const reviewObj = {
    reviewId: existed ? existed.reviewId : Utilities.getUuid(),
    applicationId: applicationId,
    criterionId: criterionId,
    reviewerUserId: user.userId,
    reviewerUsername: user.username,
    status: status,
    comment: comment,
    reviewedAt: new Date()
  };

  if (existed) updateRowFields_(SV5T.SHEETS.REVIEWS, existed._row, reviewObj);
  else appendObjects_(SV5T.SHEETS.REVIEWS, [reviewObj]);

  let newStatus = String(app.status);
  if (String(app.status) !== SV5T.APP_STATUS.FINALIZED) {
    const latestReviews = readObjects_(SV5T.SHEETS.REVIEWS).filter(function (r) {
      return r.applicationId === applicationId;
    });
    const hasNeedSupplement = latestReviews.some(function (r) {
      return r.status === SV5T.REVIEW.FAIL || r.status === SV5T.REVIEW.NEED_MORE;
    });
    newStatus = hasNeedSupplement ? SV5T.APP_STATUS.NEED_SUPPLEMENT : SV5T.APP_STATUS.SUBMITTED;
    updateRowFields_(SV5T.SHEETS.APPLICATIONS, app._row, { status: newStatus, updatedAt: new Date() });
  }

  const compute = computeApplication_(getApplication_(applicationId));
  saveComputed_(applicationId, compute);
  audit_(user, 'REVIEW_CRITERION', 'CRITERION', criterionId, { applicationId: applicationId, status: status });

  return ok_({ message: 'Đã cập nhật kết quả duyệt tiêu chí.', summary: compute.summary });
}

function apiFinalizeApplication_(token, payload) {
  const user = requireRole_(token, [SV5T.ROLE.ADMIN]);
  const applicationId = clean_(payload.applicationId);
  const mode = clean_(payload.mode).toUpperCase() || 'AUTO';
  const note = clean_(payload.note);
  const app = getApplication_(applicationId);
  const compute = computeApplication_(app);

  let finalResult = compute.summary.overallPass ? 'ĐẠT' : 'KHÔNG ĐẠT';
  if (mode === 'PASS') finalResult = 'ĐẠT';
  if (mode === 'FAIL') finalResult = 'KHÔNG ĐẠT';

  updateRowFields_(SV5T.SHEETS.APPLICATIONS, app._row, {
    status: SV5T.APP_STATUS.FINALIZED,
    finalResult: finalResult,
    finalNote: note,
    finalizedBy: user.username,
    finalizedAt: new Date(),
    updatedAt: new Date(),
    computedJson: JSON.stringify(compute)
  });

  audit_(user, 'FINALIZE_APPLICATION', 'APPLICATION', applicationId, { finalResult: finalResult, mode: mode });
  return ok_({ message: 'Đã chốt kết quả hồ sơ.', finalResult: finalResult, summary: compute.summary });
}

function apiStats_(token) {
  const user = requireRole_(token, [SV5T.ROLE.REVIEWER, SV5T.ROLE.ADMIN]);
  let apps = readObjects_(SV5T.SHEETS.APPLICATIONS);

  if (user.role === SV5T.ROLE.REVIEWER && user.faculty && user.faculty !== '*') {
    apps = apps.filter(function (a) { return String(a.faculty).toLowerCase() === String(user.faculty).toLowerCase(); });
  }

  const stats = {
    total: apps.length,
    draft: 0,
    submitted: 0,
    needSupplement: 0,
    finalized: 0,
    pass: 0,
    fail: 0
  };
  apps.forEach(function (a) {
    if (a.status === SV5T.APP_STATUS.DRAFT) stats.draft++;
    if (a.status === SV5T.APP_STATUS.SUBMITTED) stats.submitted++;
    if (a.status === SV5T.APP_STATUS.NEED_SUPPLEMENT) stats.needSupplement++;
    if (a.status === SV5T.APP_STATUS.FINALIZED) stats.finalized++;
    if (a.finalResult === 'ĐẠT') stats.pass++;
    if (a.finalResult === 'KHÔNG ĐẠT') stats.fail++;
  });
  return ok_({ stats: stats });
}

/***********************
 * ADMIN APIs
 ***********************/
function apiListUsers_(token) {
  requireRole_(token, [SV5T.ROLE.ADMIN]);
  return ok_({
    users: readObjects_(SV5T.SHEETS.USERS).map(publicUser_)
  });
}

function apiUpsertUser_(token, userPayload) {
  const actor = requireRole_(token, [SV5T.ROLE.ADMIN]);
  userPayload = userPayload || {};
  const username = clean_(userPayload.username).toLowerCase();
  if (!username) throw new Error('Thiếu username.');

  const role = clean_(userPayload.role).toUpperCase() || SV5T.ROLE.REVIEWER;
  if ([SV5T.ROLE.STUDENT, SV5T.ROLE.REVIEWER, SV5T.ROLE.ADMIN].indexOf(role) === -1) {
    throw new Error('Vai trò không hợp lệ.');
  }

  const users = readObjects_(SV5T.SHEETS.USERS);
  const existed = users.find(function (u) { return String(u.username).toLowerCase() === username; });
  const now = new Date();

  const obj = {
    userId: existed ? existed.userId : Utilities.getUuid(),
    username: username,
    passwordHash: existed ? existed.passwordHash : hashPassword_(username, userPayload.passwordRaw || userPayload.password || '123456'),
    passwordRaw: existed ? existed.passwordRaw : String(userPayload.passwordRaw || userPayload.password || '123456'),
    passwordSha256: existed ? existed.passwordSha256 : sha256Hex_(String(userPayload.passwordRaw || userPayload.password || '123456')),
    fullName: clean_(userPayload.fullName) || username,
    email: clean_(userPayload.email),
    phone: clean_(userPayload.phone),
    role: role,
    studentId: clean_(userPayload.studentId),
    gender: clean_(userPayload.gender),
    birthDate: clean_(userPayload.birthDate),
    ethnicity: clean_(userPayload.ethnicity),
    faculty: clean_(userPayload.faculty) || (role === SV5T.ROLE.REVIEWER ? 'CLB SV5T' : '*'),
    className: clean_(userPayload.className),
    unionPosition: clean_(userPayload.unionPosition),
    yearOfStudy: clean_(userPayload.yearOfStudy),
    active: userPayload.active === undefined ? true : bool_(userPayload.active),
    createdAt: existed ? existed.createdAt : now,
    updatedAt: now,
    lastLoginAt: existed ? existed.lastLoginAt : ''
  };
  if (userPayload.passwordRaw || userPayload.password) {
    const raw = String(userPayload.passwordRaw || userPayload.password || '');
    obj.passwordRaw = raw;
    obj.passwordSha256 = sha256Hex_(raw);
    obj.passwordHash = hashPassword_(username, raw);
  }

  if (existed) updateRowFields_(SV5T.SHEETS.USERS, existed._row, obj);
  else appendObjects_(SV5T.SHEETS.USERS, [obj]);

  audit_(actor, existed ? 'UPDATE_USER' : 'CREATE_USER', 'USER', obj.userId, { username: username, role: role });
  return ok_({ message: existed ? 'Đã cập nhật tài khoản.' : 'Đã tạo tài khoản.', user: publicUser_(obj) });
}

function apiResetUserPassword_(token, username, newPassword) {
  const actor = requireRole_(token, [SV5T.ROLE.ADMIN]);
  username = clean_(username).toLowerCase();
  newPassword = clean_(newPassword) || '123456';

  const users = readObjects_(SV5T.SHEETS.USERS);
  const user = users.find(function (u) { return String(u.username).toLowerCase() === username; });
  if (!user) throw new Error('Không tìm thấy tài khoản.');

  updateRowFields_(SV5T.SHEETS.USERS, user._row, {
    passwordHash: hashPassword_(username, newPassword),
    passwordRaw: newPassword,
    passwordSha256: sha256Hex_(newPassword),
    updatedAt: new Date()
  });

  audit_(actor, 'RESET_USER_PASSWORD', 'USER', user.userId, { username: username });
  return ok_({ message: 'Đã đặt lại mật khẩu.', username: username, newPassword: newPassword });
}


function apiSetUserActive_(token, username, active) {
  const actor = requireRole_(token, [SV5T.ROLE.ADMIN]);
  username = clean_(username).toLowerCase();
  if (!username) throw new Error('Thiếu username.');
  if (String(actor.username).toLowerCase() === username && !bool_(active)) {
    throw new Error('Không thể tự khóa tài khoản đang đăng nhập.');
  }

  const users = readObjects_(SV5T.SHEETS.USERS);
  const user = users.find(function (u) {
    return String(u.username).toLowerCase() === username || String(u.email).toLowerCase() === username;
  });
  if (!user) throw new Error('Không tìm thấy tài khoản.');

  updateRowFields_(SV5T.SHEETS.USERS, user._row, {
    active: bool_(active),
    updatedAt: new Date()
  });

  audit_(actor, bool_(active) ? 'ENABLE_USER' : 'DISABLE_USER', 'USER', user.userId, { username: username });
  return ok_({ message: bool_(active) ? 'Đã mở tài khoản.' : 'Đã khóa tài khoản.', username: username, active: bool_(active) });
}

function apiChangeMyPassword_(token, oldPasswordSha256, oldPasswordRaw, newPasswordRaw, newPasswordSha256) {
  const actor = requireLogin_(token);
  const users = readObjects_(SV5T.SHEETS.USERS);
  const user = users.find(function (u) { return String(u.userId) === String(actor.userId); });
  if (!user) throw new Error('Không tìm thấy tài khoản.');

  oldPasswordSha256 = clean_(oldPasswordSha256).toLowerCase();
  oldPasswordRaw = String(oldPasswordRaw || '');
  newPasswordRaw = String(newPasswordRaw || '');
  newPasswordSha256 = clean_(newPasswordSha256).toLowerCase();

  if (!newPasswordRaw || newPasswordRaw.length < 6) throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
  if (newPasswordSha256 && newPasswordSha256 !== sha256Hex_(newPasswordRaw)) {
    throw new Error('Mã SHA-256 mật khẩu mới không khớp.');
  }

  const storedRaw = String(user.passwordRaw || '');
  const storedSha = String(user.passwordSha256 || (storedRaw ? sha256Hex_(storedRaw) : '')).toLowerCase();
  let okOld = false;
  if (oldPasswordSha256 && storedSha && oldPasswordSha256 === storedSha) okOld = true;
  if (!okOld && oldPasswordRaw && storedRaw && oldPasswordRaw === storedRaw) okOld = true;
  if (!okOld) throw new Error('Mật khẩu cũ không đúng.');

  const username = String(user.username || user.email || '').toLowerCase();
  updateRowFields_(SV5T.SHEETS.USERS, user._row, {
    passwordHash: hashPassword_(username, newPasswordRaw),
    passwordRaw: newPasswordRaw,
    passwordSha256: sha256Hex_(newPasswordRaw),
    updatedAt: new Date()
  });

  audit_(actor, 'CHANGE_OWN_PASSWORD', 'USER', user.userId, {});
  return ok_({ message: 'Đã đổi mật khẩu thành công.' });
}

function apiDeleteApplication_(token, applicationId) {
  const actor = requireRole_(token, [SV5T.ROLE.ADMIN]);
  applicationId = clean_(applicationId);
  if (!applicationId) throw new Error('Thiếu mã hồ sơ.');

  const app = getApplication_(applicationId);

  // Đưa thư mục minh chứng hồ sơ vào thùng rác nếu có.
  if (app.driveFolderId) {
    try { DriveApp.getFolderById(app.driveFolderId).setTrashed(true); } catch (err) {}
  }

  deleteRowsWhere_(SV5T.SHEETS.REVIEWS, function (r) { return r.applicationId === applicationId; });
  deleteRowsWhere_(SV5T.SHEETS.EVIDENCES, function (r) { return r.applicationId === applicationId; });
  deleteRowsWhere_(SV5T.SHEETS.CLAIMS, function (r) { return r.applicationId === applicationId; });
  deleteRowsWhere_(SV5T.SHEETS.APPLICATIONS, function (r) { return r.applicationId === applicationId; });

  audit_(actor, 'DELETE_APPLICATION', 'APPLICATION', applicationId, {});
  return ok_({ message: 'Đã xóa hồ sơ và dữ liệu minh chứng liên quan.', applicationId: applicationId });
}

function apiClearApplicationData_(token, confirmText) {
  const actor = requireRole_(token, [SV5T.ROLE.ADMIN]);
  if (clean_(confirmText) !== 'XOA DU LIEU') {
    throw new Error('Vui lòng nhập đúng XOA DU LIEU để xác nhận.');
  }

  const apps = readObjects_(SV5T.SHEETS.APPLICATIONS);
  apps.forEach(function (app) {
    if (app.driveFolderId) {
      try { DriveApp.getFolderById(app.driveFolderId).setTrashed(true); } catch (err) {}
    }
  });

  clearSheetData_(SV5T.SHEETS.REVIEWS);
  clearSheetData_(SV5T.SHEETS.EVIDENCES);
  clearSheetData_(SV5T.SHEETS.CLAIMS);
  clearSheetData_(SV5T.SHEETS.APPLICATIONS);

  audit_(actor, 'CLEAR_APPLICATION_DATA', 'SYSTEM', 'APPLICATIONS', { count: apps.length });
  return ok_({ message: 'Đã xóa toàn bộ dữ liệu hồ sơ, minh chứng và kết quả duyệt.', deletedApplications: apps.length });
}


function apiListCriteria_(token) {
  requireRole_(token, [SV5T.ROLE.ADMIN, SV5T.ROLE.REVIEWER]);
  const criteria = readObjects_(SV5T.SHEETS.CRITERIA).map(clientObj_);
  return ok_({ criteria: criteria, groupedCriteria: groupCriteria_(criteria) });
}

function apiUpsertCriterion_(token, payload) {
  const actor = requireRole_(token, [SV5T.ROLE.ADMIN]);
  payload = payload || {};
  const criterionId = clean_(payload.criterionId) || ('CRIT_' + Utilities.getUuid().slice(0, 8).toUpperCase());
  const itemType = clean_(payload.itemType).toUpperCase() || 'OPTION_EVIDENCE';
  if (['REQUIRED_AUTO', 'REQUIRED_EVIDENCE', 'OPTION_EVIDENCE'].indexOf(itemType) === -1) throw new Error('Loại tiêu chí không hợp lệ.');
  if (!clean_(payload.groupId) || !clean_(payload.groupName) || !clean_(payload.label)) {
    throw new Error('Vui lòng nhập đầy đủ nhóm tiêu chí và nội dung tiêu chí.');
  }

  const rows = readObjects_(SV5T.SHEETS.CRITERIA);
  const existed = rows.find(function (c) { return c.criterionId === criterionId; });
  const obj = {
    criterionId: criterionId,
    groupId: clean_(payload.groupId),
    groupName: clean_(payload.groupName),
    groupOrder: Number(payload.groupOrder || 0),
    criterionOrder: Number(payload.criterionOrder || 0),
    itemType: itemType,
    label: clean_(payload.label),
    rule: clean_(payload.rule),
    minOptionPass: Number(payload.minOptionPass || (itemType === 'OPTION_EVIDENCE' ? 1 : 0)),
    evidenceRequired: (itemType === 'OPTION_EVIDENCE' || itemType === 'REQUIRED_EVIDENCE') ? true : bool_(payload.evidenceRequired),
    allowMultipleEvidence: true,
    active: payload.active === undefined ? true : bool_(payload.active),
    sourceText: clean_(payload.sourceText),
    updatedAt: new Date()
  };

  if (existed) updateRowFields_(SV5T.SHEETS.CRITERIA, existed._row, obj);
  else appendObjects_(SV5T.SHEETS.CRITERIA, [obj]);

  audit_(actor, existed ? 'UPDATE_CRITERION' : 'CREATE_CRITERION', 'CRITERION', criterionId, {});
  return ok_({ message: existed ? 'Đã cập nhật tiêu chí.' : 'Đã tạo tiêu chí.', criterion: obj });
}

function apiToggleCriterion_(token, criterionId, active) {
  const actor = requireRole_(token, [SV5T.ROLE.ADMIN]);
  const criterion = readObjects_(SV5T.SHEETS.CRITERIA).find(function (c) { return c.criterionId === criterionId; });
  if (!criterion) throw new Error('Không tìm thấy tiêu chí.');
  updateRowFields_(SV5T.SHEETS.CRITERIA, criterion._row, {
    active: bool_(active),
    updatedAt: new Date()
  });
  audit_(actor, 'TOGGLE_CRITERION', 'CRITERION', criterionId, { active: active });
  return ok_({ message: 'Đã cập nhật trạng thái tiêu chí.' });
}

function apiUpdateConfig_(token, key, value, note) {
  const actor = requireRole_(token, [SV5T.ROLE.ADMIN]);
  setConfig_(key, value, note);
  audit_(actor, 'UPDATE_CONFIG', 'CONFIG', key, { value: value });
  return ok_({ message: 'Đã cập nhật cấu hình.' });
}

function apiExportResults_(token) {
  const user = requireRole_(token, [SV5T.ROLE.ADMIN]);
  const apps = readObjects_(SV5T.SHEETS.APPLICATIONS);
  const exportFolder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty(SV5T.PROP.EXPORT_ID));

  const name = 'KET_QUA_SV5T_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const ss = SpreadsheetApp.create(name);
  const file = DriveApp.getFileById(ss.getId());
  exportFolder.addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch (err) {}

  const sh = ss.getSheets()[0];
  sh.setName('Ket qua');
  const headers = ['STT', 'Mã hồ sơ', 'MSSV', 'Họ tên', 'Email', 'SĐT', 'Khoa', 'Lớp', 'Năm học', 'Trạng thái', 'Kết quả cuối', 'Ghi chú', 'Ngày nộp', 'Ngày chốt'];
  const rows = apps.map(function (a, i) {
    return [i + 1, a.applicationId, a.studentId, a.fullName, a.email, a.phone, a.faculty, a.className, a.schoolYear, a.status, a.finalResult, a.finalNote, a.submittedAt, a.finalizedAt];
  });

  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.autoResizeColumns(1, headers.length);

  audit_(user, 'EXPORT_RESULTS', 'SPREADSHEET', ss.getId(), {});
  return ok_({ url: ss.getUrl(), spreadsheetId: ss.getId(), name: name });
}

/***********************
 * BUSINESS COMPUTE
 ***********************/
function computeApplication_(app) {
  const criteria = getCriteria_();
  const evidences = readObjects_(SV5T.SHEETS.EVIDENCES).filter(function (e) { return e.applicationId === app.applicationId; });
  const reviews = readObjects_(SV5T.SHEETS.REVIEWS).filter(function (r) { return r.applicationId === app.applicationId; });
  const claims = readObjects_(SV5T.SHEETS.CLAIMS).filter(function (c) { return c.applicationId === app.applicationId; });

  const reviewMap = {};
  reviews.forEach(function (r) { reviewMap[r.criterionId] = r; });

  const evidenceCount = {};
  evidences.forEach(function (e) {
    evidenceCount[e.criterionId] = (evidenceCount[e.criterionId] || 0) + 1;
  });

  const claimMap = {};
  claims.forEach(function (c) { claimMap[c.criterionId] = c; });

  const grouped = groupCriteria_(criteria);
  const groups = grouped.map(function (g) {
    const requiredItems = g.items.filter(function (i) { return i.itemType === 'REQUIRED_AUTO' || i.itemType === 'REQUIRED_EVIDENCE'; });
    const optionItems = g.items.filter(function (i) { return i.itemType === 'OPTION_EVIDENCE'; });
    const minOptionPass = Math.max.apply(null, [0].concat(g.items.map(function (i) { return Number(i.minOptionPass || 0); })));

    const itemResults = g.items.map(function (item) {
      let status = SV5T.REVIEW.PENDING;
      let reason = '';
      const evCount = evidenceCount[item.criterionId] || 0;
      const claim = claimMap[item.criterionId] || null;
      const review = reviewMap[item.criterionId] || null;

      if (item.itemType === 'REQUIRED_AUTO') {
        const autoPass = evaluateRule_(item.rule, app);
        status = autoPass ? SV5T.REVIEW.PASS : SV5T.REVIEW.FAIL;
        reason = autoPass ? 'Tự động đạt theo dữ liệu hồ sơ.' : 'Chưa đạt theo dữ liệu hồ sơ.';
      } else if (item.itemType === 'REQUIRED_EVIDENCE') {
        if (review) {
          status = review.status || SV5T.REVIEW.PENDING;
          reason = review.comment || '';
        } else if (evCount > 0) {
          status = SV5T.REVIEW.PENDING;
          reason = 'Đã nộp minh chứng bắt buộc, chờ người chấm duyệt.';
        } else {
          status = SV5T.REVIEW.FAIL;
          reason = 'Tiêu chí bắt buộc chưa có minh chứng.';
        }
      } else if (review) {
        status = review.status || SV5T.REVIEW.PENDING;
        reason = review.comment || '';
      } else if (evCount > 0 || (claim && bool_(claim.selected))) {
        status = SV5T.REVIEW.PENDING;
        reason = 'Đã nộp/chọn minh chứng, chờ người chấm duyệt.';
      } else {
        status = SV5T.REVIEW.PENDING;
        reason = 'Chưa chọn hoặc chưa có minh chứng.';
      }

      return {
        criterionId: item.criterionId,
        groupId: item.groupId,
        itemType: item.itemType,
        label: item.label,
        status: status,
        evidenceCount: evCount,
        studentSelected: claim ? bool_(claim.selected) : false,
        studentNote: claim ? claim.studentNote : '',
        reviewerUsername: review ? review.reviewerUsername : '',
        reviewComment: review ? review.comment : '',
        reason: reason
      };
    });

    const requiredPass = requiredItems.every(function (item) {
      const r = itemResults.find(function (x) { return x.criterionId === item.criterionId; });
      return r && r.status === SV5T.REVIEW.PASS;
    });

    const optionPassCount = optionItems.filter(function (item) {
      const r = itemResults.find(function (x) { return x.criterionId === item.criterionId; });
      return r && r.status === SV5T.REVIEW.PASS;
    }).length;

    const optionNeeded = optionItems.length > 0 ? minOptionPass : 0;
    const optionPass = optionItems.length === 0 ? true : optionPassCount >= optionNeeded;

    return {
      groupId: g.groupId,
      groupName: g.groupName,
      groupOrder: g.groupOrder,
      requiredPass: requiredPass,
      optionPassCount: optionPassCount,
      optionNeeded: optionNeeded,
      groupPass: requiredPass && optionPass,
      items: itemResults
    };
  });

  const requiredGroupIds = ['GENERAL', 'DAO_DUC', 'HOC_TAP', 'THE_LUC', 'TINH_NGUYEN', 'HOI_NHAP'];
  const passGroups = groups.filter(function (g) {
    return requiredGroupIds.indexOf(g.groupId) >= 0 && g.groupPass;
  }).length;
  const overallPass = requiredGroupIds.every(function (gid) {
    const g = groups.find(function (x) { return x.groupId === gid; });
    return g && g.groupPass;
  });

  return {
    summary: {
      applicationId: app.applicationId,
      overallPass: overallPass,
      passGroups: passGroups,
      totalRequiredGroups: requiredGroupIds.length,
      message: overallPass ? 'Đủ điều kiện theo các tiêu chí đã duyệt.' : 'Chưa đủ điều kiện hoặc còn tiêu chí cần duyệt/bổ sung.'
    },
    groups: groups,
    computedAt: new Date()
  };
}

function evaluateRule_(rule, app) {
  switch (rule) {
    case 'GPA_3_NO_F': return Number(app.gpa || 0) >= 3.0 && bool_(app.noF);
    case 'GPA_3': return Number(app.gpa || 0) >= 3.0;
    case 'NO_F': return bool_(app.noF);
    case 'CONDUCT_80': return Number(app.conductScore || 0) >= 80;
    case 'NO_VIOLATION': return bool_(app.noViolation);
    case 'NOMINATED': return bool_(app.nominated);
    default: return false;
  }
}

/***********************
 * DATA HELPERS
 ***********************/
function applicationPayload_(app, user, includeSensitive) {
  const compute = computeApplication_(app);
  const claims = readObjects_(SV5T.SHEETS.CLAIMS).filter(function (c) { return c.applicationId === app.applicationId; }).map(clientObj_);
  const evidences = readObjects_(SV5T.SHEETS.EVIDENCES).filter(function (e) { return e.applicationId === app.applicationId; }).map(clientObj_);
  const reviews = readObjects_(SV5T.SHEETS.REVIEWS).filter(function (r) { return r.applicationId === app.applicationId; }).map(clientObj_);

  return {
    application: clientObj_(app),
    claims: claims,
    evidences: evidences,
    reviews: reviews,
    criteria: getCriteria_(),
    groupedCriteria: groupCriteria_(getCriteria_()),
    summary: compute.summary,
    groups: compute.groups,
    canSupplement: String(app.status) !== SV5T.APP_STATUS.FINALIZED
  };
}

function findMyApplication_(user) {
  const schoolYear = getConfig_('SCHOOL_YEAR', '2025-2026');
  const apps = readObjects_(SV5T.SHEETS.APPLICATIONS);
  return apps.find(function (a) {
    return String(a.studentUserId) === String(user.userId)
      && String(a.schoolYear || schoolYear) === String(schoolYear)
      && String(a.status) !== SV5T.APP_STATUS.CANCELLED;
  }) || null;
}

function getApplication_(applicationId) {
  const app = readObjects_(SV5T.SHEETS.APPLICATIONS).find(function (a) {
    return String(a.applicationId) === String(applicationId);
  });
  if (!app) throw new Error('Không tìm thấy hồ sơ: ' + applicationId);
  return app;
}

function saveClaims_(app, claims) {
  const criteriaById = indexBy_(getCriteria_(), 'criterionId');
  const existing = readObjects_(SV5T.SHEETS.CLAIMS).filter(function (c) {
    return c.applicationId === app.applicationId;
  });
  const existingMap = {};
  existing.forEach(function (c) { existingMap[c.criterionId] = c; });

  claims.forEach(function (c) {
    const criterionId = clean_(c.criterionId);
    if (!criterionId || !criteriaById[criterionId]) return;
    const selected = bool_(c.selected);
    const note = clean_(c.studentNote);
    const existed = existingMap[criterionId];
    const obj = {
      claimId: existed ? existed.claimId : Utilities.getUuid(),
      applicationId: app.applicationId,
      criterionId: criterionId,
      groupId: criteriaById[criterionId].groupId,
      selected: selected,
      studentNote: note,
      createdAt: existed ? existed.createdAt : new Date(),
      updatedAt: new Date()
    };
    if (existed) updateRowFields_(SV5T.SHEETS.CLAIMS, existed._row, obj);
    else if (selected || note) appendObjects_(SV5T.SHEETS.CLAIMS, [obj]);
  });
}

function uploadEvidenceFiles_(app, user, files) {
  const criteria = getCriteria_();
  const criteriaById = indexBy_(criteria, 'criterionId');
  const maxMb = Number(getConfig_('MAX_FILE_MB', '8'));
  const shareByLink = getConfigBool_('SHARE_EVIDENCE_BY_LINK', true);
  const folder = DriveApp.getFolderById(app.driveFolderId);
  const rows = [];

  const existing = readObjects_(SV5T.SHEETS.EVIDENCES).filter(function (e) {
    return e.applicationId === app.applicationId;
  });
  const counter = {};
  existing.forEach(function (e) {
    const cid = String(e.criterionId || '');
    const order = Number(e.evidenceOrder || 0);
    counter[cid] = Math.max(counter[cid] || 0, order || 0);
  });

  files.forEach(function (f) {
    const criterionId = clean_(f.criterionId);
    const criterion = criteriaById[criterionId];
    if (!criterion) throw new Error('Không tìm thấy tiêu chí: ' + criterionId);

    const evidenceTitle = clean_(f.evidenceTitle);
    if (!evidenceTitle) throw new Error('Vui lòng nhập tên minh chứng cho từng file.');

    const dataUrl = String(f.base64 || '');
    if (!dataUrl) throw new Error('File minh chứng trống: ' + evidenceTitle);

    const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',').pop() : dataUrl;
    const bytes = Utilities.base64Decode(base64);
    if (bytes.length > maxMb * 1024 * 1024) throw new Error('File vượt quá ' + maxMb + 'MB: ' + evidenceTitle);

    counter[criterionId] = (counter[criterionId] || 0) + 1;
    const evidenceOrder = Number(f.evidenceOrder || counter[criterionId]);
    const criterionEvidenceNo = clean_(f.criterionEvidenceNo) || (criterionId + '-' + evidenceOrder);

    const originalName = sanitizeFileName_(f.fileName || f.name || evidenceTitle);
    const mimeType = f.mimeType || f.type || 'application/octet-stream';
    const storedName = criterionId + '_MC' + evidenceOrder + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '_' + originalName;
    const blob = Utilities.newBlob(bytes, mimeType, storedName);
    const file = folder.createFile(blob);
    if (shareByLink) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    rows.push({
      evidenceId: Utilities.getUuid(),
      applicationId: app.applicationId,
      criterionId: criterionId,
      groupId: criterion.groupId,
      evidenceOrder: evidenceOrder,
      criterionEvidenceNo: criterionEvidenceNo,
      evidenceTitle: evidenceTitle,
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      mimeType: mimeType,
      sizeBytes: bytes.length,
      uploadedBy: user.username,
      uploadedAt: new Date(),
      note: clean_(f.note)
    });
  });

  if (rows.length) appendObjects_(SV5T.SHEETS.EVIDENCES, rows);
}

function saveComputed_(applicationId, compute) {
  const app = getApplication_(applicationId);
  updateRowFields_(SV5T.SHEETS.APPLICATIONS, app._row, {
    computedJson: JSON.stringify(compute),
    updatedAt: new Date()
  });
}

function getCriteria_() {
  return readObjects_(SV5T.SHEETS.CRITERIA)
    .filter(function (c) { return bool_(c.active); })
    .map(normalizeCriterion_)
    .sort(function (a, b) { return (a.groupOrder - b.groupOrder) || (a.criterionOrder - b.criterionOrder); });
}

function normalizeCriterion_(c) {
  const x = clientObj_(c);
  x.groupOrder = Number(x.groupOrder || 0);
  x.criterionOrder = Number(x.criterionOrder || 0);
  x.minOptionPass = Number(x.minOptionPass || 0);
  x.evidenceRequired = (x.itemType === 'OPTION_EVIDENCE' || x.itemType === 'REQUIRED_EVIDENCE') ? true : bool_(x.evidenceRequired);
  x.allowMultipleEvidence = true;
  x.active = bool_(x.active);
  return x;
}

function groupCriteria_(criteria) {
  const map = {};
  criteria.forEach(function (c) {
    if (!map[c.groupId]) map[c.groupId] = {
      groupId: c.groupId,
      groupName: c.groupName,
      groupOrder: Number(c.groupOrder || 0),
      items: []
    };
    map[c.groupId].items.push(c);
  });
  return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.groupOrder - b.groupOrder; });
}

function getSheet_(sheetName) {
  const ssId = PropertiesService.getScriptProperties().getProperty(SV5T.PROP.SS_ID);
  const ss = SpreadsheetApp.openById(ssId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Không tìm thấy sheet: ' + sheetName);
  return sh;
}

function readObjects_(sheetName) {
  const sh = getSheet_(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row.some(function (v) { return String(v).trim() !== ''; })) continue;
    const obj = { _row: r + 1 };
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    rows.push(obj);
  }
  return rows;
}

function appendObjects_(sheetName, objects) {
  if (!objects || !objects.length) return;
  const sh = getSheet_(sheetName);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const values = objects.map(function (obj) {
    return headers.map(function (h) {
      return obj[h] === undefined ? '' : obj[h];
    });
  });
  sh.getRange(sh.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
}

function updateRowFields_(sheetName, rowNumber, fields) {
  const sh = getSheet_(sheetName);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  Object.keys(fields).forEach(function (key) {
    const idx = headers.indexOf(key);
    if (idx >= 0) sh.getRange(rowNumber, idx + 1).setValue(fields[key]);
  });
}

function getConfig_(key, fallback) {
  const rows = readObjects_(SV5T.SHEETS.CONFIG);
  const row = rows.find(function (r) { return String(r.key).trim() === String(key).trim(); });
  return row ? String(row.value).trim() : fallback;
}

function getConfigBool_(key, fallback) {
  return String(getConfig_(key, fallback ? 'TRUE' : 'FALSE')).trim().toUpperCase() === 'TRUE';
}

function setConfig_(key, value, note) {
  const rows = readObjects_(SV5T.SHEETS.CONFIG);
  const row = rows.find(function (r) { return String(r.key).trim() === String(key).trim(); });
  const obj = { key: key, value: String(value), note: note || '', updatedAt: new Date() };
  if (row) updateRowFields_(SV5T.SHEETS.CONFIG, row._row, obj);
  else appendObjects_(SV5T.SHEETS.CONFIG, [obj]);
}

/***********************
 * AUTH / UTILITIES
 ***********************/
function requireLogin_(token) {
  const raw = CacheService.getScriptCache().get('SV5T_SESSION_' + token);
  if (!raw) throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
  return JSON.parse(raw);
}

function requireRole_(token, roles) {
  const user = requireLogin_(token);
  if (roles.indexOf(user.role) === -1) throw new Error('Bạn không có quyền thực hiện thao tác này.');
  return user;
}

function publicUser_(u) {
  return {
    userId: u.userId,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    studentId: u.studentId,
    gender: u.gender,
    birthDate: u.birthDate,
    ethnicity: u.ethnicity,
    faculty: u.faculty,
    className: u.className,
    unionPosition: u.unionPosition,
    yearOfStudy: u.yearOfStudy,
    active: bool_(u.active),
    createdAt: toIso_(u.createdAt),
    updatedAt: toIso_(u.updatedAt),
    lastLoginAt: toIso_(u.lastLoginAt)
  };
}

function ok_(data) {
  data = data || {};
  data.ok = true;
  return data;
}

function fail_(err) {
  return { ok: false, message: err && err.message ? err.message : String(err) };
}

function audit_(actor, action, targetType, targetId, payload) {
  try {
    appendObjects_(SV5T.SHEETS.AUDIT_LOG, [{
      logId: Utilities.getUuid(),
      actorUserId: actor && actor.userId ? actor.userId : '',
      actorUsername: actor && actor.username ? actor.username : '',
      action: action,
      targetType: targetType,
      targetId: targetId,
      timestamp: new Date(),
      payloadJson: JSON.stringify(payload || {})
    }]);
  } catch (err) {
    console.error(err);
  }
}

function hashPassword_(username, password) {
  const text = String(username || '').trim().toLowerCase() + '|SV5T|' + String(password || '');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return Utilities.base64EncodeWebSafe(digest);
}

function sha256Hex_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function clean_(v) {
  return String(v === undefined || v === null ? '' : v).trim();
}

function bool_(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v === undefined || v === null ? '' : v).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'co', 'có', 'dung', 'đúng', 'x'].indexOf(s) >= 0;
}

function toIso_(v) {
  if (!v) return '';
  try {
    if (v instanceof Date) return v.toISOString();
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toISOString();
  } catch (err) {
    return String(v);
  }
}

function clientObj_(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(function (k) {
    if (k === '_row') return;
    out[k] = obj[k] instanceof Date ? obj[k].toISOString() : obj[k];
  });
  return out;
}

function safeJson_(text, fallback) {
  try { return text ? JSON.parse(text) : fallback; } catch (err) { return fallback; }
}

function indexBy_(arr, key) {
  const map = {};
  (arr || []).forEach(function (x) { map[x[key]] = x; });
  return map;
}

function sanitizeFileName_(name) {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160);
}

function getOrCreateChildFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}


function capNhatMatKhauRawVaSha256_SV5T() {
  ensureSetup_();
  const rows = readObjects_(SV5T.SHEETS.USERS);
  rows.forEach(function (u) {
    const raw = String(u.passwordRaw || '');
    if (raw) {
      updateRowFields_(SV5T.SHEETS.USERS, u._row, {
        passwordSha256: sha256Hex_(raw),
        passwordHash: hashPassword_(String(u.username || u.email || '').toLowerCase(), raw),
        updatedAt: new Date()
      });
    }
  });
  Logger.log('Đã cập nhật passwordSha256 cho các tài khoản có passwordRaw.');
  return { ok: true, message: 'Đã cập nhật passwordSha256 cho các tài khoản có passwordRaw.' };
}



function deleteRowsWhere_(sheetName, predicate) {
  const rows = readObjects_(sheetName);
  const sh = getSheet_(sheetName);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (predicate(rows[i])) sh.deleteRow(rows[i]._row);
  }
}

function clearSheetData_(sheetName) {
  const sh = getSheet_(sheetName);
  const last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
}


/***********************
 * RESET / ADMIN MAINTENANCE
 ***********************/
function capNhatTenDonVi_CLB_SV5T() {
  ensureSetup_();
  setConfig_('APP_TITLE', 'Hệ thống xét Sinh viên 5 tốt - CLB SV5T', 'Tiêu đề hiển thị');
  setConfig_('ORGANIZATION_LINE_3', 'CLB SV5T', 'Dòng đơn vị 3');
  Logger.log('Đã cập nhật tên đơn vị thành CLB SV5T.');
  return { ok: true, message: 'Đã cập nhật tên đơn vị thành CLB SV5T.' };
}

function xemLinkHeThongSV5T() {
  ensureSetup_();
  const props = PropertiesService.getScriptProperties();
  Logger.log('Google Sheet Database: https://docs.google.com/spreadsheets/d/' + props.getProperty(SV5T.PROP.SS_ID) + '/edit');
  Logger.log('Google Drive Folder: https://drive.google.com/drive/folders/' + props.getProperty(SV5T.PROP.ROOT_ID));
  Logger.log('Evidence Folder: https://drive.google.com/drive/folders/' + props.getProperty(SV5T.PROP.EVIDENCE_ID));
}

function xoaToanBoDuAnSV5T_XACNHAN() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const result = { ok: true, trashed: [], errors: [] };

  if (all[SV5T.PROP.SS_ID]) {
    try {
      const f = DriveApp.getFileById(all[SV5T.PROP.SS_ID]);
      f.setTrashed(true);
      result.trashed.push({ type: 'spreadsheet', id: all[SV5T.PROP.SS_ID], name: f.getName() });
    } catch (err) {
      result.errors.push({ type: 'spreadsheet', message: err.message });
    }
  }

  if (all[SV5T.PROP.ROOT_ID]) {
    try {
      const folder = DriveApp.getFolderById(all[SV5T.PROP.ROOT_ID]);
      folder.setTrashed(true);
      result.trashed.push({ type: 'folder', id: all[SV5T.PROP.ROOT_ID], name: folder.getName() });
    } catch (err) {
      result.errors.push({ type: 'folder', message: err.message });
    }
  }

  props.deleteAllProperties();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function taoLaiDuAnSV5T_TuDau() {
  xoaToanBoDuAnSV5T_XACNHAN();
  Utilities.sleep(1200);
  return setupSV5T();
}
