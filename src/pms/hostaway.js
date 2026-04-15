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

// --- Rate limiter: stay under Hostaway's 15 req / 10 sec limit ---
let lastRequestTime = 0;

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 700) {
    await new Promise(resolve => setTimeout(resolve, 700 - elapsed));
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
    // Abort the request if it hangs longer than 60s. Without this, cancelled
    // MCP requests leave fetch() running in the background, and a delayed
    // response with a huge payload can OOM the Node process.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    let res;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`HostAway API ${path} timed out after 60s`);
      }
      throw err;
    }
    clearTimeout(timeoutId);

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

// --- In-memory cache for listings (refreshed every 5 min) ---
let listingsCache = null;
let listingsCacheExpiry = 0;

// --- Normalization ---

function normalizeListing(raw) {
  return {
    id: String(raw.id),
    name: raw.name || '',
    // Internal naming code (e.g. "AT_VIE_Duschel_01_00_01_W"). Reservations
    // report this as listingName, so we keep it separately for ID lookups.
    internalName: raw.internalListingName || '',
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
    bookingDate: raw.reservationDate?.slice(0, 10) || '',
    nights: raw.nights || 0,
    totalRevenue: raw.totalPrice || 0,
    status: raw.status === 'cancelled' ? 'cancelled' : 'confirmed',
    channel: raw.channelName || 'unknown',
    guestName: raw.guestName || '',
  };
}

// --- Public interface ---

/**
 * Fetch ALL listings, with pagination. Cached for 5 minutes since listings
 * rarely change and every tool needs them.
 */
export async function getListings() {
  if (listingsCache && Date.now() < listingsCacheExpiry) {
    return listingsCache;
  }

  const allListings = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const data = await apiGet('/listings', { limit, offset });
    const results = data.result || [];

    allListings.push(...results);

    if (results.length < limit) break;
    offset += limit;
  }

  listingsCache = allListings.map(normalizeListing);
  listingsCacheExpiry = Date.now() + 5 * 60 * 1000;
  return listingsCache;
}

/**
 * Resolve a user-supplied listing identifier to a numeric Hostaway listing ID.
 * Accepts either a numeric ID (returned as-is) or a unit name (looked up in
 * the cached listings, case-insensitive exact match).
 *
 * Throws a clear error if the name cannot be resolved.
 *
 * @param {string} idOrName — numeric ID or unit name
 * @returns {Promise<string>} numeric listing ID
 */
export async function resolveListingId(idOrName) {
  if (idOrName == null || idOrName === '') return null;

  // Numeric (or numeric-string) IDs pass through unchanged.
  if (/^\d+$/.test(String(idOrName))) return String(idOrName);

  // Otherwise treat as a name and resolve via cached listings.
  // Match against either the user-facing name or the internal naming code,
  // since reservations and listings use different name fields.
  const listings = await getListings();
  const target = String(idOrName).toLowerCase();
  const match = listings.find(l =>
    l.name.toLowerCase() === target ||
    l.internalName.toLowerCase() === target
  );

  if (match) return match.id;

  // Suggest near-matches so the user gets a useful error.
  const suggestions = listings
    .filter(l => {
      const internal = l.internalName.toLowerCase();
      const friendly = l.name.toLowerCase();
      const prefix = target.slice(0, 6);
      return internal.includes(prefix) || friendly.includes(prefix);
    })
    .slice(0, 5)
    .map(l => l.internalName || l.name);
  const hint = suggestions.length
    ? ` Did you mean: ${suggestions.join(', ')}?`
    : '';
  throw new Error(`Listing "${idOrName}" not found.${hint}`);
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
      includeResources: false,
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
 * Fetch a limited number of reservations (no full pagination).
 * Used by list_reservations to avoid fetching thousands of records
 * when only a few are needed.
 */
export async function getReservationsPage(startDate, endDate, { listingId, limit = 25, includeCancelled = false } = {}) {
  const query = {
    limit,
    sortOrder: 'desc',
    includeResources: false,
  };
  if (startDate) query.arrivalStartDate = startDate;
  if (endDate) query.arrivalEndDate = endDate;
  if (listingId) query.listingId = listingId;

  const data = await apiGet('/reservations', query);
  const results = (data.result || []).map(normalizeReservation);

  if (includeCancelled) return results;
  return results.filter(r => r.status !== 'cancelled');
}

/**
 * Fetch reservations filtered by booking creation date.
 *
 * The Hostaway API has no server-side filter for reservationDate (creation date).
 * We use modifiedFrom/modifiedTo as a server-side approximation (new bookings are
 * always "modified" at creation), then filter client-side by the actual reservationDate.
 */
export async function getReservationsByBookingDate(startDate, endDate, { listingId, limit = 100, includeCancelled = false } = {}) {
  // Fetch one page of recently modified reservations. Use a full page size (100)
  // regardless of the caller's limit — small page sizes cause unnecessary pagination.
  // Client-side filter narrows to actual booking creation date.
  const query = {
    limit: 100,
    modifiedFrom: startDate,
    modifiedTo: endDate,
    sortOrder: 'desc',
    includeResources: false,
  };
  if (listingId) query.listingId = listingId;

  const data = await apiGet('/reservations', query);
  const results = data.result || [];

  let normalized = results
    .map(normalizeReservation)
    .filter(r => r.bookingDate >= startDate && r.bookingDate <= endDate);

  if (!includeCancelled) {
    normalized = normalized.filter(r => r.status !== 'cancelled');
  }

  return normalized;
}
