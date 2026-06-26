// shopee.js — tìm sản phẩm Shopee + dựng link tiếp thị liên kết (chạy trong service worker).
// Không cần Open API: search qua tab shopee.vn thật (đăng nhập) + tự ghép tham số affiliate.
'use strict';

// Dựng link hoa hồng theo tài liệu Shopee (help.shopee.vn/portal/10/article/172955):
//   https://s.shopee.vn/an_redir?origin_link={URL_đã_encode}&affiliate_id={ID}&sub_id={v1-v2-v3-v4-v5}
// Chưa cấu hình affiliate_id → trả link sản phẩm trần (vẫn dùng được, nhưng KHÔNG có hoa hồng).
function buildAffiliateLink(productUrl, affiliateId, subId) {
  if (!productUrl) return null;
  const id = String(affiliateId || '').trim();
  if (!id) return productUrl;
  let link = `https://s.shopee.vn/an_redir?origin_link=${encodeURIComponent(productUrl)}&affiliate_id=${encodeURIComponent(id)}`;
  const sid = String(subId || '').trim();
  if (sid) link += `&sub_id=${encodeURIComponent(sid)}`;
  return link;
}

// Tìm sản phẩm trên Shopee qua tab thật (tránh chặn bot: origin/cookie phiên user).
// runInShopeeTab(url, method, body, headers) → text (giống runFetchInFbTab).
// Trả [{ shopid, itemid, name, price, sold, rating, productUrl }] đã sắp theo độ liên quan.
async function searchShopee(runInShopeeTab, keyword, limit = 10) {
  const kw = String(keyword || '').trim();
  if (!kw) return [];
  const n = Math.min(Math.max(limit | 0, 1), 40);
  const url = `https://shopee.vn/api/v4/search/search_items`
    + `?by=relevancy&keyword=${encodeURIComponent(kw)}&limit=${n}`
    + `&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`;

  const text = await runInShopeeTab(url, 'GET', null, {
    'x-api-source': 'pc',
    'x-shopee-language': 'vi',
    'x-requested-with': 'XMLHttpRequest',
    'referer': `https://shopee.vn/search?keyword=${encodeURIComponent(kw)}`,
  });

  let j;
  try { j = JSON.parse(text); }
  catch { throw new Error('Shopee trả về không phải JSON (có thể bị chặn / cần đăng nhập lại)'); }
  if (j && j.error) throw new Error(`Shopee error ${j.error}${j.error_msg ? ': ' + j.error_msg : ''}`);

  const items = Array.isArray(j?.items) ? j.items : [];
  return items.map(it => {
    const b = it.item_basic || it;
    const shopid = b.shopid, itemid = b.itemid;
    if (!shopid || !itemid) return null;
    return {
      shopid, itemid,
      name: b.name || '',
      price: (b.price || 0) / 100000,          // Shopee lưu giá = VND * 100000
      sold: b.historical_sold ?? b.sold ?? 0,
      rating: b.item_rating?.rating_star ?? 0,
      productUrl: `https://shopee.vn/product/${shopid}/${itemid}`,
    };
  }).filter(Boolean);
}

self.ShopeShopee = { buildAffiliateLink, searchShopee };
