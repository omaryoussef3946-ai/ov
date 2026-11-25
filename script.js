/* =====================================================================
   GovTech – Smart Government Services Portal  |  script.js
   Shared by index.html (citizen portal) and admin.html (admin panel).
   ACADEMIC DEMO: all data lives in the browser's localStorage. There is
   no server and no connection to any real government system.

   TABLE OF CONTENTS
     1. Constants & helpers            8. Services catalogue (8 services)
     2. Icons (inline SVG)             9. Requests & notifications API
     3. Translations (EN / AR)        10. Form validation engine
     4. Language handling             11. Citizen portal (index.html)
     5. Storage + demo seed data      12. Admin panel (admin.html)
     6. Authentication / session      13. Boot
     7. UI: toast, modal, confirm
   ===================================================================== */
'use strict';

/* =====================================================================
   1. CONSTANTS & HELPERS
   ===================================================================== */
const KEYS = {
  users: 'govtech_users',
  requests: 'govtech_requests',
  notifs: 'govtech_notifications',
  messages: 'govtech_messages',
  session: 'govtech_session',
  lang: 'govtech_lang',
  remembered: 'govtech_remembered_user',
  seeded: 'govtech_seeded_v1'
};

// Request lifecycle. "Pending" + "Under Review" are both "awaiting decision".
const STATUS = { PENDING: 'Pending', REVIEW: 'Under Review', APPROVED: 'Approved', REJECTED: 'Rejected' };
const STATUS_LIST = [STATUS.PENDING, STATUS.REVIEW, STATUS.APPROVED, STATUS.REJECTED];
const STATUS_CLASS = { 'Pending': 'pending', 'Under Review': 'review', 'Approved': 'approved', 'Rejected': 'rejected' };
const STATUS_KEY = { 'Pending': 'status_pending', 'Under Review': 'status_review', 'Approved': 'status_approved', 'Rejected': 'status_rejected' };

const PAGE = document.body.dataset.page; // "index" or "admin"
const state = { lang: 'en', tab: 'overview', pendingService: null };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Escape text before inserting into innerHTML (prevents HTML injection). */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

const nowIso = () => new Date().toISOString();
const randId = () => Math.random().toString(36).slice(2, 8);

function fmtDate(iso, withTime) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const opts = withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString(state.lang === 'ar' ? 'ar-EG' : 'en-GB', opts);
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function toInputDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Demo-only password hash (cyrb53). NOT secure – real systems hash on a server. */
function hashPassword(pw) {
  const s = 'govtech-demo::' + pw;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/* =====================================================================
   2. ICONS (inline SVG, no external library needed)
   ===================================================================== */
const ICON_PATHS = {
  landmark: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-7 10 7z"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M14 10h4M14 14h4M6 16c.6-1.2 1.7-2 3-2s2.4.8 3 2"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>',
  birth: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>',
  complaint: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M12 8v4M12 16h.01"/>',
  renew: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  'user-plus': '<circle cx="10" cy="8" r="4"/><path d="M2 21c0-4 3.6-7 8-7 1.5 0 2.9.4 4 1M19 8v6M16 11h6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M17 4.5a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5-5-5.7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  inbox: '<path d="M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z"/>'
};

/** Returns an <svg> string for an icon name. */
function icon(name, size = 22) {
  const p = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

/** Replaces every <span data-icon="name"> with its SVG. Safe to call repeatedly. */
function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach(el => {
    if (el.dataset.hydrated) return;
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 22);
    el.dataset.hydrated = '1';
    if (!el.className) el.classList.add('ico');
  });
}

/* =====================================================================
   3. TRANSLATIONS (English / Arabic)
   Keys are referenced in HTML via data-i18n / data-i18n-placeholder /
   data-i18n-title / data-i18n-aria-label, and in JS via t('key').
   ===================================================================== */
const I18N = {
  en: {
    /* general */
    demo_banner: 'Academic front-end demo – sample data only. Not connected to any real government database or official service.',
    brand_name: 'GovTech Portal', brand_tag: 'Smart Government Services',
    nav_home: 'Home', nav_about: 'About Us', nav_services: 'Services', nav_contact: 'Contact Us', nav_dashboard: 'My Dashboard',
    btn_login: 'Login', btn_register: 'Register', btn_logout: 'Logout', btn_cancel: 'Cancel', btn_confirm: 'Confirm',
    btn_send: 'Send message', btn_save: 'Save changes', btn_close: 'Close', btn_view: 'View', btn_track_short: 'Track',
    btn_create_account: 'Create account', btn_register_new: 'Register a new account', btn_new_request: 'New request',
    btn_track: 'Track request', btn_update_pw: 'Update password', btn_submit_request: 'Submit request', btn_update: 'Update',
    btn_request_service: 'Request service', btn_reset_pw: 'Reset password',
    /* hero */
    hero_pill: 'Digital government • Available 24/7',
    hero_title: 'Government services, one secure click away',
    hero_sub: 'Apply for documents, book appointments and track every request online – no queues, no paperwork, no travelling to government offices.',
    hero_cta1: 'Explore services', hero_cta2: 'Create free account',
    stat_services: 'Online services', stat_access: 'Access anytime', stat_paperless: 'Paperless',
    hero_card1_t: 'Request approved', hero_card1_s: 'Passport renewal • REQ-1042',
    hero_card2_t: 'Under review', hero_card2_s: 'Birth certificate • REQ-1043',
    hero_card3_t: 'New notification', hero_card3_s: 'Your appointment is confirmed',
    /* about */
    about_eyebrow: 'About us', about_title: 'A simpler way to deal with government',
    about_sub: 'GovTech is a demonstration of a unified citizen portal that brings essential services into one place.',
    about_p1: 'This portal was designed to show how public services can be delivered digitally: citizens create an account, choose a service, submit a request and follow its progress in real time.',
    about_p2: 'It is an academic front-end project built with HTML, CSS and JavaScript. All records are sample data stored in your browser.',
    about_mission_t: 'Our mission', about_mission: 'Make every public service accessible, fast and transparent for all citizens.',
    about_vision_t: 'Our vision', about_vision: 'A fully digital government where no one needs to wait in line.',
    feat1_t: 'Secure', feat1_d: 'Validated forms and protected sessions keep your information safe (demo level).',
    feat2_t: 'Fast', feat2_d: 'Submit requests in minutes and get instant status updates.',
    feat3_t: 'Transparent', feat3_d: 'Track each request step by step from submission to decision.',
    feat4_t: 'Bilingual', feat4_d: 'Full Arabic and English support, including right-to-left layout.',
    /* services section */
    svc_eyebrow: 'Government services', svc_title: 'Everything you need, online',
    svc_sub: 'Choose a service, fill in the request form and follow its status from your dashboard.',
    how_eyebrow: 'How it works', how_title: 'Three simple steps',
    how1_t: 'Create an account', how1_d: 'Register with your basic details in less than two minutes.',
    how2_t: 'Submit a request', how2_d: 'Pick a service and complete its short online form.',
    how3_t: 'Track the result', how3_d: 'Follow the status and receive notifications on every update.',
    /* contact */
    contact_eyebrow: 'Contact us', contact_title: 'We are here to help',
    contact_sub: 'Send us a question or suggestion. (Demo: messages are saved in your browser only.)',
    contact_addr_t: 'Address', contact_addr: '1 Digital Government Square, Smart City (demo address)',
    contact_phone_t: 'Phone', contact_mail_t: 'Email', contact_hours_t: 'Working hours',
    contact_hours: 'Sunday – Thursday, 9:00 – 16:00',
    contact_form_t: 'Send us a message', f_name: 'Your name', f_subject: 'Subject', f_message: 'Message',
    contact_sent: 'Thank you! Your message was saved (demo).',
    /* footer */
    footer_about: 'A demonstration portal for online government services. Built for academic purposes only.',
    footer_links: 'Quick links', footer_account: 'Account', footer_admin: 'Admin panel',
    footer_rights: 'All rights reserved.', footer_demo: 'Demo project – not an official government website.',
    /* registration */
    reg_title: 'Create your account', reg_sub: 'Fill in the form below to register as a citizen.',
    f_fullname: 'Full name', f_username: 'Username', h_username: '4–20 characters: letters, numbers or underscore.',
    f_email: 'Email address', f_phone: 'Phone number', f_password: 'Password',
    h_password: 'At least 8 characters with upper & lower case letters, a number and a symbol.',
    f_confirm: 'Confirm password', f_gender: 'Gender', gender_male: 'Male', gender_female: 'Female',
    f_nationality: 'Nationality', select_one: '— Select —',
    nat_egyptian: 'Egyptian', nat_saudi: 'Saudi', nat_emirati: 'Emirati', nat_kuwaiti: 'Kuwaiti',
    nat_jordanian: 'Jordanian', nat_moroccan: 'Moroccan', nat_other: 'Other',
    f_nid: 'National ID (demo)', optional: '(optional)', h_nid: 'Demo field – enter 10 to 14 digits, or leave empty.',
    f_address: 'Address', reg_have: 'Already have an account?', show_hide: 'Show / hide password',
    pw_level_1: 'Weak password', pw_level_2: 'Fair password', pw_level_3: 'Good password', pw_level_4: 'Strong password',
    reg_success: 'Account created successfully! Please log in.',
    /* login */
    login_side_t: 'Welcome back', login_side_d: 'Sign in to manage your requests and follow your applications.',
    login_li1: 'Submit service requests online', login_li2: 'Track every request status', login_li3: 'Receive instant notifications',
    login_title: 'Sign in', login_sub: 'Enter your account details to continue.',
    f_username_email: 'Username or email', remember: 'Remember me', forgot: 'Forgot password?',
    demo_creds: 'Demo accounts (click to fill):', demo_citizen: 'Citizen', demo_admin: 'Admin',
    login_new: 'New to the portal?',
    login_invalid: 'Incorrect username or password.', login_suspended: 'This account has been suspended. Contact support.',
    login_ok: 'Welcome back, {name}!', logout_ok: 'You have been logged out.', login_required: 'Please log in to continue.',
    /* forgot password */
    fp_title: 'Reset your password', fp_sub: 'Demo only: no email is sent. Enter your account email and choose a new password.',
    fp_notfound: 'No account was found with this email.', fp_done: 'Password updated. You can now log in.',
    /* dashboard */
    dash_overview: 'Overview', dash_services: 'Government services', dash_requests: 'My requests',
    dash_notifications: 'Notifications', dash_profile: 'My profile',
    welcome: 'Welcome, {name} 👋', welcome_sub: 'Here is a summary of your activity. Today is {date}.',
    stat_total: 'Total requests', stat_inprogress: 'Pending', stat_approved: 'Approved', stat_rejected: 'Rejected',
    recent_requests: 'Recent requests', latest_notifs: 'Latest notifications', view_all: 'View all',
    quick_services: 'Available services', svc_panel_sub: 'Select a service to open its request form.',
    search_services: 'Search services…', req_panel_sub: 'All requests you submitted and their current status.',
    track_title: 'Track a request by ID', search_requests: 'Search by ID or service…', all_statuses: 'All statuses',
    notif_sub: 'Updates about your requests and account.', mark_all_read: 'Mark all as read',
    profile_sub: 'View and update your personal information.', edit_profile: 'Edit profile', change_password: 'Change password',
    f_current_pw: 'Current password', f_new_pw: 'New password',
    no_requests: 'No requests found.', no_notifs: 'No notifications yet.', no_services: 'No services match your search.',
    th_id: 'Request ID', th_service: 'Service', th_date: 'Submitted', th_status: 'Status', th_actions: 'Actions',
    th_citizen: 'Citizen', th_updated: 'Last update', th_name: 'Name', th_username: 'Username', th_email: 'Email',
    th_nationality: 'Nationality', th_registered: 'Registered', th_requests: 'Requests',
    track_not_found: 'No request with this ID was found on your account.', track_enter: 'Please enter a request ID.',
    profile_saved: 'Profile updated successfully.', password_changed: 'Password changed successfully.',
    pw_wrong: 'Current password is incorrect.',
    /* service modal */
    svc_your_requests: 'Your requests for this service', svc_none_yet: 'You have not submitted a request for this service yet.',
    req_submitted_t: 'Request submitted!', req_submitted_d: 'Your request has been received and is now pending review.',
    req_id_label: 'Request ID', btn_track_now: 'Track this request',
    login_to_request: 'Please log in or register to submit a service request.',
    /* tracking */
    track_modal_title: 'Request tracking', step_submitted: 'Submitted', step_review: 'Under review', step_decision: 'Decision',
    req_details: 'Request details', req_history: 'Status history', hist_submitted: 'Request submitted',
    st_current: 'Current status', note: 'Note',
    /* statuses */
    status_pending: 'Pending', status_review: 'Under Review', status_approved: 'Approved', status_rejected: 'Rejected',
    /* notifications */
    notif_welcome: 'Welcome to GovTech Portal, {name}! Your account is ready.',
    notif_submitted: 'Your request {id} ({service}) was submitted successfully.',
    notif_status: 'Your request {id} ({service}) is now: {status}.',
    /* validation */
    v_required: 'This field is required.', v_min_len: 'Please enter at least {n} characters.',
    v_name: 'Name may contain letters and spaces only.', v_email: 'Enter a valid email address.',
    v_email_taken: 'This email is already registered.', v_username: 'Use 4–20 letters, numbers or underscores.',
    v_username_taken: 'This username is already taken.',
    v_password: 'Password must be 8+ characters with upper & lower case, a number and a symbol.',
    v_confirm: 'Passwords do not match.', v_gender: 'Please select a gender.', v_nationality: 'Please select a nationality.',
    v_nid: 'National ID must be 10 to 14 digits.', v_phone: 'Enter a valid phone number (8–15 digits, optional +).',
    v_invalid: 'Invalid value.', v_number_range: 'Enter a number between {min} and {max}.',
    v_date_future: 'Please choose a future date.', v_date_past: 'The date cannot be in the future.',
    v_date_far: 'Please choose a date within the next 90 days.', v_date_invalid: 'Enter a valid date.',
    /* citizen services catalogue */
    s1_name: 'National ID Services', s1_desc: 'Apply for a new national ID card, renew yours, or replace a lost or damaged card.',
    s2_name: 'Passport Services', s2_desc: 'Request a new passport, renew an existing one, or report a lost passport.',
    s3_name: 'Birth Certificate Request', s3_desc: 'Request an official copy of a birth certificate for yourself or a family member.',
    s4_name: 'Employment Services', s4_desc: 'Register as a job seeker, apply for public jobs or request a work permit.',
    s5_name: 'Education Services', s5_desc: 'Certificate verification, scholarship applications and school enrollment.',
    s6_name: 'Government Complaints', s6_desc: 'File a complaint about a public service and follow how it is handled.',
    s7_name: 'Document Renewal', s7_desc: 'Renew driver licenses, vehicle registrations, residence permits and more.',
    s8_name: 'Appointment Booking', s8_desc: 'Book an in-person appointment at a government office at a time that suits you.',
    /* admin */
    admin_panel: 'Admin Panel', back_to_portal: 'Back to portal', role_admin: 'Administrator',
    admin_users: 'Users management', admin_requests: 'Service requests', reset_demo: 'Reset demo data',
    admin_welcome: 'Welcome, {name}', admin_welcome_sub: 'System overview of users and service requests (sample data).',
    adm_users: 'Registered users', adm_requests: 'Total requests', adm_pending: 'Pending requests',
    adm_approved: 'Approved requests', adm_rejected: 'Rejected requests',
    chart_status: 'Requests by status', chart_service: 'Requests by service',
    users_sub: 'Search, filter and manage registered accounts.', search_users: 'Search name, username, email, phone…',
    admin_req_sub: 'Review requests and update their status.', search_admin_requests: 'Search ID, citizen or service…',
    all_nationalities: 'All nationalities', all_account_status: 'All accounts', all_services: 'All services',
    acc_active: 'Active', acc_suspended: 'Suspended', role_citizen: 'Citizen',
    btn_suspend: 'Suspend', btn_activate: 'Activate', btn_delete: 'Delete',
    no_users: 'No users match your filters.', user_details: 'User details',
    f_role: 'Role', f_account_status: 'Account status', f_registered: 'Registered on', f_gender_label: 'Gender',
    male: 'Male', female: 'Female',
    confirm_delete_user_t: 'Delete this user?', confirm_delete_user: 'This will permanently delete {name} together with their requests and notifications.',
    confirm_suspend_t: 'Change account status?', confirm_suspend: 'Do you want to change the status of {name}?',
    confirm_reset_t: 'Reset demo data?', confirm_reset: 'All users, requests and notifications will be replaced with the original sample data.',
    user_deleted: 'User deleted.', user_status_changed: 'Account status updated.', reset_done: 'Demo data has been reset.',
    status_updated: 'Request {id} updated to {status}.', admin_note: 'Admin note (optional)',
    update_status: 'Update status', f_citizen: 'Citizen', f_submitted: 'Submitted on',
    cannot_modify_admin: 'Admin accounts cannot be modified here.',
    /* document titles */
    doc_title_index: 'GovTech – Smart Government Services Portal', doc_title_admin: 'GovTech – Admin Dashboard'
  },

  ar: {
    demo_banner: 'مشروع أكاديمي (واجهة أمامية) – بيانات تجريبية فقط. غير متصل بأي قاعدة بيانات أو خدمة حكومية رسمية.',
    brand_name: 'بوابة GovTech', brand_tag: 'الخدمات الحكومية الذكية',
    nav_home: 'الرئيسية', nav_about: 'من نحن', nav_services: 'الخدمات', nav_contact: 'اتصل بنا', nav_dashboard: 'لوحتي',
    btn_login: 'تسجيل الدخول', btn_register: 'إنشاء حساب', btn_logout: 'تسجيل الخروج', btn_cancel: 'إلغاء', btn_confirm: 'تأكيد',
    btn_send: 'إرسال الرسالة', btn_save: 'حفظ التغييرات', btn_close: 'إغلاق', btn_view: 'عرض', btn_track_short: 'تتبع',
    btn_create_account: 'إنشاء الحساب', btn_register_new: 'سجّل حسابًا جديدًا', btn_new_request: 'طلب جديد',
    btn_track: 'تتبع الطلب', btn_update_pw: 'تحديث كلمة المرور', btn_submit_request: 'إرسال الطلب', btn_update: 'تحديث',
    btn_request_service: 'اطلب الخدمة', btn_reset_pw: 'إعادة تعيين كلمة المرور',
    hero_pill: 'حكومة رقمية • متاحة على مدار الساعة',
    hero_title: 'الخدمات الحكومية على بُعد نقرة آمنة واحدة',
    hero_sub: 'قدّم على المستندات، واحجز المواعيد، وتابع كل طلباتك عبر الإنترنت – بلا طوابير ولا أوراق ولا سفر إلى المكاتب الحكومية.',
    hero_cta1: 'استكشف الخدمات', hero_cta2: 'أنشئ حسابًا مجانيًا',
    stat_services: 'خدمات إلكترونية', stat_access: 'متاحة دائمًا', stat_paperless: 'بدون أوراق',
    hero_card1_t: 'تمت الموافقة على الطلب', hero_card1_s: 'تجديد جواز السفر • REQ-1042',
    hero_card2_t: 'قيد المراجعة', hero_card2_s: 'شهادة الميلاد • REQ-1043',
    hero_card3_t: 'إشعار جديد', hero_card3_s: 'تم تأكيد موعدك',
    about_eyebrow: 'من نحن', about_title: 'طريقة أبسط للتعامل مع الحكومة',
    about_sub: 'GovTech نموذج توضيحي لبوابة موحدة للمواطنين تجمع الخدمات الأساسية في مكان واحد.',
    about_p1: 'صُممت هذه البوابة لتوضيح كيفية تقديم الخدمات العامة رقميًا: ينشئ المواطن حسابًا، ويختار خدمة، ويرسل طلبه ويتابع تقدمه لحظة بلحظة.',
    about_p2: 'هذا مشروع أكاديمي للواجهة الأمامية مبني بـ HTML وCSS وJavaScript. جميع السجلات بيانات تجريبية محفوظة في متصفحك.',
    about_mission_t: 'مهمتنا', about_mission: 'جعل كل خدمة عامة متاحة وسريعة وشفافة لجميع المواطنين.',
    about_vision_t: 'رؤيتنا', about_vision: 'حكومة رقمية بالكامل لا يضطر فيها أحد للانتظار في الطابور.',
    feat1_t: 'آمنة', feat1_d: 'نماذج موثّقة وجلسات محمية للحفاظ على معلوماتك (على مستوى العرض التجريبي).',
    feat2_t: 'سريعة', feat2_d: 'أرسل طلباتك في دقائق واحصل على تحديثات فورية للحالة.',
    feat3_t: 'شفافة', feat3_d: 'تابع كل طلب خطوة بخطوة من التقديم حتى صدور القرار.',
    feat4_t: 'ثنائية اللغة', feat4_d: 'دعم كامل للعربية والإنجليزية بما في ذلك الاتجاه من اليمين لليسار.',
    svc_eyebrow: 'الخدمات الحكومية', svc_title: 'كل ما تحتاجه عبر الإنترنت',
    svc_sub: 'اختر خدمة، واملأ نموذج الطلب، وتابع حالته من لوحتك الشخصية.',
    how_eyebrow: 'كيف تعمل', how_title: 'ثلاث خطوات بسيطة',
    how1_t: 'أنشئ حسابًا', how1_d: 'سجّل ببياناتك الأساسية في أقل من دقيقتين.',
    how2_t: 'أرسل طلبًا', how2_d: 'اختر الخدمة وأكمل نموذجها القصير عبر الإنترنت.',
    how3_t: 'تابع النتيجة', how3_d: 'تابع الحالة واستلم إشعارًا مع كل تحديث.',
    contact_eyebrow: 'اتصل بنا', contact_title: 'نحن هنا لمساعدتك',
    contact_sub: 'أرسل لنا سؤالًا أو اقتراحًا. (عرض تجريبي: تُحفظ الرسائل في متصفحك فقط.)',
    contact_addr_t: 'العنوان', contact_addr: '١ ميدان الحكومة الرقمية، المدينة الذكية (عنوان تجريبي)',
    contact_phone_t: 'الهاتف', contact_mail_t: 'البريد الإلكتروني', contact_hours_t: 'ساعات العمل',
    contact_hours: 'من الأحد إلى الخميس، 9:00 – 16:00',
    contact_form_t: 'أرسل لنا رسالة', f_name: 'اسمك', f_subject: 'الموضوع', f_message: 'الرسالة',
    contact_sent: 'شكرًا لك! تم حفظ رسالتك (عرض تجريبي).',
    footer_about: 'بوابة تجريبية للخدمات الحكومية الإلكترونية. أُنشئت لأغراض أكاديمية فقط.',
    footer_links: 'روابط سريعة', footer_account: 'الحساب', footer_admin: 'لوحة الإدارة',
    footer_rights: 'جميع الحقوق محفوظة.', footer_demo: 'مشروع تجريبي – ليس موقعًا حكوميًا رسميًا.',
    reg_title: 'أنشئ حسابك', reg_sub: 'املأ النموذج أدناه للتسجيل كمواطن.',
    f_fullname: 'الاسم الكامل', f_username: 'اسم المستخدم', h_username: 'من 4 إلى 20 حرفًا: أحرف إنجليزية أو أرقام أو شرطة سفلية.',
    f_email: 'البريد الإلكتروني', f_phone: 'رقم الهاتف', f_password: 'كلمة المرور',
    h_password: '8 أحرف على الأقل مع حروف كبيرة وصغيرة ورقم ورمز.',
    f_confirm: 'تأكيد كلمة المرور', f_gender: 'الجنس', gender_male: 'ذكر', gender_female: 'أنثى',
    f_nationality: 'الجنسية', select_one: '— اختر —',
    nat_egyptian: 'مصري', nat_saudi: 'سعودي', nat_emirati: 'إماراتي', nat_kuwaiti: 'كويتي',
    nat_jordanian: 'أردني', nat_moroccan: 'مغربي', nat_other: 'أخرى',
    f_nid: 'الرقم القومي (تجريبي)', optional: '(اختياري)', h_nid: 'حقل تجريبي – أدخل من 10 إلى 14 رقمًا أو اتركه فارغًا.',
    f_address: 'العنوان', reg_have: 'لديك حساب بالفعل؟', show_hide: 'إظهار / إخفاء كلمة المرور',
    pw_level_1: 'كلمة مرور ضعيفة', pw_level_2: 'كلمة مرور مقبولة', pw_level_3: 'كلمة مرور جيدة', pw_level_4: 'كلمة مرور قوية',
    reg_success: 'تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول.',
    login_side_t: 'مرحبًا بعودتك', login_side_d: 'سجّل الدخول لإدارة طلباتك ومتابعة معاملاتك.',
    login_li1: 'أرسل طلبات الخدمات عبر الإنترنت', login_li2: 'تابع حالة كل طلب', login_li3: 'استلم إشعارات فورية',
    login_title: 'تسجيل الدخول', login_sub: 'أدخل بيانات حسابك للمتابعة.',
    f_username_email: 'اسم المستخدم أو البريد', remember: 'تذكرني', forgot: 'هل نسيت كلمة المرور؟',
    demo_creds: 'حسابات تجريبية (اضغط للتعبئة):', demo_citizen: 'مواطن', demo_admin: 'مدير',
    login_new: 'جديد في البوابة؟',
    login_invalid: 'اسم المستخدم أو كلمة المرور غير صحيحة.', login_suspended: 'تم إيقاف هذا الحساب. يرجى التواصل مع الدعم.',
    login_ok: 'مرحبًا بعودتك، {name}!', logout_ok: 'تم تسجيل خروجك.', login_required: 'يرجى تسجيل الدخول للمتابعة.',
    fp_title: 'إعادة تعيين كلمة المرور', fp_sub: 'عرض تجريبي: لا يتم إرسال بريد. أدخل بريد حسابك واختر كلمة مرور جديدة.',
    fp_notfound: 'لم يتم العثور على حساب بهذا البريد.', fp_done: 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.',
    dash_overview: 'نظرة عامة', dash_services: 'الخدمات الحكومية', dash_requests: 'طلباتي',
    dash_notifications: 'الإشعارات', dash_profile: 'ملفي الشخصي',
    welcome: 'مرحبًا، {name} 👋', welcome_sub: 'هذا ملخص نشاطك. اليوم {date}.',
    stat_total: 'إجمالي الطلبات', stat_inprogress: 'قيد الانتظار', stat_approved: 'مقبولة', stat_rejected: 'مرفوضة',
    recent_requests: 'أحدث الطلبات', latest_notifs: 'أحدث الإشعارات', view_all: 'عرض الكل',
    quick_services: 'الخدمات المتاحة', svc_panel_sub: 'اختر خدمة لفتح نموذج الطلب الخاص بها.',
    search_services: 'ابحث في الخدمات…', req_panel_sub: 'جميع الطلبات التي قدمتها وحالتها الحالية.',
    track_title: 'تتبع طلب برقمه', search_requests: 'ابحث بالرقم أو الخدمة…', all_statuses: 'كل الحالات',
    notif_sub: 'تحديثات حول طلباتك وحسابك.', mark_all_read: 'تحديد الكل كمقروء',
    profile_sub: 'اعرض معلوماتك الشخصية وحدّثها.', edit_profile: 'تعديل الملف الشخصي', change_password: 'تغيير كلمة المرور',
    f_current_pw: 'كلمة المرور الحالية', f_new_pw: 'كلمة المرور الجديدة',
    no_requests: 'لا توجد طلبات.', no_notifs: 'لا توجد إشعارات بعد.', no_services: 'لا توجد خدمات مطابقة لبحثك.',
    th_id: 'رقم الطلب', th_service: 'الخدمة', th_date: 'تاريخ التقديم', th_status: 'الحالة', th_actions: 'إجراءات',
    th_citizen: 'المواطن', th_updated: 'آخر تحديث', th_name: 'الاسم', th_username: 'اسم المستخدم', th_email: 'البريد',
    th_nationality: 'الجنسية', th_registered: 'تاريخ التسجيل', th_requests: 'الطلبات',
    track_not_found: 'لا يوجد طلب بهذا الرقم في حسابك.', track_enter: 'يرجى إدخال رقم الطلب.',
    profile_saved: 'تم تحديث الملف الشخصي بنجاح.', password_changed: 'تم تغيير كلمة المرور بنجاح.',
    pw_wrong: 'كلمة المرور الحالية غير صحيحة.',
    svc_your_requests: 'طلباتك لهذه الخدمة', svc_none_yet: 'لم تقدّم أي طلب لهذه الخدمة بعد.',
    req_submitted_t: 'تم إرسال الطلب!', req_submitted_d: 'تم استلام طلبك وهو الآن قيد الانتظار للمراجعة.',
    req_id_label: 'رقم الطلب', btn_track_now: 'تتبع هذا الطلب',
    login_to_request: 'يرجى تسجيل الدخول أو إنشاء حساب لإرسال طلب خدمة.',
    track_modal_title: 'تتبع الطلب', step_submitted: 'تم التقديم', step_review: 'قيد المراجعة', step_decision: 'القرار',
    req_details: 'تفاصيل الطلب', req_history: 'سجل الحالة', hist_submitted: 'تم إرسال الطلب',
    st_current: 'الحالة الحالية', note: 'ملاحظة',
    status_pending: 'قيد الانتظار', status_review: 'قيد المراجعة', status_approved: 'مقبول', status_rejected: 'مرفوض',
    notif_welcome: 'مرحبًا بك في بوابة GovTech يا {name}! حسابك جاهز.',
    notif_submitted: 'تم إرسال طلبك {id} ({service}) بنجاح.',
    notif_status: 'أصبحت حالة طلبك {id} ({service}): {status}.',
    v_required: 'هذا الحقل مطلوب.', v_min_len: 'يرجى إدخال {n} أحرف على الأقل.',
    v_name: 'يجب أن يحتوي الاسم على حروف ومسافات فقط.', v_email: 'أدخل بريدًا إلكترونيًا صحيحًا.',
    v_email_taken: 'هذا البريد مسجّل مسبقًا.', v_username: 'استخدم من 4 إلى 20 حرفًا إنجليزيًا أو رقمًا أو شرطة سفلية.',
    v_username_taken: 'اسم المستخدم مستخدم بالفعل.',
    v_password: 'يجب أن تتكون كلمة المرور من 8 أحرف أو أكثر مع حروف كبيرة وصغيرة ورقم ورمز.',
    v_confirm: 'كلمتا المرور غير متطابقتين.', v_gender: 'يرجى اختيار الجنس.', v_nationality: 'يرجى اختيار الجنسية.',
    v_nid: 'يجب أن يتكون الرقم القومي من 10 إلى 14 رقمًا.', v_phone: 'أدخل رقم هاتف صحيحًا (من 8 إلى 15 رقمًا، و+ اختيارية).',
    v_invalid: 'قيمة غير صالحة.', v_number_range: 'أدخل رقمًا بين {min} و{max}.',
    v_date_future: 'يرجى اختيار تاريخ مستقبلي.', v_date_past: 'لا يمكن أن يكون التاريخ في المستقبل.',
    v_date_far: 'يرجى اختيار تاريخ خلال الـ 90 يومًا القادمة.', v_date_invalid: 'أدخل تاريخًا صحيحًا.',
    s1_name: 'خدمات بطاقة الهوية الوطنية', s1_desc: 'قدّم على بطاقة هوية وطنية جديدة، أو جدّد بطاقتك، أو استبدل بطاقة مفقودة أو تالفة.',
    s2_name: 'خدمات جواز السفر', s2_desc: 'اطلب جواز سفر جديدًا أو جدّد الحالي أو أبلغ عن فقدان جواز السفر.',
    s3_name: 'طلب شهادة ميلاد', s3_desc: 'اطلب نسخة رسمية من شهادة ميلاد لك أو لأحد أفراد أسرتك.',
    s4_name: 'خدمات التوظيف', s4_desc: 'سجّل كباحث عن عمل، أو قدّم على وظائف حكومية، أو اطلب تصريح عمل.',
    s5_name: 'الخدمات التعليمية', s5_desc: 'توثيق الشهادات وطلبات المنح الدراسية والتسجيل المدرسي.',
    s6_name: 'الشكاوى الحكومية', s6_desc: 'قدّم شكوى بشأن خدمة عامة وتابع كيفية معالجتها.',
    s7_name: 'تجديد المستندات', s7_desc: 'جدّد رخص القيادة وتسجيل المركبات وتصاريح الإقامة وغيرها.',
    s8_name: 'حجز المواعيد', s8_desc: 'احجز موعدًا حضوريًا في مكتب حكومي في الوقت المناسب لك.',
    admin_panel: 'لوحة الإدارة', back_to_portal: 'العودة للبوابة', role_admin: 'مدير النظام',
    admin_users: 'إدارة المستخدمين', admin_requests: 'طلبات الخدمات', reset_demo: 'إعادة ضبط البيانات',
    admin_welcome: 'مرحبًا، {name}', admin_welcome_sub: 'نظرة عامة على المستخدمين وطلبات الخدمات (بيانات تجريبية).',
    adm_users: 'المستخدمون المسجلون', adm_requests: 'إجمالي الطلبات', adm_pending: 'طلبات قيد الانتظار',
    adm_approved: 'طلبات مقبولة', adm_rejected: 'طلبات مرفوضة',
    chart_status: 'الطلبات حسب الحالة', chart_service: 'الطلبات حسب الخدمة',
    users_sub: 'ابحث وصفِّ وأدر الحسابات المسجلة.', search_users: 'ابحث بالاسم أو اسم المستخدم أو البريد أو الهاتف…',
    admin_req_sub: 'راجع الطلبات وحدّث حالتها.', search_admin_requests: 'ابحث بالرقم أو المواطن أو الخدمة…',
    all_nationalities: 'كل الجنسيات', all_account_status: 'كل الحسابات', all_services: 'كل الخدمات',
    acc_active: 'نشط', acc_suspended: 'موقوف', role_citizen: 'مواطن',
    btn_suspend: 'إيقاف', btn_activate: 'تفعيل', btn_delete: 'حذف',
    no_users: 'لا يوجد مستخدمون مطابقون.', user_details: 'تفاصيل المستخدم',
    f_role: 'الدور', f_account_status: 'حالة الحساب', f_registered: 'تاريخ التسجيل', f_gender_label: 'الجنس',
    male: 'ذكر', female: 'أنثى',
    confirm_delete_user_t: 'حذف هذا المستخدم؟', confirm_delete_user: 'سيتم حذف {name} نهائيًا مع جميع طلباته وإشعاراته.',
    confirm_suspend_t: 'تغيير حالة الحساب؟', confirm_suspend: 'هل تريد تغيير حالة حساب {name}؟',
    confirm_reset_t: 'إعادة ضبط البيانات؟', confirm_reset: 'سيتم استبدال جميع المستخدمين والطلبات والإشعارات بالبيانات التجريبية الأصلية.',
    user_deleted: 'تم حذف المستخدم.', user_status_changed: 'تم تحديث حالة الحساب.', reset_done: 'تمت إعادة ضبط البيانات.',
    status_updated: 'تم تحديث الطلب {id} إلى: {status}.', admin_note: 'ملاحظة المسؤول (اختيارية)',
    update_status: 'تحديث الحالة', f_citizen: 'المواطن', f_submitted: 'تاريخ التقديم',
    cannot_modify_admin: 'لا يمكن تعديل حسابات المسؤولين من هنا.',
    doc_title_index: 'GovTech – بوابة الخدمات الحكومية الذكية', doc_title_admin: 'GovTech – لوحة الإدارة'
  }
};

/** Translate a key (with optional {placeholders}). Falls back to English, then the key. */
function t(key, params) {
  let s = (I18N[state.lang] && I18N[state.lang][key]) ?? I18N.en[key] ?? key;
  if (params) Object.keys(params).forEach(k => { s = s.split('{' + k + '}').join(params[k]); });
  return s;
}

/** Pick the current-language text from a {en, ar} object. */
const L = obj => (obj && (obj[state.lang] || obj.en)) || '';

/* =====================================================================
   4. LANGUAGE HANDLING (English / Arabic, LTR / RTL)
   ===================================================================== */
function applyI18n(root = document) {
  $$('[data-i18n]', root).forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]', root).forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$('[data-i18n-title]', root).forEach(el => { el.title = t(el.dataset.i18nTitle); });
  $$('[data-i18n-aria-label]', root).forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)); });
}

function setLang(lang, silent) {
  state.lang = (lang === 'ar') ? 'ar' : 'en';
  try { localStorage.setItem(KEYS.lang, state.lang); } catch (e) { /* storage blocked */ }
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('doc_title_' + PAGE);
  const sel = $('#langSelect');
  if (sel) sel.value = state.lang;
  applyI18n();
  if (!silent) PageHooks.onLangChange();
}

/* =====================================================================
   5. STORAGE + DEMO SEED DATA
   ===================================================================== */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('Storage is unavailable in this browser.', 'error'); return false; }
  }
};

const DB = {
  users: () => store.get(KEYS.users, []),
  saveUsers: v => store.set(KEYS.users, v),
  requests: () => store.get(KEYS.requests, []),
  saveRequests: v => store.set(KEYS.requests, v),
  notifs: () => store.get(KEYS.notifs, []),
  saveNotifs: v => store.set(KEYS.notifs, v),
  userById: id => DB.users().find(u => u.id === id),
  serviceById: id => SERVICES.find(s => s.id === id)
};

/** Creates sample users, requests and notifications the first time the app runs. */
function seedData(force) {
  if (!force && localStorage.getItem(KEYS.seeded)) return;
  const day = 864e5, now = Date.now();
  const ago = d => new Date(now - d * day).toISOString();
  const pw = hashPassword('Citizen@123');
  const mk = (id, fullName, username, nationality, gender, phone, daysAgo, extra) => Object.assign({
    id, fullName, username, email: username.replace('_', '.') + '@example.com', passwordHash: pw, gender, nationality,
    nationalId: '', phone, address: 'Sample Street ' + (10 + daysAgo) + ', Demo City', role: 'citizen', status: 'active', createdAt: ago(daysAgo)
  }, extra || {});

  const users = [
    mk('u-admin', 'System Administrator', 'admin', 'Egyptian', 'male', '+201000000000', 120,
      { email: 'admin@govtech.example', passwordHash: hashPassword('Admin@123'), role: 'admin', address: 'GovTech HQ, Demo City' }),
    mk('u-1', 'Ahmed Hassan', 'citizen', 'Egyptian', 'male', '+201001234567', 60,
      { email: 'ahmed.hassan@example.com', nationalId: '29001011234567' }),
    mk('u-2', 'Sara Al-Qahtani', 'sara_q', 'Saudi', 'female', '+966501234567', 45),
    mk('u-3', 'Omar Khalid', 'omar_k', 'Egyptian', 'male', '+201112223334', 38),
    mk('u-4', 'Mona Adel', 'mona_a', 'Egyptian', 'female', '+201223334445', 30),
    mk('u-5', 'Yousef Al-Harbi', 'yousef_h', 'Saudi', 'male', '+966551112233', 21),
    mk('u-6', 'Laila Mansour', 'laila_m', 'Moroccan', 'female', '+212600112233', 14),
    mk('u-7', 'Khaled Jaber', 'khaled_j', 'Jordanian', 'male', '+962790112233', 9, { status: 'suspended' })
  ];

  // [userId, serviceId, status, daysAgo, sample data]
  const R = [
    ['u-1', 'passport', 'Approved', 40, { type: 'renew', pages: '48', speed: 'standard', notes: 'Expires next month.' }],
    ['u-1', 'birth-cert', 'Under Review', 6, { childName: 'Yara Ahmed Hassan', dob: '2024-03-12', birthPlace: 'Cairo', fatherName: 'Ahmed Hassan', motherName: 'Nour Samir', copies: '2' }],
    ['u-1', 'appointment', 'Pending', 1, { office: 'main', purpose: 'passport', date: toInputDate(new Date(now + 9 * day)), time: '10:00', notes: '' }],
    ['u-1', 'complaint', 'Rejected', 25, { department: 'municipal', subject: 'Street lighting', description: 'The street lights near my building have been off for weeks.', priority: 'normal' }],
    ['u-2', 'national-id', 'Approved', 33, { requestType: 'renew', currentId: '', delivery: 'pickup', notes: '' }],
    ['u-2', 'education', 'Pending', 3, { type: 'scholarship', institution: 'King Saud University', year: '2023', details: 'Master scholarship request.' }],
    ['u-3', 'employment', 'Under Review', 8, { serviceType: 'job_search', field: 'it', education: 'bachelor', experience: '3', summary: 'Software developer with three years of experience.' }],
    ['u-3', 'renewal', 'Approved', 20, { docType: 'driver', docNumber: 'DL-448821', expiry: '2026-12-01', notes: '' }],
    ['u-4', 'birth-cert', 'Approved', 28, { childName: 'Adam Mona', dob: '2022-07-01', birthPlace: 'Giza', fatherName: 'Hossam Adel', motherName: 'Mona Adel', copies: '1' }],
    ['u-4', 'complaint', 'Under Review', 4, { department: 'health', subject: 'Long waiting time', description: 'Waited more than four hours at the local clinic without service.', priority: 'high' }],
    ['u-5', 'passport', 'Pending', 2, { type: 'new', pages: '32', speed: 'express', notes: '' }],
    ['u-5', 'national-id', 'Rejected', 15, { requestType: 'correct', currentId: '', delivery: 'courier', notes: 'Spelling correction.' }],
    ['u-6', 'appointment', 'Approved', 12, { office: 'north', purpose: 'inquiry', date: toInputDate(new Date(now - 5 * day)), time: '11:00', notes: '' }],
    ['u-6', 'renewal', 'Pending', 1, { docType: 'residence', docNumber: 'RP-99210', expiry: '2026-09-30', notes: '' }]
  ];
  const requests = R.map((r, i) => {
    const created = ago(r[3]);
    const history = [{ status: STATUS.PENDING, date: created, note: '', by: 'system' }];
    if (r[2] !== STATUS.PENDING) history.push({ status: STATUS.REVIEW, date: ago(Math.max(r[3] - 1, 0)), note: '', by: 'admin' });
    if (r[2] === STATUS.APPROVED || r[2] === STATUS.REJECTED) {
      history.push({ status: r[2], date: ago(Math.max(r[3] - 2, 0)), note: '', by: 'admin' });
    }
    return {
      id: 'REQ-' + (1001 + i), userId: r[0], serviceId: r[1], status: r[2], data: r[4],
      createdAt: created, updatedAt: history[history.length - 1].date, history
    };
  });

  const notifs = [
    { id: 'n-1', userId: 'u-1', key: 'notif_welcome', params: { name: 'Ahmed Hassan' }, date: ago(60), read: true },
    { id: 'n-2', userId: 'u-1', key: 'notif_status', params: { id: 'REQ-1001', serviceId: 'passport', status: 'Approved' }, date: ago(38), read: true },
    { id: 'n-3', userId: 'u-1', key: 'notif_status', params: { id: 'REQ-1004', serviceId: 'complaint', status: 'Rejected' }, date: ago(23), read: false },
    { id: 'n-4', userId: 'u-1', key: 'notif_status', params: { id: 'REQ-1002', serviceId: 'birth-cert', status: 'Under Review' }, date: ago(5), read: false },
    { id: 'n-5', userId: 'u-1', key: 'notif_submitted', params: { id: 'REQ-1003', serviceId: 'appointment' }, date: ago(1), read: false }
  ];

  DB.saveUsers(users); DB.saveRequests(requests); DB.saveNotifs(notifs);
  try { localStorage.setItem(KEYS.seeded, '1'); } catch (e) { /* ignore */ }
}

/* =====================================================================
   6. AUTHENTICATION / SESSION
   "Remember me" keeps the session in localStorage; otherwise it lives in
   sessionStorage and ends when the tab is closed.
   ===================================================================== */
function getSession() {
  try {
    const raw = sessionStorage.getItem(KEYS.session) || localStorage.getItem(KEYS.session);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function setSession(userId, remember) {
  clearSession();
  const data = JSON.stringify({ userId, ts: Date.now() });
  try { (remember ? localStorage : sessionStorage).setItem(KEYS.session, data); } catch (e) { /* ignore */ }
}
function clearSession() {
  try { sessionStorage.removeItem(KEYS.session); localStorage.removeItem(KEYS.session); } catch (e) { /* ignore */ }
}
function currentUser() {
  const s = getSession();
  if (!s) return null;
  const u = DB.userById(s.userId);
  if (!u || u.status === 'suspended') { clearSession(); return null; }
  return u;
}
function findUserByLogin(login) {
  const l = String(login).trim().toLowerCase();
  return DB.users().find(u => u.username.toLowerCase() === l || u.email.toLowerCase() === l);
}
function attemptLogin(login, password, remember) {
  const u = findUserByLogin(login);
  if (!u || u.passwordHash !== hashPassword(password)) return { ok: false, err: 'login_invalid' };
  if (u.status === 'suspended') return { ok: false, err: 'login_suspended' };
  setSession(u.id, remember);
  return { ok: true, user: u };
}

/* =====================================================================
   7. UI HELPERS: toast, modal, confirm dialog
   ===================================================================== */
function toast(message, type = 'success') {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove(); // keep at most 3 toasts on screen
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3800);
}

let lastFocus = null;
function openModal(html) {
  const modal = $('#modal');
  lastFocus = document.activeElement;
  $('#modalBody').innerHTML = html;
  hydrateIcons($('#modalBody'));
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  const first = $('#modalBody input, #modalBody select, #modalBody textarea, #modalBody button');
  if (first) first.focus();
  return $('#modalBody');
}
function closeModal() {
  const modal = $('#modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  $('#modalBody').innerHTML = '';
  document.body.classList.remove('modal-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

/** Promise-based confirmation dialog. Resolves true / false. */
function confirmDialog(titleKey, textKey, params) {
  return new Promise(resolve => {
    const m = $('#confirmModal');
    $('#confirmTitle').textContent = t(titleKey);
    $('#confirmText').textContent = t(textKey, params);
    m.hidden = false; m.setAttribute('aria-hidden', 'false');
    const done = val => {
      m.hidden = true; m.setAttribute('aria-hidden', 'true');
      $('#confirmYes').onclick = $('#confirmNo').onclick = null;
      $$('[data-close-confirm]', m).forEach(b => { b.onclick = null; });
      resolve(val);
    };
    $('#confirmYes').onclick = () => done(true);
    $('#confirmNo').onclick = () => done(false);
    $$('[data-close-confirm]', m).forEach(b => { b.onclick = () => done(false); });
    $('#confirmNo').focus();
  });
}

/** Fills a <select>, keeping the selected value. options = [{value,label}] */
function fillSelect(sel, options, keep) {
  if (!sel) return;
  const current = keep !== undefined ? keep : sel.value;
  sel.innerHTML = options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  sel.value = options.some(o => o.value === current) ? current : options[0].value;
}

function statusBadge(status) {
  return `<span class="status ${STATUS_CLASS[status] || 'pending'}">${esc(t(STATUS_KEY[status] || status))}</span>`;
}
function emptyState(key) {
  return `<div class="empty">${icon('inbox', 36)}<p>${esc(t(key))}</p></div>`;
}

/* =====================================================================
   8. SERVICES CATALOGUE – 8 sample government services
   Each service: id, icon, name/desc (translation keys) and the fields of
   its request form. Field types: text, number, date, select, textarea.
   ===================================================================== */
const opt = (v, en, ar) => ({ v, en, ar });
const fld = (name, type, en, ar, extra) => Object.assign({ name, type, label: { en, ar } }, extra || {});
const DELIVERY = [opt('pickup', 'Pick up from office', 'الاستلام من المكتب'), opt('courier', 'Courier delivery', 'التوصيل بالبريد السريع')];

const SERVICES = [
  {
    id: 'national-id', icon: 'id', nameKey: 's1_name', descKey: 's1_desc',
    fields: [
      fld('requestType', 'select', 'Request type', 'نوع الطلب', { required: true, options: [
        opt('new', 'New ID card', 'بطاقة جديدة'), opt('renew', 'Renew ID card', 'تجديد البطاقة'),
        opt('replace', 'Replace lost / damaged card', 'استبدال بطاقة مفقودة / تالفة'), opt('correct', 'Correct personal data', 'تصحيح البيانات الشخصية')] }),
      fld('currentId', 'text', 'Current ID number (if any)', 'رقم البطاقة الحالية (إن وجد)', { pattern: /^\d{10,14}$/, patternMsg: 'v_nid' }),
      fld('delivery', 'select', 'Delivery method', 'طريقة الاستلام', { required: true, options: DELIVERY }),
      fld('notes', 'textarea', 'Additional notes', 'ملاحظات إضافية', { full: true })
    ]
  },
  {
    id: 'passport', icon: 'passport', nameKey: 's2_name', descKey: 's2_desc',
    fields: [
      fld('type', 'select', 'Request type', 'نوع الطلب', { required: true, options: [
        opt('new', 'New passport', 'جواز سفر جديد'), opt('renew', 'Renew passport', 'تجديد الجواز'),
        opt('lost', 'Lost / stolen passport', 'جواز مفقود / مسروق'), opt('minor', 'Passport for a minor', 'جواز لقاصر')] }),
      fld('pages', 'select', 'Number of pages', 'عدد الصفحات', { required: true, options: [opt('32', '32 pages', '32 صفحة'), opt('48', '48 pages', '48 صفحة')] }),
      fld('speed', 'select', 'Processing speed', 'سرعة المعالجة', { required: true, options: [opt('standard', 'Standard', 'عادية'), opt('express', 'Express', 'مستعجلة')] }),
      fld('notes', 'textarea', 'Additional notes', 'ملاحظات إضافية', { full: true })
    ]
  },
  {
    id: 'birth-cert', icon: 'birth', nameKey: 's3_name', descKey: 's3_desc',
    fields: [
      fld('childName', 'text', 'Name on certificate', 'الاسم في الشهادة', { required: true, minLen: 3 }),
      fld('dob', 'date', 'Date of birth', 'تاريخ الميلاد', { required: true, dateRule: 'past' }),
      fld('birthPlace', 'text', 'Place of birth', 'مكان الميلاد', { required: true, minLen: 2 }),
      fld('fatherName', 'text', "Father's name", 'اسم الأب', { required: true, minLen: 3 }),
      fld('motherName', 'text', "Mother's name", 'اسم الأم', { required: true, minLen: 3 }),
      fld('copies', 'number', 'Number of copies', 'عدد النسخ', { required: true, min: 1, max: 10 })
    ]
  },
  {
    id: 'employment', icon: 'briefcase', nameKey: 's4_name', descKey: 's4_desc',
    fields: [
      fld('serviceType', 'select', 'Service type', 'نوع الخدمة', { required: true, options: [
        opt('job_search', 'Apply for a public job', 'التقدم لوظيفة حكومية'), opt('register', 'Job-seeker registration', 'تسجيل باحث عن عمل'),
        opt('support', 'Unemployment support', 'دعم البطالة'), opt('permit', 'Work permit', 'تصريح عمل')] }),
      fld('field', 'select', 'Preferred field', 'المجال المفضل', { required: true, options: [
        opt('it', 'Information technology', 'تقنية المعلومات'), opt('health', 'Health', 'الصحة'), opt('education', 'Education', 'التعليم'),
        opt('engineering', 'Engineering', 'الهندسة'), opt('admin', 'Administration', 'الإدارة')] }),
      fld('education', 'select', 'Education level', 'المستوى التعليمي', { required: true, options: [
        opt('secondary', 'Secondary school', 'ثانوي'), opt('bachelor', "Bachelor's degree", 'بكالوريوس'), opt('master', "Master's degree", 'ماجستير'), opt('phd', 'Doctorate', 'دكتوراه')] }),
      fld('experience', 'number', 'Years of experience', 'سنوات الخبرة', { required: true, min: 0, max: 50 }),
      fld('summary', 'textarea', 'Short professional summary', 'نبذة مهنية مختصرة', { required: true, minLen: 10, full: true })
    ]
  },
  {
    id: 'education', icon: 'cap', nameKey: 's5_name', descKey: 's5_desc',
    fields: [
      fld('type', 'select', 'Service type', 'نوع الخدمة', { required: true, options: [
        opt('verify', 'Certificate verification', 'توثيق شهادة'), opt('scholarship', 'Scholarship application', 'طلب منحة دراسية'),
        opt('equivalency', 'Degree equivalency', 'معادلة شهادة'), opt('enroll', 'School enrollment', 'تسجيل مدرسي')] }),
      fld('institution', 'text', 'Institution name', 'اسم المؤسسة التعليمية', { required: true, minLen: 3 }),
      fld('year', 'number', 'Year of graduation / enrollment', 'سنة التخرج / الالتحاق', { required: true, min: 1970, max: 2035 }),
      fld('details', 'textarea', 'Details', 'تفاصيل', { full: true })
    ]
  },
  {
    id: 'complaint', icon: 'complaint', nameKey: 's6_name', descKey: 's6_desc',
    fields: [
      fld('department', 'select', 'Department', 'الجهة', { required: true, options: [
        opt('health', 'Health', 'الصحة'), opt('transport', 'Transport', 'النقل'), opt('municipal', 'Municipal services', 'الخدمات البلدية'),
        opt('education', 'Education', 'التعليم'), opt('utilities', 'Utilities', 'المرافق'), opt('other', 'Other', 'أخرى')] }),
      fld('priority', 'select', 'Priority', 'الأولوية', { required: true, options: [opt('low', 'Low', 'منخفضة'), opt('normal', 'Normal', 'عادية'), opt('high', 'High', 'عالية')] }),
      fld('subject', 'text', 'Subject', 'الموضوع', { required: true, minLen: 5, full: true }),
      fld('description', 'textarea', 'Complaint description', 'وصف الشكوى', { required: true, minLen: 20, full: true })
    ]
  },
  {
    id: 'renewal', icon: 'renew', nameKey: 's7_name', descKey: 's7_desc',
    fields: [
      fld('docType', 'select', 'Document type', 'نوع المستند', { required: true, options: [
        opt('driver', 'Driver license', 'رخصة القيادة'), opt('vehicle', 'Vehicle registration', 'ترخيص المركبة'),
        opt('residence', 'Residence permit', 'تصريح الإقامة'), opt('professional', 'Professional license', 'رخصة مهنية')] }),
      fld('docNumber', 'text', 'Document number', 'رقم المستند', { required: true, minLen: 4 }),
      fld('expiry', 'date', 'Expiry date', 'تاريخ الانتهاء', { required: true }),
      fld('notes', 'textarea', 'Additional notes', 'ملاحظات إضافية', { full: true })
    ]
  },
  {
    id: 'appointment', icon: 'calendar', nameKey: 's8_name', descKey: 's8_desc',
    fields: [
      fld('office', 'select', 'Office', 'المكتب', { required: true, options: [
        opt('main', 'Main office – Downtown', 'المكتب الرئيسي – وسط المدينة'), opt('north', 'North district office', 'مكتب المنطقة الشمالية'), opt('south', 'South district office', 'مكتب المنطقة الجنوبية')] }),
      fld('purpose', 'select', 'Purpose of visit', 'سبب الزيارة', { required: true, options: [
        opt('id', 'National ID', 'بطاقة الهوية'), opt('passport', 'Passport', 'جواز السفر'), opt('certificates', 'Certificates', 'الشهادات'), opt('inquiry', 'General inquiry', 'استفسار عام')] }),
      fld('date', 'date', 'Preferred date', 'التاريخ المفضل', { required: true, dateRule: 'future', maxDays: 90 }),
      fld('time', 'select', 'Preferred time', 'الوقت المفضل', { required: true, options: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'].map(x => opt(x, x, x)) }),
      fld('notes', 'textarea', 'Additional notes', 'ملاحظات إضافية', { full: true })
    ]
  }
];

const svcName = s => t(s.nameKey);
const svcDesc = s => t(s.descKey);

/** Human readable value of a stored form field (maps select values to labels). */
function displayFieldValue(f, value) {
  if (value === undefined || value === '') return '—';
  if (f.type === 'select') { const o = f.options.find(o => o.v === value); return o ? L(o) : value; }
  if (f.type === 'date') return fmtDate(value + 'T00:00:00');
  return value;
}

/** Builds the HTML of one form field from its definition. */
function renderFieldHtml(f, prefix) {
  const id = `${prefix}_${f.name}`;
  let control;
  if (f.type === 'select') {
    control = `<select id="${id}" name="${f.name}"><option value="">${esc(t('select_one'))}</option>` +
      f.options.map(o => `<option value="${esc(o.v)}">${esc(L(o))}</option>`).join('') + '</select>';
  } else if (f.type === 'textarea') {
    control = `<textarea id="${id}" name="${f.name}" rows="3"></textarea>`;
  } else {
    let attrs = '';
    if (f.type === 'number') attrs = ` min="${f.min}" max="${f.max}" inputmode="numeric"`;
    if (f.type === 'date') {
      const today = startOfToday();
      if (f.dateRule === 'past') attrs = ` max="${toInputDate(today)}"`;
      if (f.dateRule === 'future') {
        const min = new Date(today); min.setDate(min.getDate() + 1);
        attrs = ` min="${toInputDate(min)}"`;
        if (f.maxDays) { const max = new Date(today); max.setDate(max.getDate() + f.maxDays); attrs += ` max="${toInputDate(max)}"`; }
      }
    }
    control = `<input id="${id}" name="${f.name}" type="${f.type}"${attrs}>`;
  }
  const mark = f.required ? ' <b class="req">*</b>' : ` <em class="opt">${esc(t('optional'))}</em>`;
  return `<div class="field${f.full ? ' full' : ''}" data-field="${f.name}"><label for="${id}">${esc(L(f.label))}${mark}</label>${control}<small class="error"></small></div>`;
}

/** Converts a service's field definitions into validation rules. */
function rulesFromFields(fields) {
  const rules = {};
  fields.forEach(f => {
    rules[f.name] = v => {
      if (!v) return f.required ? t('v_required') : null;
      if (f.minLen && v.length < f.minLen) return t('v_min_len', { n: f.minLen });
      if (f.pattern && !f.pattern.test(v)) return t(f.patternMsg || 'v_invalid');
      if (f.type === 'number') {
        const n = Number(v);
        if (!Number.isFinite(n) || n < f.min || n > f.max) return t('v_number_range', { min: f.min, max: f.max });
      }
      if (f.type === 'date') {
        const d = new Date(v + 'T00:00:00');
        if (isNaN(d)) return t('v_date_invalid');
        const today = startOfToday();
        if (f.dateRule === 'future' && d <= today) return t('v_date_future');
        if (f.dateRule === 'past' && d > today) return t('v_date_past');
        if (f.maxDays) { const max = new Date(today); max.setDate(max.getDate() + f.maxDays); if (d > max) return t('v_date_far'); }
      }
      return null;
    };
  });
  return rules;
}

/* =====================================================================
   9. REQUESTS & NOTIFICATIONS API
   ===================================================================== */
function nextRequestId() {
  const nums = DB.requests().map(r => parseInt(String(r.id).replace(/\D/g, ''), 10) || 0);
  return 'REQ-' + (Math.max(1000, ...nums) + 1);
}

function addNotification(userId, key, params) {
  const list = DB.notifs();
  list.push({ id: 'n-' + Date.now().toString(36) + randId(), userId, key, params: params || {}, date: nowIso(), read: false });
  DB.saveNotifs(list);
}

/** Text of a stored notification, translated at display time. */
function notifText(n) {
  const p = Object.assign({}, n.params);
  if (p.serviceId) { const s = DB.serviceById(p.serviceId); p.service = s ? svcName(s) : p.serviceId; }
  if (p.status) p.status = t(STATUS_KEY[p.status] || p.status);
  return t(n.key, p);
}

function createRequest(userId, serviceId, data) {
  const created = nowIso();
  const req = {
    id: nextRequestId(), userId, serviceId, status: STATUS.PENDING, data,
    createdAt: created, updatedAt: created, history: [{ status: STATUS.PENDING, date: created, note: '', by: 'system' }]
  };
  const list = DB.requests(); list.push(req); DB.saveRequests(list);
  addNotification(userId, 'notif_submitted', { id: req.id, serviceId });
  return req;
}

function updateRequestStatus(id, newStatus, note) {
  const list = DB.requests();
  const req = list.find(r => r.id === id);
  if (!req || !STATUS_LIST.includes(newStatus)) return null;
  if (req.status === newStatus && !note) return req;
  req.status = newStatus;
  req.updatedAt = nowIso();
  req.history.push({ status: newStatus, date: req.updatedAt, note: note || '', by: 'admin' });
  DB.saveRequests(list);
  addNotification(req.userId, 'notif_status', { id: req.id, serviceId: req.serviceId, status: newStatus });
  return req;
}

const isPendingBucket = r => r.status === STATUS.PENDING || r.status === STATUS.REVIEW;

/** Shared HTML for the tracking / details view of one request. */
function requestDetailsHtml(req, opts) {
  opts = opts || {};
  const svc = DB.serviceById(req.serviceId);
  const owner = DB.userById(req.userId);
  const s = req.status;
  // Timeline: [submitted, review, decision]
  let states;
  if (s === STATUS.PENDING) states = ['done', 'todo', 'todo'];
  else if (s === STATUS.REVIEW) states = ['done', 'current', 'todo'];
  else if (s === STATUS.APPROVED) states = ['done', 'done', 'ok'];
  else states = ['done', 'done', 'bad'];
  const stepIcons = ['check', 'clock', s === STATUS.REJECTED ? 'x' : 'check'];
  const labels = [t('step_submitted'), t('step_review'), s === STATUS.APPROVED || s === STATUS.REJECTED ? t(STATUS_KEY[s]) : t('step_decision')];
  const timeline = states.map((st, i) =>
    `<div class="tl-step ${st}"><div class="tl-dot">${icon(stepIcons[i], 18)}</div><span>${esc(labels[i])}</span></div>`).join('');

  const rows = [];
  if (opts.admin && owner) rows.push([t('f_citizen'), `${owner.fullName} (@${owner.username})`]);
  rows.push([t('f_submitted'), fmtDate(req.createdAt, true)]);
  rows.push([t('th_updated'), fmtDate(req.updatedAt, true)]);
  if (svc) svc.fields.forEach(f => { if (req.data && req.data[f.name] !== undefined && req.data[f.name] !== '') rows.push([L(f.label), displayFieldValue(f, req.data[f.name])]); });
  const details = rows.map(r => `<div><dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd></div>`).join('');

  const history = req.history.slice().reverse().map(h => {
    const first = h.status === STATUS.PENDING && h === req.history[0];
    return `<li>${statusBadge(h.status)} <span>${esc(fmtDate(h.date, true))}</span>` +
      (first ? ` <span>– ${esc(t('hist_submitted'))}</span>` : '') +
      (h.note ? ` <span>– ${esc(t('note'))}: ${esc(h.note)}</span>` : '') + '</li>';
  }).join('');

  let adminForm = '';
  if (opts.admin) {
    adminForm = `
      <form class="modal-section" id="adminStatusForm" novalidate>
        <h4>${esc(t('update_status'))}</h4>
        <div class="form-grid">
          <div class="field"><label for="adm_status">${esc(t('th_status'))}</label>
            <select id="adm_status" name="status">${STATUS_LIST.map(x => `<option value="${esc(x)}"${x === s ? ' selected' : ''}>${esc(t(STATUS_KEY[x]))}</option>`).join('')}</select></div>
          <div class="field"><label for="adm_note">${esc(t('admin_note'))}</label><input id="adm_note" name="note" type="text" maxlength="160"></div>
        </div>
        <div class="modal-actions"><button class="btn btn-primary" type="submit">${esc(t('btn_update'))}</button></div>
      </form>`;
  }

  return `
    <div class="modal-head">
      <span class="ico-box lg">${icon(svc ? svc.icon : 'file', 28)}</span>
      <div><h3 id="modalTitle">${esc(svc ? svcName(svc) : req.serviceId)}</h3>
        <p><span class="id-link">${esc(req.id)}</span> &nbsp;•&nbsp; ${esc(t('st_current'))}: ${statusBadge(s)}</p></div>
    </div>
    <div class="timeline" aria-label="${esc(t('track_modal_title'))}">${timeline}</div>
    <div class="modal-section"><h4>${esc(t('req_details'))}</h4><dl class="detail-list">${details}</dl></div>
    <div class="history"><h4>${esc(t('req_history'))}</h4><ul>${history}</ul></div>
    ${adminForm}`;
}

/* =====================================================================
   10. FORM VALIDATION ENGINE
   A form's rules are {fieldName: (value, form) => errorMessage | null}.
   Errors are shown inside the matching <div class="field" data-field="…">.
   ===================================================================== */
const RE = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  username: /^[A-Za-z0-9_]{4,20}$/,
  name: /^[\p{L}\p{M}\s.'-]+$/u,
  nid: /^\d{10,14}$/,
  phone: /^\+?\d{8,15}$/
};

function getFieldValue(form, name) {
  const el = form.elements[name];
  if (!el) return '';
  if (el.type === 'checkbox') return el.checked ? '1' : '';
  const v = el.value == null ? '' : String(el.value);
  return el.type === 'password' ? v : v.trim();
}

function showFieldResult(form, name, msg) {
  const w = form.querySelector(`[data-field="${name}"]`);
  if (!w) return;
  w.classList.toggle('invalid', !!msg);
  w.classList.toggle('valid', !msg && getFieldValue(form, name) !== '');
  const err = w.querySelector('.error');
  if (err) err.textContent = msg || '';
  const ctl = w.querySelector('input,select,textarea');
  if (ctl) ctl.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function validateOne(form, rules, name) {
  const msg = rules[name](getFieldValue(form, name), form);
  showFieldResult(form, name, msg);
  return msg;
}

/** Validates every field; focuses the first invalid one. Returns true if all valid. */
function validateForm(form, rules) {
  let ok = true, firstBad = null;
  Object.keys(rules).forEach(name => {
    if (validateOne(form, rules, name)) {
      ok = false;
      if (!firstBad) firstBad = form.querySelector(`[data-field="${name}"]`);
    }
  });
  if (firstBad) { const c = firstBad.querySelector('input,select,textarea'); if (c) c.focus(); }
  return ok;
}

/** Live validation after the user touches a field. `deps` re-checks dependent fields. */
function attachLiveValidation(form, rules, deps) {
  deps = deps || {};
  const check = (e, force) => {
    const name = e.target && e.target.name;
    if (!name || !rules[name]) return;
    const w = form.querySelector(`[data-field="${name}"]`);
    if (force || e.target.dataset.touched === '1' || (w && w.classList.contains('invalid'))) {
      validateOne(form, rules, name);
      (deps[name] || []).forEach(d => {
        const dw = form.querySelector(`[data-field="${d}"]`);
        if (dw && (dw.classList.contains('invalid') || dw.classList.contains('valid'))) validateOne(form, rules, d);
      });
    }
  };
  form.addEventListener('focusout', e => { if (e.target.name) { e.target.dataset.touched = '1'; check(e, true); } });
  form.addEventListener('input', e => check(e, false));
  form.addEventListener('change', e => check(e, true));
}

function resetFormState(form) {
  form.reset();
  $$('.field', form).forEach(w => w.classList.remove('invalid', 'valid'));
  $$('.error', form).forEach(e => { e.textContent = ''; });
  $$('[data-touched]', form).forEach(e => delete e.dataset.touched);
}

const passwordRule = v => {
  if (!v) return t('v_required');
  if (v.length < 8 || !/[a-z]/.test(v) || !/[A-Z]/.test(v) || !/\d/.test(v) || !/[^A-Za-z0-9]/.test(v)) return t('v_password');
  return null;
};
const nameRule = v => !v ? t('v_required') : v.length < 3 ? t('v_min_len', { n: 3 }) : !RE.name.test(v) ? t('v_name') : null;
const phoneRule = v => !v ? t('v_required') : !RE.phone.test(v.replace(/[\s\-()]/g, '')) ? t('v_phone') : null;
const nidRule = v => (v && !RE.nid.test(v)) ? t('v_nid') : null;
const addressRule = v => !v ? t('v_required') : v.length < 5 ? t('v_min_len', { n: 5 }) : null;

/** Password strength 0–4. */
function passwordScore(v) {
  if (!v) return 0;
  return [v.length >= 8, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
}

/* =====================================================================
   11. CITIZEN PORTAL (index.html)
   ===================================================================== */
const Portal = {
  ui: { reqSearch: '', reqStatus: '', svcSearch: '' },
  LANDING: ['home', 'about', 'services', 'contact'],

  /* ---------- Navigation / routing (hash based: #home, #login, …) ---------- */
  showView(name) {
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
    $$('.reveal', $('#view-' + name)).forEach(el => Portal.observe(el));
  },

  route() {
    const hash = (location.hash || '#home').slice(1);
    const user = currentUser();
    closeNavMenu();

    if (Portal.LANDING.includes(hash)) {
      Portal.showView('home');
      requestAnimationFrame(() => {
        if (hash === 'home') window.scrollTo({ top: 0 });
        else { const el = document.getElementById(hash); if (el) el.scrollIntoView(); }
      });
    } else if (hash === 'login' || hash === 'register') {
      if (user) { location.hash = '#dashboard'; return; }
      Portal.showView(hash);
      window.scrollTo({ top: 0 });
    } else if (hash === 'dashboard') {
      if (!user) { toast(t('login_required'), 'error'); location.hash = '#login'; return; }
      if (user.role === 'admin') { location.href = 'admin.html'; return; }
      Portal.showView('dashboard');
      Portal.renderDashboard();
      window.scrollTo({ top: 0 });
    } else {
      location.hash = '#home'; return;
    }
    Portal.updateNav(hash);
  },

  updateNav(hash) {
    const user = currentUser();
    $('#guestActions').hidden = !!user;
    $('#userActions').hidden = !user;
    const dash = $('#navDashboard');
    if (user && user.role === 'admin') { dash.href = 'admin.html'; dash.textContent = t('admin_panel'); }
    else { dash.href = '#dashboard'; dash.textContent = t('nav_dashboard'); }
    $$('.nav-links a').forEach(a => a.classList.toggle('active', a.dataset.route === hash));
  },

  /** Highlights the nav link of the landing-page section currently in view. */
  scrollSpy() {
    if ($('#view-home').hidden) return;
    let current = 'home';
    Portal.LANDING.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 120) current = id;
    });
    $$('.nav-links a').forEach(a => a.classList.toggle('active', a.dataset.route === current));
  },

  observer: null,
  observe(el) {
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    if (!Portal.observer) {
      Portal.observer = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); Portal.observer.unobserve(e.target); } });
      }, { threshold: 0.12 });
    }
    if (!el.classList.contains('in')) Portal.observer.observe(el);
  },

  /* ---------- Services cards (landing page + dashboard) ---------- */
  serviceCardsHtml(filter, showCount) {
    const q = (filter || '').trim().toLowerCase();
    const user = currentUser();
    const list = SERVICES.filter(s => !q || svcName(s).toLowerCase().includes(q) || svcDesc(s).toLowerCase().includes(q));
    if (!list.length) return `<div class="empty" style="grid-column:1/-1">${esc(t('no_services'))}</div>`;
    return list.map(s => {
      let count = '';
      if (showCount && user) {
        const n = DB.requests().filter(r => r.userId === user.id && r.serviceId === s.id).length;
        count = `<p class="svc-count">${esc(t('th_requests'))}: ${n}</p>`;
      }
      return `<article class="service-card">
        <span class="ico-box">${icon(s.icon, 26)}</span>
        <h3>${esc(svcName(s))}</h3>
        <p>${esc(svcDesc(s))}</p>${count}
        <button class="btn btn-primary btn-sm" type="button" data-open-service="${s.id}">${esc(t('btn_request_service'))}</button>
      </article>`;
    }).join('');
  },

  renderServices() {
    $('#servicesGrid').innerHTML = Portal.serviceCardsHtml('', false);
    $$('#servicesGrid .service-card').forEach(c => c.classList.add('reveal'));
    $$('#servicesGrid .reveal').forEach(el => Portal.observe(el));
  },

  /** Opens the request form of a service (login required). */
  openService(id) {
    const user = currentUser();
    const svc = DB.serviceById(id);
    if (!svc) return;
    if (!user) {
      state.pendingService = id;
      toast(t('login_to_request'), 'error');
      location.hash = '#login';
      return;
    }
    const mine = DB.requests().filter(r => r.userId === user.id && r.serviceId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const myList = mine.length
      ? `<div class="mini-list">${mine.map(r => `<button type="button" class="mini-item" data-track="${esc(r.id)}"><span class="id-link">${esc(r.id)}</span><span>${esc(fmtDate(r.createdAt))}</span>${statusBadge(r.status)}</button>`).join('')}</div>`
      : `<p class="muted">${esc(t('svc_none_yet'))}</p>`;

    const body = openModal(`
      <div class="modal-head">
        <span class="ico-box lg">${icon(svc.icon, 28)}</span>
        <div><h3 id="modalTitle">${esc(svcName(svc))}</h3><p>${esc(svcDesc(svc))}</p></div>
      </div>
      <form id="serviceForm" novalidate>
        <div class="form-grid">${svc.fields.map(f => renderFieldHtml(f, 'sf')).join('')}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" data-close-modal>${esc(t('btn_cancel'))}</button>
          <button type="submit" class="btn btn-primary">${esc(t('btn_submit_request'))}</button>
        </div>
      </form>
      <div class="modal-section"><h4>${esc(t('svc_your_requests'))}</h4>${myList}</div>`);

    const form = $('#serviceForm', body);
    const rules = rulesFromFields(svc.fields);
    attachLiveValidation(form, rules);
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!validateForm(form, rules)) return;
      const data = {};
      svc.fields.forEach(f => { data[f.name] = getFieldValue(form, f.name); });
      const req = createRequest(user.id, svc.id, data);
      toast(t('req_submitted_t'));
      Portal.refreshDashboardIfVisible();
      // Success screen inside the modal
      $('#modalBody').innerHTML = `
        <div class="success-box">
          <span class="ico-box">${icon('check', 36)}</span>
          <h3 id="modalTitle">${esc(t('req_submitted_t'))}</h3>
          <p class="muted">${esc(t('req_submitted_d'))}</p>
          <div>${esc(t('req_id_label'))}<br><span class="req-id">${esc(req.id)}</span></div>
          <div>${statusBadge(req.status)}</div>
          <div class="modal-actions" style="justify-content:center">
            <button type="button" class="btn btn-outline" data-close-modal>${esc(t('btn_close'))}</button>
            <button type="button" class="btn btn-primary" data-track="${esc(req.id)}">${esc(t('btn_track_now'))}</button>
          </div>
        </div>`;
    });
  },

  openTrack(id) {
    const user = currentUser();
    const req = DB.requests().find(r => r.id === id && user && r.userId === user.id);
    if (!req) return false;
    openModal(requestDetailsHtml(req, {}) +
      `<div class="modal-actions"><button type="button" class="btn btn-outline" data-close-modal>${esc(t('btn_close'))}</button></div>`);
    return true;
  },

  /* ---------- Citizen dashboard ---------- */
  refreshDashboardIfVisible() { if (!$('#view-dashboard').hidden) Portal.renderDashboard(); },

  renderDashboard() {
    const user = currentUser();
    if (!user) return;
    const initial = (user.fullName || user.username).trim().charAt(0).toUpperCase();
    $('#dashAvatar').textContent = initial;
    $('#dashSideName').textContent = user.fullName;
    $('#dashSideUser').textContent = '@' + user.username;
    Portal.renderOverview(user);
    $('#dashServicesGrid').innerHTML = Portal.serviceCardsHtml(Portal.ui.svcSearch, true);
    Portal.renderRequestsTab(user);
    Portal.renderNotifications(user);
    Portal.renderProfile(user);
    Portal.updateBadge(user);
    Portal.openTab(state.tab, true);
  },

  openTab(tab, keepScroll) {
    state.tab = tab;
    $$('#dashMenu .dash-link').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('#view-dashboard .dash-panel').forEach(p => { p.hidden = p.id !== 'tab-' + tab; });
    if (!keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  updateBadge(user) {
    const unread = DB.notifs().filter(n => n.userId === user.id && !n.read).length;
    const b = $('#notifBadge');
    b.textContent = unread; b.hidden = unread === 0;
  },

  userRequests(user) {
    return DB.requests().filter(r => r.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  renderOverview(user) {
    const reqs = Portal.userRequests(user);
    const count = f => reqs.filter(f).length;
    $('#welcomeTitle').textContent = t('welcome', { name: user.fullName.split(' ')[0] });
    $('#welcomeSub').textContent = t('welcome_sub', { date: fmtDate(nowIso()) });
    const tile = (cls, ic, n, key) => `<div class="stat ${cls}"><span class="ico-box">${icon(ic, 24)}</span><div><strong>${n}</strong><span class="lbl">${esc(t(key))}</span></div></div>`;
    $('#citizenStats').innerHTML =
      tile('', 'file', reqs.length, 'stat_total') +
      tile('s-pending', 'clock', count(isPendingBucket), 'stat_inprogress') +
      tile('s-approved', 'check', count(r => r.status === STATUS.APPROVED), 'stat_approved') +
      tile('s-rejected', 'x', count(r => r.status === STATUS.REJECTED), 'stat_rejected');

    // Recent requests (last 4)
    const recent = reqs.slice(0, 4);
    $('#recentRequests').innerHTML = recent.length
      ? `<div class="mini-list">${recent.map(r => {
        const s = DB.serviceById(r.serviceId);
        return `<button type="button" class="mini-item" data-track="${esc(r.id)}"><span><span class="id-link">${esc(r.id)}</span> · ${esc(s ? svcName(s) : r.serviceId)}</span>${statusBadge(r.status)}</button>`;
      }).join('')}</div>` : emptyState('no_requests');

    // Latest notifications (last 3)
    const notifs = DB.notifs().filter(n => n.userId === user.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    $('#recentNotifs').innerHTML = notifs.length ? notifs.map(Portal.notifHtml).join('') : emptyState('no_notifs');

    // Quick services (all 8)
    $('#quickServices').innerHTML = SERVICES.map(s =>
      `<button type="button" class="quick-tile" data-open-service="${s.id}"><span class="ico-box">${icon(s.icon, 24)}</span>${esc(svcName(s))}</button>`).join('');
  },

  notifHtml(n) {
    return `<div class="notif-item${n.read ? '' : ' unread'}"><span class="dot"></span><div class="grow"><p>${esc(notifText(n))}</p><small>${esc(fmtDate(n.date, true))}</small></div></div>`;
  },

  renderRequestsTab(user) {
    fillSelect($('#reqStatusFilter'), [{ value: '', label: t('all_statuses') }].concat(STATUS_LIST.map(s => ({ value: s, label: t(STATUS_KEY[s]) }))), Portal.ui.reqStatus);
    const q = Portal.ui.reqSearch.trim().toLowerCase();
    const list = Portal.userRequests(user).filter(r => {
      const s = DB.serviceById(r.serviceId);
      const name = s ? svcName(s).toLowerCase() : '';
      return (!q || r.id.toLowerCase().includes(q) || name.includes(q)) && (!Portal.ui.reqStatus || r.status === Portal.ui.reqStatus);
    });
    $('#myRequests').innerHTML = list.length ? `<table><thead><tr>
        <th>${esc(t('th_id'))}</th><th>${esc(t('th_service'))}</th><th>${esc(t('th_date'))}</th><th>${esc(t('th_status'))}</th><th>${esc(t('th_actions'))}</th>
      </tr></thead><tbody>${list.map(r => {
      const s = DB.serviceById(r.serviceId);
      return `<tr><td><span class="id-link">${esc(r.id)}</span></td><td>${esc(s ? svcName(s) : r.serviceId)}</td>
          <td>${esc(fmtDate(r.createdAt))}</td><td>${statusBadge(r.status)}</td>
          <td><div class="actions"><button class="btn btn-outline btn-sm" type="button" data-track="${esc(r.id)}">${icon('search', 14)} ${esc(t('btn_track_short'))}</button></div></td></tr>`;
    }).join('')}</tbody></table>` : emptyState('no_requests');
  },

  renderNotifications(user) {
    const list = DB.notifs().filter(n => n.userId === user.id).sort((a, b) => b.date.localeCompare(a.date));
    $('#notifList').innerHTML = list.length ? list.map(Portal.notifHtml).join('') : emptyState('no_notifs');
  },

  renderProfile(user) {
    $('#profileAvatar').textContent = user.fullName.trim().charAt(0).toUpperCase();
    $('#profileName').textContent = user.fullName;
    $('#profileUser').textContent = '@' + user.username;
    const natKey = 'nat_' + user.nationality.toLowerCase();
    const rows = [
      [t('f_email'), user.email], [t('f_phone'), user.phone],
      [t('f_gender'), user.gender === 'male' ? t('gender_male') : t('gender_female')],
      [t('f_nationality'), I18N.en[natKey] ? t(natKey) : user.nationality],
      [t('f_nid'), user.nationalId || '—'], [t('f_address'), user.address], [t('f_registered'), fmtDate(user.createdAt)]
    ];
    $('#profileDetails').innerHTML = rows.map(r => `<div><dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd></div>`).join('');
    const f = $('#profileForm');
    f.elements.fullName.value = user.fullName; f.elements.email.value = user.email; f.elements.phone.value = user.phone;
    f.elements.nationalId.value = user.nationalId || ''; f.elements.address.value = user.address;
  },

  /* ---------- Forgot-password demo modal ---------- */
  openForgot() {
    const body = openModal(`
      <div class="modal-head"><span class="ico-box lg">${icon('mail', 28)}</span>
        <div><h3 id="modalTitle">${esc(t('fp_title'))}</h3><p>${esc(t('fp_sub'))}</p></div></div>
      <form id="forgotForm" novalidate>
        <div class="field" data-field="email"><label for="fpEmail">${esc(t('f_email'))}</label><input id="fpEmail" name="email" type="email" dir="ltr"><small class="error"></small></div>
        <div class="field" data-field="password"><label for="fpPw">${esc(t('f_new_pw'))}</label><input id="fpPw" name="password" type="password" dir="ltr" autocomplete="new-password"><small class="error"></small></div>
        <div class="field" data-field="confirmPassword"><label for="fpPw2">${esc(t('f_confirm'))}</label><input id="fpPw2" name="confirmPassword" type="password" dir="ltr" autocomplete="new-password"><small class="error"></small></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" data-close-modal>${esc(t('btn_cancel'))}</button>
          <button type="submit" class="btn btn-primary">${esc(t('btn_reset_pw'))}</button>
        </div>
      </form>`);
    const form = $('#forgotForm', body);
    const rules = {
      email: v => !v ? t('v_required') : !RE.email.test(v) ? t('v_email') : null,
      password: passwordRule,
      confirmPassword: (v, f) => !v ? t('v_required') : v !== f.elements.password.value ? t('v_confirm') : null
    };
    attachLiveValidation(form, rules, { password: ['confirmPassword'] });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!validateForm(form, rules)) return;
      const users = DB.users();
      const u = users.find(x => x.email.toLowerCase() === getFieldValue(form, 'email').toLowerCase());
      if (!u) { showFieldResult(form, 'email', t('fp_notfound')); return; }
      u.passwordHash = hashPassword(form.elements.password.value);
      DB.saveUsers(users);
      closeModal();
      toast(t('fp_done'));
    });
  },

  /* ---------- Page wiring (runs once) ---------- */
  init() {
    // Landing content
    Portal.renderServices();
    $('#year').textContent = new Date().getFullYear();

    /* Registration form */
    const reg = $('#registerForm');
    const regRules = {
      fullName: nameRule,
      username: v => !v ? t('v_required') : !RE.username.test(v) ? t('v_username')
        : DB.users().some(u => u.username.toLowerCase() === v.toLowerCase()) ? t('v_username_taken') : null,
      email: v => !v ? t('v_required') : !RE.email.test(v) ? t('v_email')
        : DB.users().some(u => u.email.toLowerCase() === v.toLowerCase()) ? t('v_email_taken') : null,
      password: passwordRule,
      confirmPassword: (v, f) => !v ? t('v_required') : v !== f.elements.password.value ? t('v_confirm') : null,
      gender: v => v ? null : t('v_gender'),
      nationality: v => v ? null : t('v_nationality'),
      nationalId: nidRule,
      phone: phoneRule,
      address: addressRule
    };
    attachLiveValidation(reg, regRules, { password: ['confirmPassword'] });
    reg.elements.password.addEventListener('input', e => {
      const score = passwordScore(e.target.value);
      $('#pwStrength').dataset.level = score;
      $('#pwStrengthText').textContent = score ? t('pw_level_' + score) : t('h_password');
    });
    reg.addEventListener('submit', e => {
      e.preventDefault();
      if (!validateForm(reg, regRules)) return;
      const f = n => getFieldValue(reg, n);
      const user = {
        id: 'u-' + Date.now().toString(36) + randId(), fullName: f('fullName'), username: f('username'), email: f('email').toLowerCase(),
        passwordHash: hashPassword(reg.elements.password.value), gender: f('gender'), nationality: f('nationality'),
        nationalId: f('nationalId'), phone: f('phone'), address: f('address'), role: 'citizen', status: 'active', createdAt: nowIso()
      };
      const users = DB.users(); users.push(user); DB.saveUsers(users);
      addNotification(user.id, 'notif_welcome', { name: user.fullName });
      resetFormState(reg);
      $('#pwStrength').dataset.level = 0;
      $('#pwStrengthText').textContent = t('h_password');
      $('#lUsername').value = user.username; $('#lPassword').value = '';
      toast(t('reg_success'));
      location.hash = '#login';
    });

    /* Login form */
    const login = $('#loginForm');
    const loginRules = {
      username: v => v ? null : t('v_required'),
      password: v => v ? null : t('v_required')
    };
    attachLiveValidation(login, loginRules);
    const remembered = (() => { try { return localStorage.getItem(KEYS.remembered) || ''; } catch (e) { return ''; } })();
    if (remembered) { login.elements.username.value = remembered; login.elements.remember.checked = true; }
    login.addEventListener('submit', e => {
      e.preventDefault();
      const alertBox = $('#loginAlert');
      alertBox.hidden = true;
      if (!validateForm(login, loginRules)) return;
      const remember = login.elements.remember.checked;
      const res = attemptLogin(login.elements.username.value, login.elements.password.value, remember);
      if (!res.ok) { alertBox.textContent = t(res.err); alertBox.hidden = false; return; }
      try {
        if (remember) localStorage.setItem(KEYS.remembered, res.user.username); else localStorage.removeItem(KEYS.remembered);
      } catch (err) { /* ignore */ }
      login.elements.password.value = '';
      toast(t('login_ok', { name: res.user.fullName.split(' ')[0] }));
      if (res.user.role === 'admin') { location.href = 'admin.html'; return; }
      state.tab = 'overview';
      location.hash = '#dashboard'; // triggers Portal.route() through the hashchange event
      if (state.pendingService) { const id = state.pendingService; state.pendingService = null; setTimeout(() => Portal.openService(id), 250); }
    });
    $('#forgotLink').addEventListener('click', e => { e.preventDefault(); Portal.openForgot(); });
    $$('[data-fill]').forEach(b => b.addEventListener('click', () => {
      const [u, p] = b.dataset.fill.split('|');
      login.elements.username.value = u; login.elements.password.value = p;
      $('#loginAlert').hidden = true;
      $$('.field', login).forEach(w => w.classList.remove('invalid'));
    }));

    /* Contact form */
    const contact = $('#contactForm');
    const contactRules = {
      name: v => !v ? t('v_required') : v.length < 3 ? t('v_min_len', { n: 3 }) : null,
      email: v => !v ? t('v_required') : !RE.email.test(v) ? t('v_email') : null,
      subject: v => !v ? t('v_required') : v.length < 3 ? t('v_min_len', { n: 3 }) : null,
      message: v => !v ? t('v_required') : v.length < 10 ? t('v_min_len', { n: 10 }) : null
    };
    attachLiveValidation(contact, contactRules);
    contact.addEventListener('submit', e => {
      e.preventDefault();
      if (!validateForm(contact, contactRules)) return;
      const msgs = store.get(KEYS.messages, []);
      msgs.push({ id: 'm-' + randId(), name: getFieldValue(contact, 'name'), email: getFieldValue(contact, 'email'),
        subject: getFieldValue(contact, 'subject'), message: getFieldValue(contact, 'message'), date: nowIso() });
      store.set(KEYS.messages, msgs);
      resetFormState(contact);
      toast(t('contact_sent'));
    });

    /* Dashboard: tabs, logout, filters, track form, profile forms */
    $$('#dashMenu .dash-link').forEach(b => b.addEventListener('click', () => Portal.openTab(b.dataset.tab)));
    const logout = () => {
      clearSession(); state.tab = 'overview';
      toast(t('logout_ok'));
      if (location.hash === '#home') Portal.route(); else location.hash = '#home';
      Portal.updateNav('home');
    };
    $('#dashLogout').addEventListener('click', logout);
    $('#navLogout').addEventListener('click', logout);

    $('#svcSearch').addEventListener('input', e => {
      Portal.ui.svcSearch = e.target.value;
      $('#dashServicesGrid').innerHTML = Portal.serviceCardsHtml(Portal.ui.svcSearch, true);
    });
    $('#reqSearch').addEventListener('input', e => { Portal.ui.reqSearch = e.target.value; Portal.renderRequestsTab(currentUser()); });
    $('#reqStatusFilter').addEventListener('change', e => { Portal.ui.reqStatus = e.target.value; Portal.renderRequestsTab(currentUser()); });

    $('#trackForm').addEventListener('submit', e => {
      e.preventDefault();
      const input = $('#trackInput'), err = $('#trackError');
      const id = input.value.trim().toUpperCase();
      err.textContent = '';
      if (!id) { err.textContent = t('track_enter'); return; }
      if (!Portal.openTrack(id)) err.textContent = t('track_not_found');
    });

    $('#markAllRead').addEventListener('click', () => {
      const user = currentUser(); if (!user) return;
      const list = DB.notifs(); list.forEach(n => { if (n.userId === user.id) n.read = true; });
      DB.saveNotifs(list);
      Portal.renderNotifications(user); Portal.renderOverview(user); Portal.updateBadge(user);
    });

    // Profile edit
    const pf = $('#profileForm');
    const profileRules = {
      fullName: nameRule,
      email: (v, f) => { const me = currentUser(); return !v ? t('v_required') : !RE.email.test(v) ? t('v_email')
        : DB.users().some(u => u.id !== (me && me.id) && u.email.toLowerCase() === v.toLowerCase()) ? t('v_email_taken') : null; },
      phone: phoneRule, nationalId: nidRule, address: addressRule
    };
    attachLiveValidation(pf, profileRules);
    pf.addEventListener('submit', e => {
      e.preventDefault();
      if (!validateForm(pf, profileRules)) return;
      const me = currentUser(); if (!me) return;
      const users = DB.users(); const u = users.find(x => x.id === me.id);
      u.fullName = getFieldValue(pf, 'fullName'); u.email = getFieldValue(pf, 'email').toLowerCase();
      u.phone = getFieldValue(pf, 'phone'); u.nationalId = getFieldValue(pf, 'nationalId'); u.address = getFieldValue(pf, 'address');
      DB.saveUsers(users);
      toast(t('profile_saved'));
      Portal.renderDashboard();
    });

    // Change password
    const pw = $('#passwordForm');
    const pwRules = {
      current: v => v ? null : t('v_required'),
      password: passwordRule,
      confirmPassword: (v, f) => !v ? t('v_required') : v !== f.elements.password.value ? t('v_confirm') : null
    };
    attachLiveValidation(pw, pwRules, { password: ['confirmPassword'] });
    pw.addEventListener('submit', e => {
      e.preventDefault();
      if (!validateForm(pw, pwRules)) return;
      const me = currentUser(); if (!me) return;
      if (me.passwordHash !== hashPassword(pw.elements.current.value)) { showFieldResult(pw, 'current', t('pw_wrong')); return; }
      const users = DB.users(); users.find(x => x.id === me.id).passwordHash = hashPassword(pw.elements.password.value);
      DB.saveUsers(users);
      resetFormState(pw);
      toast(t('password_changed'));
    });

    // Dashboard shortcuts
    document.addEventListener('click', e => {
      const g = e.target.closest('[data-goto-tab]');
      if (g) Portal.openTab(g.dataset.gotoTab);
    });

    window.addEventListener('hashchange', Portal.route);
    window.addEventListener('scroll', Portal.scrollSpy, { passive: true });
  }
};

/* =====================================================================
   12. ADMIN PANEL (admin.html)
   ===================================================================== */
const Admin = {
  ui: { userSearch: '', userNat: '', userStatus: '', reqSearch: '', reqStatus: '', reqService: '' },

  init() {
    const me = currentUser();
    // Guard: only administrators may see this page.
    if (!me || me.role !== 'admin') { location.replace('index.html#login'); return false; }
    Admin.me = me;
    $('#adminAvatar').textContent = me.fullName.charAt(0).toUpperCase();
    $('#adminName').textContent = me.fullName;

    $$('#adminMenu .dash-link').forEach(b => b.addEventListener('click', () => Admin.openTab(b.dataset.tab)));
    document.addEventListener('click', e => { const g = e.target.closest('[data-goto-tab]'); if (g) Admin.openTab(g.dataset.gotoTab); });
    $('#adminLogout').addEventListener('click', () => { clearSession(); location.href = 'index.html#home'; });

    $('#userSearch').addEventListener('input', e => { Admin.ui.userSearch = e.target.value; Admin.renderUsers(); });
    $('#userNatFilter').addEventListener('change', e => { Admin.ui.userNat = e.target.value; Admin.renderUsers(); });
    $('#userStatusFilter').addEventListener('change', e => { Admin.ui.userStatus = e.target.value; Admin.renderUsers(); });
    $('#reqSearch').addEventListener('input', e => { Admin.ui.reqSearch = e.target.value; Admin.renderRequests(); });
    $('#reqStatusFilter').addEventListener('change', e => { Admin.ui.reqStatus = e.target.value; Admin.renderRequests(); });
    $('#reqServiceFilter').addEventListener('change', e => { Admin.ui.reqService = e.target.value; Admin.renderRequests(); });

    $('#resetDemo').addEventListener('click', async () => {
      if (!await confirmDialog('confirm_reset_t', 'confirm_reset')) return;
      seedData(true);
      Admin.ui = { userSearch: '', userNat: '', userStatus: '', reqSearch: '', reqStatus: '', reqService: '' };
      ['#userSearch', '#reqSearch'].forEach(s => { $(s).value = ''; });
      Admin.renderAll();
      toast(t('reset_done'));
    });

    // Delegated actions inside the tables
    document.addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'view-request') Admin.openRequest(id);
      else if (action === 'update-request') {
        const sel = $(`select[data-status-for="${id}"]`);
        Admin.applyStatus(id, sel.value, '');
      }
      else if (action === 'view-user') Admin.openUser(id);
      else if (action === 'toggle-user') await Admin.toggleUser(id);
      else if (action === 'delete-user') await Admin.deleteUser(id);
    });
    // Enable the inline "Update" button only when the select actually changed
    document.addEventListener('change', e => {
      const sel = e.target.closest('select[data-status-for]');
      if (!sel) return;
      const btn = $(`button[data-action="update-request"][data-id="${sel.dataset.statusFor}"]`);
      if (btn) btn.disabled = sel.value === sel.dataset.current;
    });
    Admin.renderAll();
    return true;
  },

  openTab(tab, keepScroll) {
    state.tab = tab;
    $$('#adminMenu .dash-link').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.dash-panel').forEach(p => { p.hidden = p.id !== 'tab-' + tab; });
    if (!keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderAll() {
    $('#adminWelcome').textContent = t('admin_welcome', { name: Admin.me.fullName });
    Admin.renderStats(); Admin.renderCharts(); Admin.renderRecent();
    Admin.renderFilters(); Admin.renderUsers(); Admin.renderRequests();
    Admin.openTab(state.tab, true);
  },

  renderStats() {
    const users = DB.users().filter(u => u.role !== 'admin'), reqs = DB.requests();
    const tile = (cls, ic, n, key) => `<div class="stat ${cls}"><span class="ico-box">${icon(ic, 24)}</span><div><strong>${n}</strong><span class="lbl">${esc(t(key))}</span></div></div>`;
    $('#adminStats').innerHTML =
      tile('', 'users', users.length, 'adm_users') +
      tile('s-review', 'file', reqs.length, 'adm_requests') +
      tile('s-pending', 'clock', reqs.filter(isPendingBucket).length, 'adm_pending') +
      tile('s-approved', 'check', reqs.filter(r => r.status === STATUS.APPROVED).length, 'adm_approved') +
      tile('s-rejected', 'x', reqs.filter(r => r.status === STATUS.REJECTED).length, 'adm_rejected');
  },

  bars(items) {
    const max = Math.max(1, ...items.map(i => i.value));
    return items.map(i => `<div class="bar-row"><span>${esc(i.label)}</span>
      <div class="bar-track"><div class="bar-fill ${i.cls || ''}" style="width:${Math.round(i.value / max * 100)}%"></div></div><b>${i.value}</b></div>`).join('');
  },

  renderCharts() {
    const reqs = DB.requests();
    $('#chartStatus').innerHTML = Admin.bars(STATUS_LIST.map(s => ({ label: t(STATUS_KEY[s]), value: reqs.filter(r => r.status === s).length, cls: STATUS_CLASS[s] })));
    $('#chartService').innerHTML = Admin.bars(SERVICES.map(s => ({ label: svcName(s), value: reqs.filter(r => r.serviceId === s.id).length })));
  },

  renderRecent() {
    const list = DB.requests().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    $('#adminRecent').innerHTML = list.length ? `<table><thead><tr><th>${esc(t('th_id'))}</th><th>${esc(t('th_citizen'))}</th><th>${esc(t('th_service'))}</th><th>${esc(t('th_date'))}</th><th>${esc(t('th_status'))}</th></tr></thead><tbody>` +
      list.map(r => {
        const u = DB.userById(r.userId), s = DB.serviceById(r.serviceId);
        return `<tr><td><span class="id-link">${esc(r.id)}</span></td><td>${esc(u ? u.fullName : '—')}</td><td>${esc(s ? svcName(s) : r.serviceId)}</td><td>${esc(fmtDate(r.createdAt))}</td><td>${statusBadge(r.status)}</td></tr>`;
      }).join('') + '</tbody></table>' : emptyState('no_requests');
  },

  renderFilters() {
    const nats = Array.from(new Set(DB.users().map(u => u.nationality))).sort();
    fillSelect($('#userNatFilter'), [{ value: '', label: t('all_nationalities') }].concat(nats.map(n => ({ value: n, label: Admin.natLabel(n) }))), Admin.ui.userNat);
    fillSelect($('#userStatusFilter'), [{ value: '', label: t('all_account_status') }, { value: 'active', label: t('acc_active') }, { value: 'suspended', label: t('acc_suspended') }], Admin.ui.userStatus);
    fillSelect($('#reqStatusFilter'), [{ value: '', label: t('all_statuses') }].concat(STATUS_LIST.map(s => ({ value: s, label: t(STATUS_KEY[s]) }))), Admin.ui.reqStatus);
    fillSelect($('#reqServiceFilter'), [{ value: '', label: t('all_services') }].concat(SERVICES.map(s => ({ value: s.id, label: svcName(s) }))), Admin.ui.reqService);
  },

  natLabel(n) { const k = 'nat_' + String(n).toLowerCase(); return I18N.en[k] ? t(k) : n; },

  /* ----- Users management ----- */
  renderUsers() {
    const q = Admin.ui.userSearch.trim().toLowerCase();
    const reqs = DB.requests();
    const list = DB.users().filter(u =>
      (!q || [u.fullName, u.username, u.email, u.phone].some(x => String(x).toLowerCase().includes(q))) &&
      (!Admin.ui.userNat || u.nationality === Admin.ui.userNat) &&
      (!Admin.ui.userStatus || u.status === Admin.ui.userStatus));
    $('#usersTable').innerHTML = list.length ? `<table><thead><tr>
      <th>${esc(t('th_name'))}</th><th>${esc(t('th_username'))}</th><th>${esc(t('th_email'))}</th><th>${esc(t('th_nationality'))}</th>
      <th>${esc(t('th_registered'))}</th><th>${esc(t('th_requests'))}</th><th>${esc(t('th_status'))}</th><th>${esc(t('th_actions'))}</th></tr></thead><tbody>` +
      list.map(u => {
        const isAdmin = u.role === 'admin';
        const statusCell = isAdmin ? `<span class="status role">${esc(t('role_admin'))}</span>`
          : `<span class="status ${u.status}">${esc(t(u.status === 'active' ? 'acc_active' : 'acc_suspended'))}</span>`;
        const actions = `<button class="btn btn-outline btn-sm" type="button" data-action="view-user" data-id="${esc(u.id)}">${esc(t('btn_view'))}</button>` +
          (isAdmin ? '' : `<button class="btn btn-outline btn-sm" type="button" data-action="toggle-user" data-id="${esc(u.id)}">${esc(t(u.status === 'active' ? 'btn_suspend' : 'btn_activate'))}</button>
            <button class="btn btn-danger btn-sm" type="button" data-action="delete-user" data-id="${esc(u.id)}">${esc(t('btn_delete'))}</button>`);
        return `<tr><td><strong>${esc(u.fullName)}</strong></td><td dir="ltr" class="ltr-text">@${esc(u.username)}</td><td dir="ltr" class="ltr-text">${esc(u.email)}</td>
          <td>${esc(Admin.natLabel(u.nationality))}</td><td>${esc(fmtDate(u.createdAt))}</td><td>${reqs.filter(r => r.userId === u.id).length}</td>
          <td>${statusCell}</td><td><div class="actions">${actions}</div></td></tr>`;
      }).join('') + '</tbody></table>' : emptyState('no_users');
  },

  openUser(id) {
    const u = DB.userById(id); if (!u) return;
    const reqs = DB.requests().filter(r => r.userId === id);
    const rows = [
      [t('f_email'), u.email], [t('f_phone'), u.phone], [t('f_gender_label'), u.gender === 'male' ? t('male') : t('female')],
      [t('f_nationality'), Admin.natLabel(u.nationality)], [t('f_nid'), u.nationalId || '—'], [t('f_address'), u.address],
      [t('f_role'), u.role === 'admin' ? t('role_admin') : t('role_citizen')],
      [t('f_account_status'), t(u.status === 'active' ? 'acc_active' : 'acc_suspended')],
      [t('f_registered'), fmtDate(u.createdAt, true)], [t('th_requests'), String(reqs.length)]
    ];
    openModal(`<div class="modal-head"><span class="avatar">${esc(u.fullName.charAt(0).toUpperCase())}</span>
      <div><h3 id="modalTitle">${esc(u.fullName)}</h3><p>@${esc(u.username)} · ${esc(t('user_details'))}</p></div></div>
      <dl class="detail-list">${rows.map(r => `<div><dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd></div>`).join('')}</dl>
      <div class="modal-actions"><button class="btn btn-outline" type="button" data-close-modal>${esc(t('btn_close'))}</button></div>`);
  },

  async toggleUser(id) {
    const users = DB.users(); const u = users.find(x => x.id === id);
    if (!u) return;
    if (u.role === 'admin') { toast(t('cannot_modify_admin'), 'error'); return; }
    if (!await confirmDialog('confirm_suspend_t', 'confirm_suspend', { name: u.fullName })) return;
    u.status = u.status === 'active' ? 'suspended' : 'active';
    DB.saveUsers(users);
    toast(t('user_status_changed'));
    Admin.renderAll();
  },

  async deleteUser(id) {
    const u = DB.userById(id);
    if (!u) return;
    if (u.role === 'admin') { toast(t('cannot_modify_admin'), 'error'); return; }
    if (!await confirmDialog('confirm_delete_user_t', 'confirm_delete_user', { name: u.fullName })) return;
    DB.saveUsers(DB.users().filter(x => x.id !== id));
    DB.saveRequests(DB.requests().filter(r => r.userId !== id));
    DB.saveNotifs(DB.notifs().filter(n => n.userId !== id));
    toast(t('user_deleted'));
    Admin.renderAll();
  },

  /* ----- Service requests management ----- */
  renderRequests() {
    const q = Admin.ui.reqSearch.trim().toLowerCase();
    const list = DB.requests().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter(r => {
      const u = DB.userById(r.userId), s = DB.serviceById(r.serviceId);
      const hay = [r.id, u ? u.fullName : '', u ? u.username : '', s ? svcName(s) : ''].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!Admin.ui.reqStatus || r.status === Admin.ui.reqStatus) && (!Admin.ui.reqService || r.serviceId === Admin.ui.reqService);
    });
    $('#requestsTable').innerHTML = list.length ? `<table><thead><tr>
      <th>${esc(t('th_id'))}</th><th>${esc(t('th_citizen'))}</th><th>${esc(t('th_service'))}</th><th>${esc(t('th_date'))}</th><th>${esc(t('th_status'))}</th><th>${esc(t('th_actions'))}</th></tr></thead><tbody>` +
      list.map(r => {
        const u = DB.userById(r.userId), s = DB.serviceById(r.serviceId);
        const options = STATUS_LIST.map(x => `<option value="${esc(x)}"${x === r.status ? ' selected' : ''}>${esc(t(STATUS_KEY[x]))}</option>`).join('');
        return `<tr><td><span class="id-link">${esc(r.id)}</span></td><td>${esc(u ? u.fullName : '—')}</td><td>${esc(s ? svcName(s) : r.serviceId)}</td>
          <td>${esc(fmtDate(r.createdAt))}</td><td>${statusBadge(r.status)}</td>
          <td><div class="actions">
            <select class="status-select" data-status-for="${esc(r.id)}" data-current="${esc(r.status)}" aria-label="${esc(t('update_status'))}">${options}</select>
            <button class="btn btn-primary btn-sm" type="button" data-action="update-request" data-id="${esc(r.id)}" disabled>${esc(t('btn_update'))}</button>
            <button class="btn btn-outline btn-sm" type="button" data-action="view-request" data-id="${esc(r.id)}">${esc(t('btn_view'))}</button>
          </div></td></tr>`;
      }).join('') + '</tbody></table>' : emptyState('no_requests');
  },

  applyStatus(id, status, note) {
    const req = updateRequestStatus(id, status, note);
    if (!req) return;
    toast(t('status_updated', { id, status: t(STATUS_KEY[status]) }));
    Admin.renderAll();
    return req;
  },

  openRequest(id) {
    const req = DB.requests().find(r => r.id === id);
    if (!req) return;
    const body = openModal(requestDetailsHtml(req, { admin: true }));
    $('#adminStatusForm', body).addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const updated = Admin.applyStatus(id, f.elements.status.value, f.elements.note.value.trim());
      if (updated) Admin.openRequest(id); // re-open with fresh history
    });
  }
};

/* =====================================================================
   13. BOOT
   ===================================================================== */
function closeNavMenu() {
  const c = $('#navCollapse'), b = $('#navToggle');
  if (c) c.classList.remove('open');
  if (b) b.setAttribute('aria-expanded', 'false');
}

/** Hooks called by setLang() so each page can re-render its dynamic content. */
const PageHooks = {
  onLangChange() {
    if (PAGE === 'index') {
      Portal.renderServices();
      Portal.updateNav((location.hash || '#home').slice(1));
      if (!$('#view-dashboard').hidden) Portal.renderDashboard();
      const reg = $('#registerForm');
      const score = passwordScore(reg.elements.password.value);
      $('#pwStrengthText').textContent = score ? t('pw_level_' + score) : t('h_password');
    } else if (PAGE === 'admin' && Admin.me) {
      Admin.renderAll();
    }
    closeModal();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  seedData(false);

  let lang = 'en';
  try { lang = localStorage.getItem(KEYS.lang) || 'en'; } catch (e) { /* ignore */ }
  setLang(lang, true);
  hydrateIcons();

  // Shared UI behaviour (both pages)
  $('#langSelect').addEventListener('change', e => setLang(e.target.value));
  const toggle = $('#navToggle');
  toggle.addEventListener('click', () => {
    const open = $('#navCollapse').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); const cm = $('#confirmModal'); if (!cm.hidden) $('#confirmNo').click(); }
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close-modal]')) closeModal();

    // Show / hide password buttons
    const pwBtn = e.target.closest('[data-toggle-pw]');
    if (pwBtn) {
      const input = document.getElementById(pwBtn.dataset.togglePw);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      pwBtn.innerHTML = icon(show ? 'eye-off' : 'eye', 18);
      pwBtn.setAttribute('aria-pressed', String(show));
    }
    // Open a service request form
    const svcBtn = e.target.closest('[data-open-service]');
    if (svcBtn && PAGE === 'index') Portal.openService(svcBtn.dataset.openService);
    // Open request tracking
    const trackBtn = e.target.closest('[data-track]');
    if (trackBtn && PAGE === 'index') Portal.openTrack(trackBtn.dataset.track);
  });

  if (PAGE === 'index') {
    Portal.init();
    Portal.route();
  } else if (PAGE === 'admin') {
    Admin.init();
  }
});
