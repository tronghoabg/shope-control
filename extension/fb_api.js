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
function hex32() { let s = ''; for (let i = 0; i < 32; i++) s += ((Math.random() * 16) | 0).toString(16); return s; }
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
    const deepCreatedAt = (o) => {
      let result = 0;
      const keys = new Set(['creation_time', 'created_time', 'publish_time', 'publish_timestamp', 'created_at']);
      const visit = (x) => {
        if (result || !x || typeof x !== 'object') return;
        if (Array.isArray(x)) { for (const y of x) visit(y); return; }
        for (const [key, value] of Object.entries(x)) {
          if (keys.has(key)) {
            const raw = typeof value === 'object' ? (value?.timestamp ?? value?.time) : value;
            const n = Number(raw);
            const ms = n > 1e12 ? n : n > 1e9 ? n * 1000 : 0;
            if (ms > 946684800000 && ms < Date.now() + 86400000) { result = ms; return; }
          }
          if (value && typeof value === 'object') visit(value);
        }
      };
      visit(o); return result;
    };
    // Walk tìm node có post_id, và bắt page_info cursor
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { for (const x of o) walk(x); return; }
      if (typeof o.post_id === 'string' && /^\d{5,}$/.test(o.post_id)) {
        const id = o.post_id;
        if (!byId.has(id)) byId.set(id, { postId: id, feedbackId: null, text: '', authorName: '', createdAt: 0 });
        const rec = byId.get(id);
        rec.feedbackId = rec.feedbackId || deepFbId(o);
        if (!rec.text) rec.text = deepText(o);
        if (!rec.authorName) rec.authorName = deepAuthor(o);
        if (!rec.createdAt) rec.createdAt = deepCreatedAt(o);
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
        createdAt: rec.createdAt || 0,
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
      actor_id: creds.uid, client_mutation_id: rndId(),
      // Video comment: gắn qua media.id (dùng video_id). Nếu không có video thì tới ảnh (attachmentId).
      attachments: item.videoId ? [{ media: { id: String(item.videoId) } }]
        : item.attachmentId ? [{ media: { id: String(item.attachmentId) } }] : null,
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
    || json?.data?.comment_create?.comment_edge?.node?.id);
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
      hasQuestions: hasNonEmptyQuestionnaire(scope),   // nhóm bắt trả lời câu hỏi (nếu FB có trả trong kết quả tìm)
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
// Deep-scan tìm bộ câu hỏi vào nhóm CÓ NỘI DUNG (khác null/rỗng) → nhóm bắt trả lời câu hỏi.
function hasNonEmptyQuestionnaire(obj) {
  let found = false;
  const visit = (o) => {
    if (found || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) visit(x); return; }
    for (const k in o) {
      const v = o[k];
      if (/questionnaire|membership_question|join_question/i.test(k) && v != null) {
        if (v === true || (Array.isArray(v) ? v.length > 0 : (typeof v === 'object' ? Object.keys(v).length > 0 : !!v))) { found = true; return; }
      }
      if (v && typeof v === 'object') visit(v);
    }
  };
  visit(obj);
  return found;
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
  // Lấy RAW để tự chẩn đoán (không để parseFbJson ném lỗi che mất trường hợp "cần trả lời câu hỏi").
  const raw = await gqlText(runFetch, creds, JOIN.FRIENDLY_NAME, JOIN.DOC_ID, vars);
  let json = null, parseErr = '';
  try { json = parseFbJson(raw); } catch (e) { parseErr = e?.message || String(e); }
  // Nhóm bắt trả lời câu hỏi → báo needQuestions (để tầng trên BỎ QUA, không tính lỗi).
  const errMsg = json?.errors?.[0]?.message || parseErr || '';
  const needQuestions = /question(naire)?/i.test(errMsg) || hasNonEmptyQuestionnaire(json?.data);
  if (needQuestions) return { ok: false, needQuestions: true, errors: json?.errors || null };
  if (parseErr) return { ok: false, error: parseErr };
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

// Gắn video vào bài/story: shape lấy từ ComposerStoryCreateMutation thật (attachments[].video).
function videoAttachment(videoId) {
  return {
    video: {
      id: String(videoId), notify_when_processed: true,
      was_created_via_unified_video_flow: { was_created_via_unified_video_flow: true },
      audio_descriptions: null, additional_video_metadata: { translatedAudioMetadata: [] }, transcriptions: null,
    },
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
      // Ưu tiên video nếu có; nếu không thì dùng ảnh. (attachments là mảng — video/ảnh xài chung khóa)
      attachments: opts.videoId ? [videoAttachment(opts.videoId)] : (opts.photoIds || []).map(id => ({ photo: { id } })),
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
  const sc = json?.data?.story_create || {};
  const story = sc.story;
  // Bài VIDEO: FB trả story=null + post_id ở story_create (xử lý video async). Đọc thêm post_id/story_id
  // để KHÔNG báo nhầm "thất bại" (gây retry/đăng trùng) khi thật ra đã đăng.
  const postId = story?.legacy_story_hideable_id ?? sc.group_feed_story_edge?.node?.post_id ?? sc.post_id ?? null;
  const postUrl = story?.url ?? (postId ? `https://www.facebook.com/groups/${groupId}/permalink/${postId}/` : '');
  return { ok: !!(postUrl || sc.story_id), postUrl, errors: json?.errors || null };
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

// ─────────────────────────────────────────────────────────────────────────────
// 6b) UPLOAD VIDEO  ✅ giao thức thật (start → rupload bytes → receive)
//     Trả về videoId để gắn vào bài (fbCreateGroupPost opts.videoId) hoặc comment (item.videoId).
//     runFetch  = fetch urlencoded trong tab FB (start/receive).
//     runRawUpload(url, headers, {base64, mime}) = POST body RAW (bytes) trong tab FB (rupload).
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_CFG = { FRIENDLY_NAME: 'MediaUploadFBDefaultServerConfigurationRetrieverQuery', DOC_ID: '26396735533340887' };

// Host upload bytes: hỏi FB (targeted → gần nhất), fallback rupload.facebook.com.
async function fbGetVideoUploadHost(runFetch, creds) {
  try {
    const json = await gql(runFetch, creds, VIDEO_CFG.FRIENDLY_NAME, VIDEO_CFG.DOC_ID, { source_type: 'newsfeed_composer' });
    const svc = json?.data?.media_upload_config?.network_upload_service;
    const name = svc?.targeted?.service_name || svc?.default?.service_name;
    const dom = svc?.targeted?.service_domain || svc?.default?.service_domain || 'facebook.com';
    if (name) return `https://${name}.${dom}`;
  } catch { /* dùng fallback */ }
  return 'https://rupload.facebook.com';
}

async function fbUploadVideo(runFetch, runRawUpload, creds, dataUrl, name = 'video.mp4', onProgress) {
  if (!creds?.dtsg || !creds?.uid) throw new Error('Chưa kết nối Facebook (thiếu creds)');
  const m = /^data:(.+?);base64,(.*)$/s.exec(String(dataUrl));
  if (!m) throw new Error('Video không hợp lệ (cần dataURL base64)');
  const mime = m[1] || 'video/mp4';
  const base64 = m[2].replace(/\s+/g, '');
  const pad = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const size = Math.floor(base64.length / 4) * 3 - pad;
  if (size <= 0) throw new Error('Video rỗng');
  const ext = (String(name).split('.').pop() || 'mp4').toLowerCase();
  const waterfall = uuid();
  const encName = encodeURIComponent(name);
  const common = () => ({
    av: creds.uid, __user: creds.uid, __a: '1', __req: (_req++).toString(36), dpr: '1',
    fb_dtsg: creds.dtsg, jazoest: computeJazoest(creds.dtsg), lsd: creds.lsd || '', __comet_req: '15',
  });
  const wfHeader = { 'content-type': 'application/x-www-form-urlencoded', 'x_fb_video_waterfall_id': waterfall };

  // ── B1: start → video_id, upload_session_id ──
  if (onProgress) onProgress('start');
  const startUrl = `https://vupload-edge.facebook.com/ajax/video/upload/requests/start/?av=${creds.uid}&__a=1`;
  const startBody = new URLSearchParams({
    waterfall_id: waterfall, target_id: creds.uid, source: 'newsfeed_composer', composer_entry_point_ref: 'feed',
    supports_chunking: 'true', supports_file_api: 'true',
    file_size: String(size), file_extension: ext,
    partition_start_offset: '0', partition_end_offset: String(size), has_file_been_replaced: 'false',
    ...common(),
  }).toString();
  const startJson = parseFbJson(await runFetch(startUrl, 'POST', startBody, wfHeader));
  const p1 = startJson?.payload || startJson;
  const videoId = p1?.video_id;
  const uploadSessionId = p1?.upload_session_id;
  if (!videoId) throw new Error('Không lấy được video_id từ Facebook (bước start)');

  // ── B2: upload bytes → handle (resp.h) ──  (bỏ qua nếu FB báo skip_upload)
  if (!p1?.skip_upload) {
    if (onProgress) onProgress('bytes');
    const host = await fbGetVideoUploadHost(runFetch, creds);
    const qs = new URLSearchParams(common()).toString();
    const upUrl = `${host}/fb_video/${hex32()}-0-${size}?${qs}`;
    const upHeaders = {
      offset: '0', start_offset: '0', end_offset: String(size),
      'x-entity-length': String(size), 'x-entity-name': encName, 'x-entity-type': mime,
      'x-total-asset-size': String(size), id: String(videoId), composer_session_id: waterfall,
    };
    if (uploadSessionId) upHeaders['product_media_id'] = String(uploadSessionId);
    const upRaw = await runRawUpload(upUrl, upHeaders, { base64, mime });
    let upJson; try { upJson = JSON.parse(String(upRaw).replace(/^for\s*\(\s*;\s*;\s*\)\s*;?/, '')); } catch { upJson = {}; }
    const handle = upJson?.h;
    if (!handle) throw new Error('Upload dữ liệu video thất bại: ' + String(upRaw).slice(0, 160));

    // ── B3: receive (xác nhận) ── lỗi ở bước này KHÔNG chặn: bytes đã lên + video_id vẫn dùng được.
    if (onProgress) onProgress('receive');
    const rcvUrl = `https://vupload-edge.facebook.com/ajax/video/upload/requests/receive/?av=${creds.uid}&__a=1`;
    const rcvBody = new URLSearchParams({
      waterfall_id: waterfall, target_id: creds.uid, video_id: String(videoId),
      source: 'newsfeed_composer', composer_entry_point_ref: 'feed',
      supports_chunking: 'true', supports_upload_service: 'true',
      partition_start_offset: '0', partition_end_offset: String(size),
      start_offset: '0', end_offset: String(size), upload_speed: '0',
      fbuploader_video_file_chunk: handle, has_file_been_replaced: 'false',
      ...common(),
    }).toString();
    try { parseFbJson(await runFetch(rcvUrl, 'POST', rcvBody, wfHeader)); } catch { /* không chặn */ }
  }

  if (onProgress) onProgress('done');
  return String(videoId);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) PAGE: tìm Page mục tiêu + feed bài của Page (comment dạo trên page)  ✅ doc_id thật
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SEARCH = { FRIENDLY_NAME: 'SearchCometResultsPaginatedResultsQuery', DOC_ID: '27547223741556484' };
function buildPageSearchVars(text, count, cursor) {
  const v = buildSearchVars(text, count, cursor);
  v.args.experience.type = 'PAGES_TAB';   // chỉ khác bản tìm nhóm ở đây
  return v;
}
// Deep-walk gom các Page (SearchProfileViewModel.profile) trong kết quả search.
function collectPageProfiles(root) {
  const out = [], seen = new Set();
  const visit = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) visit(x); return; }
    if (o.__typename === 'SearchProfileViewModel' && o.profile && o.profile.id) {
      const p = o.profile, id = String(p.id);
      if (!seen.has(id)) {
        seen.add(id);
        out.push({
          pageId: id, name: String(p.name || ''),
          url: p.url || `https://www.facebook.com/profile.php?id=${id}`,
          icon: p.profile_picture?.uri || '',
          snippet: o.primary_snippet_text_with_entities?.text || '',
        });
      }
    }
    for (const k in o) visit(o[k]);
  };
  visit(root);
  return out;
}
async function fbSearchPages(runFetch, creds, keyword, cursor) {
  const json = await gql(runFetch, creds, PAGE_SEARCH.FRIENDLY_NAME, PAGE_SEARCH.DOC_ID, buildPageSearchVars(keyword, 8, cursor));
  const pages = collectPageProfiles(json?.data ?? json);
  return { pages, nextCursor: extractEndCursor(json) };
}

const PAGE_FEED = { FRIENDLY_NAME: 'ProfileCometTimelineFeedRefetchQuery', DOC_ID: '27394782800205609' };
function buildPageFeedVars(pageId, cursor, count) {
  return {
    afterTime: null, beforeTime: null, count: count || 5, cursor: cursor || null,
    feedLocation: 'TIMELINE', feedbackSource: 0, focusCommentID: null,
    memorializedSplitTimeFilter: null, omitPinnedPost: true,
    postedBy: { group: 'OWNER' }, privacy: null,
    privacySelectorRenderLocation: 'COMET_STREAM', referringStoryRenderLocation: null,
    renderLocation: 'timeline', scale: 1, stream_count: 1, taggedInOnly: null,
    trackingCode: null, useDefaultActor: false, id: String(pageId),
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
    __relay_internal__pv__ReelsIFUCard_reelsIFULikeCountrelayprovider: false,
    __relay_internal__pv__FBReelsIFUTileContent_reelsIFUPlayOnHoverrelayprovider: true,
    __relay_internal__pv__GroupsCometGYSJFeedItemHeightrelayprovider: 206,
    __relay_internal__pv__ShouldEnableBakedInTextStoriesrelayprovider: false,
    __relay_internal__pv__StoriesShouldIncludeFbNotesrelayprovider: false,
  };
}
function parsePageFeed(jsons, pageId) {
  const arr = Array.isArray(jsons) ? jsons : [jsons];
  const byId = new Map(); let nextCursor = null;
  const deepText = (o) => { let best = ''; const v = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) { for (const y of x) v(y); return; } if (x.message && typeof x.message.text === 'string' && x.message.text.length > best.length) best = x.message.text; for (const k in x) v(x[k]); }; v(o); return best; };
  const deepFbId = (o) => { let r = null; const v = (x) => { if (r || !x || typeof x !== 'object') return; if (Array.isArray(x)) { for (const y of x) v(y); return; } if (typeof x.id === 'string' && x.id.startsWith('ZmVlZGJhY2s6')) { r = x.id; return; } if (x.feedback && typeof x.feedback.id === 'string') { r = x.feedback.id; return; } for (const k in x) v(x[k]); }; v(o); return r; };
  const deepUrl = (o) => { let r = ''; const v = (x) => { if (r || !x || typeof x !== 'object') return; if (Array.isArray(x)) { for (const y of x) v(y); return; } if (typeof x.wwwURL === 'string' && x.wwwURL) { r = x.wwwURL; return; } for (const k in x) v(x[k]); }; v(o); return r; };
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) walk(x); return; }
    if (typeof o.post_id === 'string' && /^\d{5,}$/.test(o.post_id)) {
      const id = o.post_id;
      if (!byId.has(id)) byId.set(id, { postId: id, feedbackId: null, text: '', permalink: '' });
      const rec = byId.get(id);
      rec.feedbackId = rec.feedbackId || deepFbId(o);
      if (!rec.text) rec.text = deepText(o);
      if (!rec.permalink) rec.permalink = deepUrl(o);
    }
    if (o.page_info && o.page_info.has_next_page && o.page_info.end_cursor) nextCursor = o.page_info.end_cursor;
    for (const k in o) { const v = o[k]; if (v && typeof v === 'object') walk(v); }
  };
  for (const j of arr) walk(j);
  const posts = [];
  for (const rec of byId.values()) {
    if (!rec.text || !rec.feedbackId) continue;
    posts.push({ postId: rec.postId, feedbackId: rec.feedbackId, text: rec.text, permalink: rec.permalink || `https://www.facebook.com/${pageId}/posts/${rec.postId}/` });
  }
  return { posts, nextCursor, rawCount: byId.size, dbg: `nodes=${byId.size}, ok=${posts.length}, dòng=${arr.length}` };
}
async function fbFetchPageFeed(runFetch, creds, pageId, cursor, count) {
  const text = await gqlText(runFetch, creds, PAGE_FEED.FRIENDLY_NAME, PAGE_FEED.DOC_ID, buildPageFeedVars(pageId, cursor, count));
  const jsons = parseFbJsonAll(text);
  const err = jsons.find(j => j?.errors?.length)?.errors?.[0]?.message;
  if (err && jsons.length === 1) throw new Error(err);
  return parsePageFeed(jsons, pageId);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) ĐỌC COMMENT của 1 bài (tìm khách) ✅ doc_id thật (CommentsListComponentsPaginationQuery)
// ─────────────────────────────────────────────────────────────────────────────
const POST_COMMENTS = { FRIENDLY_NAME: 'CommentsListComponentsPaginationQuery', DOC_ID: '28148854324717105' };
// Deep-walk gom node comment: có id (base64 "comment:") + author + body.text.
function parseComments(jsons) {
  const arr = Array.isArray(jsons) ? jsons : [jsons];
  const byId = new Map(); let nextCursor = null;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) walk(x); return; }
    const isComment = typeof o.id === 'string' && o.id.startsWith('Y29tbWVudDo')
      && o.author && typeof o.author === 'object' && o.body && typeof o.body === 'object' && typeof o.body.text === 'string';
    if (isComment && !byId.has(o.id)) {
      const aid = o.author.id != null ? String(o.author.id) : '';
      byId.set(o.id, {
        commentId: o.id, authorName: o.author.name || '', authorId: aid,
        authorUrl: o.author.url || (aid ? `https://www.facebook.com/${aid}` : ''),
        text: o.body.text || '', createdAt: o.created_time ? o.created_time * 1000 : null,
      });
    }
    if (o.page_info && o.page_info.end_cursor) nextCursor = o.page_info.end_cursor;
    for (const k in o) { const v = o[k]; if (v && typeof v === 'object') walk(v); }
  };
  for (const j of arr) walk(j);
  return { comments: [...byId.values()], nextCursor };
}
async function fbListPostComments(runFetch, creds, postId, cursor) {
  const vars = {
    commentsAfterCount: -1, commentsAfterCursor: cursor || null,
    commentsBeforeCount: null, commentsBeforeCursor: null, commentsIntentToken: null,
    feedLocation: 'POST_PERMALINK_DIALOG', focusCommentID: null, scale: 1, useDefaultActor: false,
    id: feedbackIdOf(postId),
  };
  const text = await gqlText(runFetch, creds, POST_COMMENTS.FRIENDLY_NAME, POST_COMMENTS.DOC_ID, vars);
  const jsons = parseFbJsonAll(text);
  const err = jsons.find(j => j?.errors?.length)?.errors?.[0]?.message;
  if (err && jsons.length === 1) throw new Error(err);
  return parseComments(jsons);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) ẨN COMMENT ✅ doc_id thật (CometUFIHideCommentMutation)
// ─────────────────────────────────────────────────────────────────────────────
const HIDE_COMMENT = { FRIENDLY_NAME: 'CometUFIHideCommentMutation', DOC_ID: '27488296064098098' };
async function fbHideComment(runFetch, creds, commentId) {
  const vars = {
    input: {
      comment_id: String(commentId), feedback_source: 2, hide_location: 'MENU', site: 'comet',
      actor_id: creds.uid, client_mutation_id: rndId(), attribution_id_v2: ATTRIB,
    },
    feedLocation: 'POST_PERMALINK_DIALOG', useDefaultActor: false, scale: 1,
    __relay_internal__pv__CometUFI_dedicated_comment_routable_dialog_gkrelayprovider: true,
  };
  const json = await gql(runFetch, creds, HIDE_COMMENT.FRIENDLY_NAME, HIDE_COMMENT.DOC_ID, vars);
  return { ok: !!json?.data && !json?.errors, errors: json?.errors || null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) RỜI NHÓM ✅ doc_id thật (GroupCometLeaveForumMutation)
// ─────────────────────────────────────────────────────────────────────────────
const LEAVE = { FRIENDLY_NAME: 'GroupCometLeaveForumMutation', DOC_ID: '27087223784277669' };
async function fbLeaveGroup(runFetch, creds, group) {
  const gid = String(group.groupId || group.id);
  const vars = {
    input: { attribution_id_v2: groupAttrib(gid), group_id: gid, actor_id: creds.uid, client_mutation_id: rndId() },
    inviteShortLinkKey: null, isChainingRecommendationUnit: false, ordering: ['viewer_added'], scale: 1, groupID: gid,
    __relay_internal__pv__GroupsCometGYSJUnifiedUnitCardImageHeightrelayprovider: 150,
    __relay_internal__pv__GroupsCometGroupChatLazyLoadLastMessageSnippetrelayprovider: false,
  };
  const json = await gql(runFetch, creds, LEAVE.FRIENDLY_NAME, LEAVE.DOC_ID, vars);
  return { ok: !!json?.data && !json?.errors, errors: json?.errors || null };
}

const ACTIVITY_LOG = {
  FRIENDLY_NAME: 'CometActivityLogStoriesListPaginationQuery',
  DOC_ID: '27478633398483911',
};
function activityText(node) {
  return node?.feedback_context?.relevant_comments?.[0]?.body?.text
    || node?.message?.text || node?.title?.text || node?.title || '';
}
function parseActivityItem(edge) {
  const node = edge?.node || {};
  const url = String(node.url || node.story?.url || '');
  const postId = (url.match(/\/(?:posts|permalink)\/(\d{5,})/i) || [])[1] || '';
  if (!postId) return null;
  const commentId = (url.match(/[?&]comment_id=(\d{5,})/i) || [])[1] || '';
  const groupRef = (url.match(/\/groups\/([^/?#]+)/i) || [])[1] || '';
  const created = Number(node.creation_time || node.created_time || 0);
  return {
    id: String(commentId || node.post_id || postId), postId: String(postId),
    commentId: String(commentId), groupId: /^\d+$/.test(groupRef) ? groupRef : '',
    groupName: node.group?.name || node.story?.to?.name || groupRef,
    mode: commentId ? 'social' : 'post', kind: commentId ? 'comment' : 'post',
    content: activityText(node),
    permalink: url ? new URL(url, 'https://www.facebook.com').href : '',
    createdAt: created ? created * (created < 1e12 ? 1000 : 1) : null,
    source: 'facebook_activity',
  };
}
async function fbFetchActivityLog(runFetch, creds, cursor, count = 50) {
  const variables = {
    audience: null, category: 'GROUPPOSTS', category_key: 'GROUPPOSTS',
    count: Math.min(100, Math.max(1, Number(count) || 50)), cursor: cursor || null,
    feedLocation: null, media_content_filters: [], month: null, person_id: null,
    privacy: 'NONE', scale: 1, timeline_visibility: 'ALL', year: null,
    id: String(creds.uid),
  };
  const json = await gql(runFetch, creds, ACTIVITY_LOG.FRIENDLY_NAME, ACTIVITY_LOG.DOC_ID, variables);
  const connection = json?.data?.node?.activity_log_stories || {};
  const pageInfo = connection.page_info || {};
  return {
    items: (connection.edges || []).map(parseActivityItem).filter(Boolean),
    nextCursor: pageInfo.end_cursor || null, hasMore: !!pageInfo.has_next_page,
  };
}

// Apply the volatile operation ids supplied by the v1.5 web runtime. Unknown or
// malformed values are ignored, so the bundled ids remain a safe offline fallback.
function configureRuntime(operations) {
  const targets = {
    joinedGroups: JOINED_GROUPS, groupFeed: GROUP_FEED, comment: COMMENT,
    groupSearch: SEARCH, joinGroup: JOIN, createPost: POST_MUTATION,
    videoConfig: VIDEO_CFG, pageSearch: PAGE_SEARCH, pageFeed: PAGE_FEED,
    postComments: POST_COMMENTS, hideComment: HIDE_COMMENT, leaveGroup: LEAVE,
    activityLog: ACTIVITY_LOG,
  };
  for (const [key, target] of Object.entries(targets)) {
    const value = operations?.[key];
    if (!value || !/^\d{5,}$/.test(String(value.docId || ''))) continue;
    target.DOC_ID = String(value.docId);
    if (typeof value.friendlyName === 'string' && value.friendlyName.trim()) target.FRIENDLY_NAME = value.friendlyName.trim();
  }
}

self.ShopeFbApi = { fbFetchJoinedGroups, fbFetchGroupFeed, fbPostComment, fbSearchGroups, fbJoinGroup, fbCreateGroupPost, fbUploadPhoto, fbUploadVideo, fbSearchPages, fbFetchPageFeed, fbListPostComments, fbHideComment, fbLeaveGroup, fbFetchActivityLog, configureRuntime, FB_GRAPHQL_URL, _gql: gql };
