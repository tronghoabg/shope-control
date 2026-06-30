// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  fb_api.js — Gọi Facebook GraphQL (nhóm đã tham gia · feed nhóm · comment)  ║
// ║  Port format đã kiểm chứng từ adsmeta groupPoster.ts (jazoest, body đủ).    ║
// ║  Cần creds = { dtsg, lsd, uid }. runFetch chạy fetch TRONG tab facebook.com ║
// ╚══════════════════════════════════════════════════════════════════════════╝
'use strict';

const FB_GRAPHQL_URL = 'https://www.facebook.com/api/graphql/';
const ATTRIB = 'CometSinglePostDialogRoot.react,comet.post.single_dialog.group,unexpected';

// ─── helpers ──────────────────────────────────────────────────────────────────
let _req = 0;
function computeJazoest(dtsg) {           // thuật toán FB: "2" + tổng charCode(fb_dtsg)
  let s = 0; for (let i = 0; i < dtsg.length; i++) s += dtsg.charCodeAt(i);
  return '2' + s;
}
function b64utf8(s) { try { return btoa(unescape(encodeURIComponent(s))); } catch { return btoa(s); } }
function feedbackIdOf(postId) { return b64utf8('feedback:' + postId); }
function rndId() { return String(1 + Math.floor(Math.random() * 1e6)); }
function uuid() {
  // SW có crypto.randomUUID; fallback nếu thiếu
  try { return crypto.randomUUID(); } catch { return 'xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)); }
}

// FB hay trả "for(;;);" + nhiều dòng JSON → lấy JSON hợp lệ đầu tiên, ném lỗi nếu có errors.
function parseFbJson(text) {
  let t = String(text || '').replace(/^for\s*\(\s*;\s*;\s*\)\s*;?/, '').trim();
  let json;
  try { json = JSON.parse(t); }
  catch {
    const line = t.split('\n').find(l => l.trim().startsWith('{'));
    if (!line) throw new Error('FB trả dữ liệu không đọc được');
    json = JSON.parse(line);
  }
  if (json?.errors?.length) throw new Error(json.errors[0].message || 'GraphQL error');
  if (typeof json?.error === 'number' && json.error !== 0) {
    throw new Error(`${json.error} ${json.errorSummary || ''} ${json.errorDescription || ''}`.trim());
  }
  return json;
}

// Lấy RAW text từ 1 request GraphQL nội bộ (FB hay trả nhiều dòng JSON khi streaming).
async function gqlText(runFetch, creds, friendlyName, docId, variables) {
  if (!creds?.dtsg) throw new Error('Thiếu fb_dtsg — mở/đăng nhập facebook.com để extension lấy creds');
  if (!creds?.uid)  throw new Error('Thiếu uid (__user) — mở/đăng nhập facebook.com');
  const body = new URLSearchParams({
    av: creds.uid, __user: creds.uid, __a: '1', __req: (_req++).toString(36), dpr: '1',
    fb_dtsg: creds.dtsg, jazoest: computeJazoest(creds.dtsg), lsd: creds.lsd || '',
    fb_api_caller_class: 'RelayModern', fb_api_req_friendly_name: friendlyName,
    variables: JSON.stringify(variables), server_timestamps: 'true', doc_id: docId, __comet_req: '15',
  }).toString();
  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
    'x-fb-friendly-name': friendlyName, 'x-fb-lsd': creds.lsd || '', 'x-asbd-id': '359341',
  };
  return runFetch(FB_GRAPHQL_URL, 'POST', body, headers);
}

// Gọi 1 query/mutation, parse JSON dòng đầu (cho query không streaming).
async function gql(runFetch, creds, friendlyName, docId, variables) {
  return parseFbJson(await gqlText(runFetch, creds, friendlyName, docId, variables));
}

// Parse TẤT CẢ dòng JSON (streaming) → mảng object.
function parseFbJsonAll(text) {
  const out = [];
  const t = String(text || '').replace(/^for\s*\(\s*;\s*;\s*\)\s*;?/, '');
  for (const line of t.split('\n')) {
    const s = line.trim();
    if (!s || s[0] !== '{') continue;
    try { out.push(JSON.parse(s)); } catch {}
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) NHÓM ĐÃ THAM GIA  ✅ doc_id thật (từ adsmeta groupPoster.ts)
// ─────────────────────────────────────────────────────────────────────────────
const JOINED_GROUPS = {
  FRIENDLY_NAME: 'GroupsLeftRailYourGroupsPaginatedQuery',
  DOC_ID: '9658982227546884',
  LIST_TYPES: ['NON_ADMIN_MODERATOR_GROUPS', 'ADMIN_MODERATOR_GROUPS'],
  PAGE_SIZE: 30,
};

// Deep-walk gom MỌI node trông như "nhóm đã tham gia" (id số + name + dấu hiệu nhóm).
// Bền với việc FB đổi đường dẫn wrapper trong response.
function collectJoinedGroupNodes(obj, byId) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { for (const x of obj) collectJoinedGroupNodes(x, byId); return; }
  const id = obj.id != null ? String(obj.id) : '';
  const looksGroup = /^\d{5,}$/.test(id) && typeof obj.name === 'string' && obj.name
    && (obj.__typename === 'Group' || obj.profile_picture_48 || /\/groups\//.test(String(obj.url || '')) || 'last_post_time' in obj);
  if (looksGroup && !byId.has(id)) {
    byId.set(id, {
      groupId: id,
      name: String(obj.name),
      icon: obj.profile_picture_48?.uri || obj.profilePicture?.uri || '',
      url: obj.url || `https://www.facebook.com/groups/${id}`,
      lastPostedAt: obj.last_post_time ? obj.last_post_time * 1000 : null,
      memberCount: null,        // query này không trả số thành viên
      privacy: '',
    });
  }
  for (const k in obj) { const v = obj[k]; if (v && typeof v === 'object') collectJoinedGroupNodes(v, byId); }
}

// Tìm page_info có trang kế (deep) để phân trang kể cả khi cấu trúc đổi.
function deepNextCursor(json) {
  let cur = null;
  const visit = (o) => {
    if (cur || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) visit(x); return; }
    const pi = o.page_info;
    if (pi && pi.has_next_page && pi.end_cursor) { cur = String(pi.end_cursor); return; }
    for (const k in o) { const v = o[k]; if (v && typeof v === 'object') visit(v); }
  };
  visit(json?.data ?? json);
  return cur;
}

// → [{ groupId, name, icon, url, lastPostedAt, memberCount, privacy }]
async function fbFetchJoinedGroups(runFetch, creds, opts = {}) {
  const maxPages = opts.maxPages ?? 20;
  const byId = new Map();
  let firstErr = null;
  for (const listType of JOINED_GROUPS.LIST_TYPES) {
    let cursor = null;
    for (let page = 0; page < maxPages; page++) {
      let json;
      try {
        json = await gql(runFetch, creds, JOINED_GROUPS.FRIENDLY_NAME, JOINED_GROUPS.DOC_ID,
          { count: JOINED_GROUPS.PAGE_SIZE, cursor, listType, scale: 1 });
      } catch (e) { firstErr = firstErr || e; break; }   // lỗi listType này → ghi nhớ, thử listType kế
      // Đường dẫn chuẩn (nếu còn đúng) + deep-walk dự phòng (nếu FB đổi cấu trúc)
      const list = json?.data?.viewer?.groups_tab?.tab_groups_list;
      const before = byId.size;
      for (const ed of (list?.edges || [])) if (ed?.node) collectJoinedGroupNodes(ed.node, byId);
      if (byId.size === before) collectJoinedGroupNodes(json?.data ?? json, byId);   // fallback toàn cây
      if (opts.onProgress) opts.onProgress(byId.size);
      const pi = list?.page_info;
      const next = (pi?.has_next_page && pi.end_cursor) ? pi.end_cursor : deepNextCursor(json);
      if (!next || next === cursor) break;
      cursor = next;
    }
  }
  // Không lấy được nhóm nào VÀ có lỗi thật → ném ra để thấy nguyên nhân (đừng âm thầm "0 nhóm").
  if (byId.size === 0 && firstErr) throw firstErr;
  return Array.from(byId.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) ĐỌC FEED NHÓM  ✅ doc_id + vars thật (GroupsCometFeedRegularStoriesPaginationQuery)
// ─────────────────────────────────────────────────────────────────────────────
const GROUP_FEED = {
  FRIENDLY_NAME: 'GroupsCometFeedRegularStoriesPaginationQuery',
  DOC_ID: '27211790165108232',
  buildVariables(groupId, cursor, count) {
    return {
      count: count || 5,
      cursor: cursor || null,
      feedLocation: 'GROUP',
      feedType: 'DISCUSSION',
      feedbackSource: 0,
      filterTopicId: null,
      focusCommentID: null,
      privacySelectorRenderLocation: 'COMET_STREAM',
      referringStoryRenderLocation: null,
      renderLocation: 'group',
      scale: 1,
      sortingSetting: 'TOP_POSTS',
      stream_initial_count: 1,
      useDefaultActor: false,
      id: String(groupId),
      __relay_internal__pv__GHLShouldChangeAdIdFieldNamerelayprovider: true,
      __relay_internal__pv__GHLShouldChangeSponsoredDataFieldNamerelayprovider: true,
      __relay_internal__pv__CometFeedStory_enable_reactor_facepilerelayprovider: false,
      __relay_internal__pv__CometFeedStory_enable_social_bubblesrelayprovider: false,
      __relay_internal__pv__CometFeedStory_enable_post_permalink_white_space_clickrelayprovider: false,
      __relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider: false,
      __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
      __relay_internal__pv__IsWorkUserrelayprovider: false,
      __relay_internal__pv__TestPilotShouldIncludeDemoAdUseCaserelayprovider: false,
      __relay_internal__pv__FBReels_deprecate_short_form_video_context_gkrelayprovider: true,
      __relay_internal__pv__FBReels_enable_view_dubbed_audio_type_gkrelayprovider: true,
      __relay_internal__pv__CometFeedShareMedia_shouldPrefetchShareImagerelayprovider: false,
      __relay_internal__pv__CometImmersivePhotoCanUserDisable3DMotionrelayprovider: false,
      __relay_internal__pv__WorkCometIsEmployeeGKProviderrelayprovider: false,
      __relay_internal__pv__IsMergQAPollsrelayprovider: false,
      __relay_internal__pv__FBReelsMediaFooter_comet_enable_reels_ads_gkrelayprovider: true,
      __relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider: false,
      __relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider: 'AUTO_TRANSLATE',
      __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: true,
      __relay_internal__pv__CometUFISingleLineUFIrelayprovider: false,
      __relay_internal__pv__relay_provider_comet_ufi_ssr_seo_deferrelayprovider: true,
      __relay_internal__pv__CometUFI_dedicated_comment_routable_dialog_gkrelayprovider: true,
      __relay_internal__pv__ReelsIFUCard_reelsIFULikeCountrelayprovider: true,
      __relay_internal__pv__FBReelsIFUTileContent_reelsIFUPlayOnHoverrelayprovider: true,
      __relay_internal__pv__GroupsCometGYSJFeedItemHeightrelayprovider: 206,
      __relay_internal__pv__ShouldEnableBakedInTextStoriesrelayprovider: false,
      __relay_internal__pv__StoriesShouldIncludeFbNotesrelayprovider: false,
    };
  },
  // Deep-walk: gom MỌI story-node (có post_id) trong toàn bộ các dòng JSON (kể cả streaming).
  // → { posts: [{ postId, feedbackId, text, authorName, permalink }], nextCursor, rawCount, dbg }
  parse(jsons, groupId) {
    const arr = Array.isArray(jsons) ? jsons : [jsons];
    const byId = new Map();
    let nextCursor = null;

    // Tìm chuỗi message text trong 1 subtree (lấy chuỗi text dài nhất, tránh caption rác)
    const deepText = (o) => {
      let best = '';
      const v = (x) => {
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x)) { for (const y of x) v(y); return; }
        if (x.message && typeof x.message.text === 'string' && x.message.text.length > best.length) best = x.message.text;
        for (const k in x) v(x[k]);
      };
      v(o); return best;
    };
    // Tìm feedback id (base64 "feedback:...") trong subtree
    const deepFbId = (o) => {
      let r = null;
      const v = (x) => {
        if (r || !x || typeof x !== 'object') return;
        if (Array.isArray(x)) { for (const y of x) v(y); return; }
        if (typeof x.id === 'string' && x.id.startsWith('ZmVlZGJhY2s6')) { r = x.id; return; }
        if (x.feedback && typeof x.feedback.id === 'string') { r = x.feedback.id; return; }
        for (const k in x) v(x[k]);
      };
      v(o); return r;
    };
    const deepAuthor = (o) => {
      let r = '';
      const v = (x) => {
        if (r || !x || typeof x !== 'object') return;
        if (Array.isArray(x)) { for (const y of x) v(y); return; }
        if (Array.isArray(x.actors) && x.actors[0]?.name) { r = x.actors[0].name; return; }
        for (const k in x) v(x[k]);
      };
      v(o); return r;
    };
    // Walk tìm node có post_id, và bắt page_info cursor
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { for (const x of o) walk(x); return; }
      if (typeof o.post_id === 'string' && /^\d{5,}$/.test(o.post_id)) {
        const id = o.post_id;
        if (!byId.has(id)) byId.set(id, { postId: id, feedbackId: null, text: '', authorName: '' });
        const rec = byId.get(id);
        rec.feedbackId = rec.feedbackId || deepFbId(o);
        if (!rec.text) rec.text = deepText(o);
        if (!rec.authorName) rec.authorName = deepAuthor(o);
      }
      if (o.page_info && o.page_info.has_next_page && o.page_info.end_cursor) nextCursor = o.page_info.end_cursor;
      for (const k in o) { const v = o[k]; if (v && typeof v === 'object') walk(v); }
    };
    for (const j of arr) walk(j);

    const posts = [];
    for (const rec of byId.values()) {
      if (!rec.text || !rec.feedbackId) continue;   // bỏ bài không có chữ / không lấy được feedback id
      posts.push({
        postId: rec.postId, feedbackId: rec.feedbackId, text: rec.text,
        authorName: rec.authorName || '',
        permalink: `https://www.facebook.com/groups/${groupId}/posts/${rec.postId}/`,
      });
    }
    const dbg = `nodes=${byId.size}, có chữ+id=${posts.length}, dòng JSON=${arr.length}`;
    return { posts, nextCursor, rawCount: byId.size, dbg };
  },
};

async function fbFetchGroupFeed(runFetch, creds, groupId, cursor, count) {
  const text = await gqlText(runFetch, creds, GROUP_FEED.FRIENDLY_NAME, GROUP_FEED.DOC_ID, GROUP_FEED.buildVariables(groupId, cursor, count));
  const jsons = parseFbJsonAll(text);
  // FB có thể trả lỗi ở dòng đầu — ném ra để thấy
  const err = jsons.find(j => j?.errors?.length)?.errors?.[0]?.message;
  if (err && jsons.length === 1) throw new Error(err);
  return GROUP_FEED.parse(jsons, groupId);   // { posts, nextCursor, rawCount, dbg }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) ĐĂNG COMMENT  ✅ doc_id + vars thật (useCometUFICreateCommentMutation)
// ─────────────────────────────────────────────────────────────────────────────
const COMMENT = { FRIENDLY_NAME: 'useCometUFICreateCommentMutation', DOC_ID: '27279862301707853' };

// item: { feedbackId?, postId?, groupId }  ·  message: string
async function fbPostComment(runFetch, creds, item, message) {
  const fbId = item.feedbackId || (item.postId ? feedbackIdOf(item.postId) : null);
  if (!fbId) throw new Error('Thiếu feedbackId/postId để comment');
  const vars = {
    feedLocation: 'POST_PERMALINK_DIALOG', feedbackSource: 2, groupID: item.groupId || null,
    input: {
      actor_id: creds.uid, client_mutation_id: rndId(), attachments: null,
      feedback_id: fbId, formatting_style: null,
      message: { ranges: [], text: message }, attribution_id_v2: ATTRIB,
      vod_video_timestamp: null, is_tracking_encrypted: true,
      tracking: [JSON.stringify({ assistant_caller: 'comet_above_composer', conversation_guide_session_id: uuid(), conversation_guide_shown: null })],
      feedback_source: 'OBJECT', idempotence_token: 'client:' + uuid(), session_id: uuid(),
    },
    inviteShortLinkKey: null, renderLocation: null, scale: 1, useDefaultActor: false, focusCommentID: null,
    translationType: 'AUTO_TRANSLATE', canUseNicknameOnComet: false,
    __relay_internal__pv__groups_comet_use_glvrelayprovider: false,
    __relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider: false,
    __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
    __relay_internal__pv__IsWorkUserrelayprovider: false,
    __relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider: 'AUTO_TRANSLATE',
  };
  const json = await gql(runFetch, creds, COMMENT.FRIENDLY_NAME, COMMENT.DOC_ID, vars);
  const ok = !!(json?.data?.comment_create?.feedback_comment_edge?.node?.id
    || json?.data?.comment_create?.comment_edge?.node?.id
    || json?.data?.comment_create);
  return { ok, raw: json?.data || null, errors: json?.errors || null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) TÌM NHÓM MỚI (search)  ✅ doc_id thật (SearchCometResultsPaginatedResultsQuery)
// ─────────────────────────────────────────────────────────────────────────────
const SEARCH = { FRIENDLY_NAME: 'SearchCometResultsPaginatedResultsQuery', DOC_ID: '27332614923056014' };

function buildSearchVars(text, count, cursor) {
  return {
    allow_streaming: false,
    args: {
      callsite: 'COMET_GLOBAL_SEARCH',
      config: { exact_match: false, high_confidence_config: null, intercept_config: null, sts_disambiguation: null, watch_config: null },
      context: { bsid: uuid(), tsid: null },
      experience: { client_defined_experiences: ['ADS_PARALLEL_FETCH'], encoded_server_defined_params: null, fbid: null, type: 'GROUPS_TAB' },
      filters: [],
      text,
    },
    count, cursor: cursor || null,
    feedLocation: 'SEARCH', feedbackSource: 23, fetch_filters: true, focusCommentID: null, locale: null,
    privacySelectorRenderLocation: 'COMET_STREAM', referringStoryRenderLocation: null,
    renderLocation: 'search_results_page', scale: 1, stream_initial_count: 0, useDefaultActor: false,
    __relay_internal__pv__GHLShouldChangeAdIdFieldNamerelayprovider: true,
    __relay_internal__pv__GHLShouldChangeSponsoredDataFieldNamerelayprovider: true,
    __relay_internal__pv__CometFeedStory_enable_reactor_facepilerelayprovider: false,
    __relay_internal__pv__CometFeedStory_enable_social_bubblesrelayprovider: true,
    __relay_internal__pv__CometFeedStory_enable_post_permalink_white_space_clickrelayprovider: false,
    __relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider: false,
    __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
    __relay_internal__pv__IsWorkUserrelayprovider: false,
    __relay_internal__pv__TestPilotShouldIncludeDemoAdUseCaserelayprovider: false,
    __relay_internal__pv__FBReels_deprecate_short_form_video_context_gkrelayprovider: true,
    __relay_internal__pv__FBReels_enable_view_dubbed_audio_type_gkrelayprovider: true,
    __relay_internal__pv__CometFeedShareMedia_shouldPrefetchShareImagerelayprovider: false,
    __relay_internal__pv__CometImmersivePhotoCanUserDisable3DMotionrelayprovider: false,
    __relay_internal__pv__WorkCometIsEmployeeGKProviderrelayprovider: false,
    __relay_internal__pv__IsMergQAPollsrelayprovider: false,
    __relay_internal__pv__FBReelsMediaFooter_comet_enable_reels_ads_gkrelayprovider: true,
    __relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider: false,
    __relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider: 'AUTO_TRANSLATE',
    __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: true,
    __relay_internal__pv__CometUFISingleLineUFIrelayprovider: true,
    __relay_internal__pv__relay_provider_comet_ufi_ssr_seo_deferrelayprovider: true,
    __relay_internal__pv__CometUFI_dedicated_comment_routable_dialog_gkrelayprovider: true,
    __relay_internal__pv__ReelsIFUCard_reelsIFULikeCountrelayprovider: false,
    __relay_internal__pv__FBReelsIFUTileContent_reelsIFUPlayOnHoverrelayprovider: true,
    __relay_internal__pv__GroupsCometGYSJFeedItemHeightrelayprovider: 206,
    __relay_internal__pv__ShouldEnableBakedInTextStoriesrelayprovider: false,
    __relay_internal__pv__StoriesShouldIncludeFbNotesrelayprovider: true,
  };
}

// Deep-walk gom node Group + đo số thành viên / trạng thái join (port từ adsmeta).
function collectGroupNodes(obj, acc, seen) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { for (const x of obj) collectGroupNodes(x, acc, seen); return; }
  if (obj.__typename === 'Group' && obj.id && obj.name && !seen.has(String(obj.id))) { seen.add(String(obj.id)); acc.push(obj); }
  for (const k in obj) { const v = obj[k]; if (v && typeof v === 'object') collectGroupNodes(v, acc, seen); }
}
function hasGroupNode(o) { const a = []; collectGroupNodes(o, a, new Set()); return a.length > 0; }
function firstGroupNode(o) { const a = []; collectGroupNodes(o, a, new Set()); return a[0] || null; }
function findResultEdges(root) {
  let best = [];
  const visit = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      if (o.length && o.every(el => el && typeof el === 'object' && !Array.isArray(el) && hasGroupNode(el))) { if (o.length > best.length) best = o; }
      for (const x of o) visit(x); return;
    }
    for (const k in o) visit(o[k]);
  };
  visit(root); return best;
}
function parseHumanNum(s, unit) {
  let n = parseFloat(String(s).replace(/\./g, '').replace(/,/g, '.'));
  if (!isFinite(n)) return 0;
  const u = (unit || '').toLowerCase();
  if (/^(k|n|nghìn|nghin)$/.test(u)) n *= 1e3; else if (/^(m|tr|triệu|trieu)$/.test(u)) n *= 1e6;
  return Math.round(n);
}
function extractMemberCount(node) {
  let textBest = 0;
  const visit = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) visit(x); return; }
    for (const k in o) {
      const v = o[k];
      if (typeof v === 'string') {
        const m = v.match(/([\d.,]+)\s*(k|n|m|tr|nghìn|nghin|triệu|trieu)?\s*(thành viên|thanh vien|members|member)\b/i);
        if (m) { const num = parseHumanNum(m[1], m[2]); if (num > textBest) textBest = num; }
      } else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(node); return textBest || null;
}
function extractJoinState(node) {
  let s = '';
  const known = /^(MEMBER|JOINED|CAN_JOIN|CAN_JOIN_NOW|CAN_REQUEST_TO_JOIN|REQUESTED|NON_MEMBER|CANNOT_JOIN|NOT_A_MEMBER)$/;
  const visit = (o) => {
    if (s || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) visit(x); return; }
    for (const k in o) {
      const v = o[k];
      if (typeof v === 'string') { if ((/join.?state|viewer_join|membership.?state|join_status/i.test(k) && v) || known.test(v)) { s = v; return; } }
      else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(node); return s;
}
function extractEndCursor(json) {
  let result = null;
  const visit = (o) => {
    if (result || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) visit(x); return; }
    const pi = o.page_info;
    if (pi && typeof pi === 'object' && 'end_cursor' in pi && pi.has_next_page && pi.end_cursor) { result = String(pi.end_cursor); return; }
    for (const k in o) { const v = o[k]; if (v && typeof v === 'object') visit(v); }
  };
  visit(json?.data ?? json); return result;
}

// → { groups: [{ groupId, name, memberCount, privacy, url, joinState, joined }], nextCursor }
async function fbSearchGroups(runFetch, creds, keyword, cursor) {
  const json = await gql(runFetch, creds, SEARCH.FRIENDLY_NAME, SEARCH.DOC_ID, buildSearchVars(keyword, 20, cursor));
  const edges = findResultEdges(json?.data ?? json);
  const items = edges.length
    ? edges.map(e => ({ node: firstGroupNode(e), scope: e })).filter(x => x.node)
    : (() => { const a = []; collectGroupNodes(json?.data ?? json, a, new Set()); return a.map(n => ({ node: n, scope: n })); })();
  const groups = items.map(({ node: n, scope }) => {
    const id = String(n.id);
    const pr = String(n.privacy_info?.privacy_scope?.name || n.visibility || n.privacy || '').toLowerCase();
    const privacy = /closed|private|secret/.test(pr) ? 'private' : /public|open/.test(pr) ? 'public' : 'unknown';
    const joinState = extractJoinState(scope);
    return {
      groupId: id, name: String(n.name || ''),
      memberCount: extractMemberCount(scope),
      privacy, url: `https://www.facebook.com/groups/${id}`,
      joinState, joined: /MEMBER|JOINED/i.test(joinState),
    };
  });
  return { groups, nextCursor: extractEndCursor(json) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) THAM GIA NHÓM (join)  ✅ doc_id thật (GroupCometJoinForumMutation)
// ─────────────────────────────────────────────────────────────────────────────
const JOIN = { FRIENDLY_NAME: 'GroupCometJoinForumMutation', DOC_ID: '27095583533431012' };
function groupAttrib(groupId) {
  return `CometGroupDiscussionRoot.react,comet.group,unexpected,${Date.now()},0,${groupId},,`;
}
async function fbJoinGroup(runFetch, creds, group) {
  const gid = String(group.groupId || group.id);
  const vars = {
    feedType: 'DISCUSSION', groupID: gid,
    input: {
      action_source: 'GROUP_MALL', attribution_id_v2: groupAttrib(gid), group_id: gid,
      group_share_tracking_params: { app_id: '2220391788200892', exp_id: 'null', is_from_share: false },
      actor_id: creds.uid, client_mutation_id: rndId(),
    },
    inviteShortLinkKey: null, isChainingRecommendationUnit: false, scale: 1,
    source: 'GROUP_MALL', renderLocation: 'group_mall',
    __relay_internal__pv__groups_comet_use_glvrelayprovider: false,
    __relay_internal__pv__GroupsCometGYSJUnifiedUnitCardImageHeightrelayprovider: 150,
    __relay_internal__pv__GroupsCometGroupChatLazyLoadLastMessageSnippetrelayprovider: false,
  };
  const json = await gql(runFetch, creds, JOIN.FRIENDLY_NAME, JOIN.DOC_ID, vars);
  return { ok: !!json?.data && !json?.errors, raw: json?.data || null, errors: json?.errors || null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) ĐĂNG BÀI VÀO NHÓM  ✅ doc_id thật (ComposerStoryCreateMutation) — port từ adsmeta
// ─────────────────────────────────────────────────────────────────────────────
const POST_MUTATION = { FRIENDLY_NAME: 'ComposerStoryCreateMutation', DOC_ID: '27450471367978057' };
const POST_RELAY = {
  __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: true,
  __relay_internal__pv__GHLShouldChangeSponsoredDataFieldNamerelayprovider: true,
  __relay_internal__pv__GHLShouldChangeAdIdFieldNamerelayprovider: true,
  __relay_internal__pv__CometUFI_dedicated_comment_routable_dialog_gkrelayprovider: true,
  __relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider: 'AUTO_TRANSLATE',
  __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
  __relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider: false,
  __relay_internal__pv__IsWorkUserrelayprovider: false,
  __relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider: false,
  __relay_internal__pv__CometUFISingleLineUFIrelayprovider: false,
  __relay_internal__pv__CometFeedStory_enable_reactor_facepilerelayprovider: false,
  __relay_internal__pv__CometFeedStory_enable_social_bubblesrelayprovider: false,
  __relay_internal__pv__CometFeedStory_enable_post_permalink_white_space_clickrelayprovider: false,
  __relay_internal__pv__TestPilotShouldIncludeDemoAdUseCaserelayprovider: false,
  __relay_internal__pv__FBReels_deprecate_short_form_video_context_gkrelayprovider: true,
  __relay_internal__pv__FBReels_enable_view_dubbed_audio_type_gkrelayprovider: true,
  __relay_internal__pv__CometFeedShareMedia_shouldPrefetchShareImagerelayprovider: false,
  __relay_internal__pv__CometImmersivePhotoCanUserDisable3DMotionrelayprovider: false,
  __relay_internal__pv__WorkCometIsEmployeeGKProviderrelayprovider: false,
  __relay_internal__pv__IsMergQAPollsrelayprovider: false,
  __relay_internal__pv__FBReelsMediaFooter_comet_enable_reels_ads_gkrelayprovider: true,
  __relay_internal__pv__relay_provider_comet_ufi_ssr_seo_deferrelayprovider: true,
  __relay_internal__pv__ReelsIFUCard_reelsIFULikeCountrelayprovider: true,
  __relay_internal__pv__FBReelsIFUTileContent_reelsIFUPlayOnHoverrelayprovider: true,
  __relay_internal__pv__GroupsCometGYSJFeedItemHeightrelayprovider: 206,
  __relay_internal__pv__ShouldEnableBakedInTextStoriesrelayprovider: false,
  __relay_internal__pv__StoriesShouldIncludeFbNotesrelayprovider: false,
  __relay_internal__pv__groups_comet_use_glvrelayprovider: true,
  __relay_internal__pv__GHLShouldChangeSponsoredAuctionDistanceFieldNamerelayprovider: false,
  __relay_internal__pv__GHLShouldUseSponsoredAuctionLabelFieldNameV1relayprovider: false,
  __relay_internal__pv__GHLShouldUseSponsoredAuctionLabelFieldNameV2relayprovider: false,
};
function buildComposedText(text) {
  const blocks = String(text).split('\n');
  return {
    block_data: blocks.map(() => '{}'), block_depths: blocks.map(() => 0), block_types: blocks.map(() => 0),
    blocks, entities: blocks.map(() => '[]'), entity_map: '{}', inline_styles: blocks.map(() => '[]'),
  };
}

// Đăng 1 bài (text + link tuỳ chọn) vào 1 nhóm. → { ok, postUrl, errors }
async function fbCreateGroupPost(runFetch, creds, groupId, message, opts = {}) {
  const text = opts.link ? `${message}\n${opts.link}` : message;
  const variables = {
    input: {
      composer_entry_point: 'inline_composer', composer_source_surface: 'group', composer_type: 'group',
      logging: { composer_session_id: uuid() }, source: 'WWW',
      message: { ranges: [], text }, with_tags_ids: null, inline_activities: [],
      text_format_preset_id: opts.bgPresetId || '0', group_flair: { flair_id: null },
      attachments: (opts.photoIds || []).map(id => ({ photo: { id } })),
      composed_text: buildComposedText(text), navigation_data: null, tracking: [null],
      event_share_metadata: { surface: 'newsfeed' }, audience: { to_id: String(groupId) },
      actor_id: creds.uid, client_mutation_id: rndId(),
    },
    feedLocation: 'GROUP', feedbackSource: 0, focusCommentID: null, gridMediaWidth: null,
    groupID: null, scale: 1, privacySelectorRenderLocation: 'COMET_STREAM',
    checkPhotosToReelsUpsellEligibility: false, referringStoryRenderLocation: null,
    renderLocation: 'group', useDefaultActor: false, inviteShortLinkKey: null,
    isFeed: false, isFundraiser: false, isFunFactPost: false, isGroup: true, isEvent: false,
    isTimeline: false, isSocialLearning: false, isPageNewsFeed: false, isProfileReviews: false,
    isWorkSharedDraft: false, ...POST_RELAY,
  };
  const json = await gql(runFetch, creds, POST_MUTATION.FRIENDLY_NAME, POST_MUTATION.DOC_ID, variables);
  const story = json?.data?.story_create?.story;
  const postId = story?.legacy_story_hideable_id ?? json?.data?.story_create?.group_feed_story_edge?.node?.post_id;
  const postUrl = story?.url ?? (postId ? `https://www.facebook.com/groups/${groupId}/permalink/${postId}/` : '');
  return { ok: !!postUrl, postUrl, errors: json?.errors || null };
}

// Upload 1 ảnh (dataURL) lên upload.facebook.com → trả về photoID.
// runUpload(url, fields, { base64, name, mime }) -> text (chạy trong tab FB, dựng FormData + 'farr').
async function fbUploadPhoto(runUpload, creds, dataUrl, name = 'photo.jpg') {
  const m = /^data:(.+?);base64,(.*)$/s.exec(String(dataUrl));
  if (!m) throw new Error('Ảnh không hợp lệ');
  const mime = m[1], base64 = m[2];
  const qs = new URLSearchParams({
    av: creds.uid, __user: creds.uid, __a: '1', __req: (_req++).toString(36), dpr: '1',
    fb_dtsg: creds.dtsg, jazoest: computeJazoest(creds.dtsg), lsd: creds.lsd || '', __comet_req: '15',
  }).toString();
  const url = `https://upload.facebook.com/ajax/react_composer/attachments/photo/upload?${qs}`;
  const fields = { source: '8', profile_id: creds.uid, waterfallxapp: 'comet', upload_id: 'jsc_' + Math.floor(Math.random() * 1e9).toString(36) };
  const raw = await runUpload(url, fields, { base64, name, mime });
  let json; try { json = JSON.parse(String(raw).replace(/^for\s*\(\s*;\s*;\s*\)\s*;?/, '')); } catch { json = {}; }
  const photoID = json?.payload?.photoID || json?.payload?.photo_id;
  if (!photoID) throw new Error('Upload ảnh thất bại: ' + (json?.errorSummary || json?.error?.message || 'không nhận được ảnh từ Facebook'));
  return String(photoID);
}

self.ShopeFbApi = { fbFetchJoinedGroups, fbFetchGroupFeed, fbPostComment, fbSearchGroups, fbJoinGroup, fbCreateGroupPost, fbUploadPhoto, FB_GRAPHQL_URL, _gql: gql };
