// Shared ?page=&limit= handling for list endpoints (audit M3).
// Response shape: { data, page, limit, totalPages, totalCount }.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Reads page/limit from a query string. Anything that isn't a positive whole number
 * (missing, "abc", -3, an array) falls back to the default; limit is capped so a single
 * request can't ask for the whole collection.
 */
function parsePagination(query, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  const toPositiveInt = (value) => {
    const n = typeof value === "string" ? Number(value) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const page = toPositiveInt(query.page) || 1;
  const limit = Math.min(toPositiveInt(query.limit) || defaultLimit, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

function paginatedResponse(data, { page, limit }, totalCount) {
  return { data, page, limit, totalPages: Math.max(Math.ceil(totalCount / limit), 1), totalCount };
}

module.exports = { parsePagination, paginatedResponse, DEFAULT_LIMIT, MAX_LIMIT };
