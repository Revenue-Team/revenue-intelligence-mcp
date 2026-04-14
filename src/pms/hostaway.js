const API_BASE = 'https://api.hostaway.com/v1';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Acquire an OAuth2 access token using client credentials.
 * Caches the token and refreshes 60s before expiry.
 */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const { HOSTAWAY_CLIENT_ID, HOSTAWAY_CLIENT_SECRET } = process.env;
  if (!HOSTAWAY_CLIENT_ID || !HOSTAWAY_CLIENT_SECRET) {
    throw new Error('Missing HOSTAWAY_CLIENT_ID or HOSTAWAY_CLIENT_SECRET environment variables.');
  }

  const res = await fetch(`${API_BASE}/accessTokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: HOSTAWAY_CLIENT_ID,
      client_secret: HOSTAWAY_CLIENT_SECRET,
      scope: 'general',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to authenticate with HostAway (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  return cachedToken;
}

// --- Rate limiter: max 1 request per second ---
let lastRequestTime = 0;

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Make an authenticated GET request to the HostAway API.
 * Handles rate limiting and retries on 429.
 */
async function apiGet(path, query = {}) {
  await throttle();
  const token = await getAccessToken();
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
    });

    if (res.status === 429) {
      const waitSec = Math.pow(2, attempt + 1);
      console.error(`Rate limited by HostAway. Waiting ${waitSec}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HostAway API ${path} failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    return data;
  }

  throw new Error(`HostAway API ${path}: rate limited after 3 retries`);
}

// --- Normalization ---

function normalizeListing(raw) {
  return {
    id: String(raw.id),
    name: raw.name || '',
    address: [raw.address, raw.city, raw.country].filter(Boolean).join(', '),
    bedrooms: raw.bedrooms ?? 0,
    maxGuests: raw.maxGuests ?? 0,
    basePrice: raw.price ?? 0,
  };
}

function normalizeReservation(raw) {
  return {
    id: String(raw.id),
    listingId: String(raw.listingMapId),
    listingName: raw.listingName || '',
    arrivalDate: raw.arrivalDate?.slice(0, 10) || '',
    departureDate: raw.departureDate?.slice(0, 10) || '',
    nights: raw.nights || 0,
    totalRevenue: raw.totalPrice || 0,
    status: raw.status === 'cancelled' ? 'cancelled' : 'confirmed',
    channel: raw.channelName || 'unknown',
    guestName: raw.guestName || '',
  };
}

// --- Public interface ---

export async function getListings() {
  const data = await apiGet('/listings');
  const results = data.result || [];
  return results.map(normalizeListing);
}

/**
 * Fetch all reservations for a date range. Paginates using afterId.
 * Optionally filter to a single listing.
 * Returns all non-cancelled reservations by default.
 */
export async function getReservations(startDate, endDate, listingId = null) {
  const allReservations = [];
  let afterId = null;
  const limit = 100;

  while (true) {
    const query = {
      limit,
      arrivalStartDate: startDate,
      arrivalEndDate: endDate,
      sortOrder: 'asc',
    };
    if (listingId) query.listingId = listingId;
    if (afterId) query.afterId = afterId;

    const data = await apiGet('/reservations', query);
    const results = data.result || [];

    if (results.length === 0) break;

    allReservations.push(...results);
    afterId = results[results.length - 1].id;

    if (results.length < limit) break;
  }

  return allReservations
    .map(normalizeReservation)
    .filter(r => r.status !== 'cancelled');
}

/**
 * Fetch reservations including cancelled ones (for list_reservations tool).
 */
export async function getReservationsAll(startDate, endDate, listingId = null) {
  const allReservations = [];
  let afterId = null;
  const limit = 100;

  while (true) {
    const query = { limit, sortOrder: 'asc' };
    if (startDate) query.arrivalStartDate = startDate;
    if (endDate) query.arrivalEndDate = endDate;
    if (listingId) query.listingId = listingId;
    if (afterId) query.afterId = afterId;

    const data = await apiGet('/reservations', query);
    const results = data.result || [];

    if (results.length === 0) break;

    allReservations.push(...results);
    afterId = results[results.length - 1].id;
    if (results.length < limit) break;
  }

  return allReservations.map(normalizeReservation);
}
