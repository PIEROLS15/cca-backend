const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const getPaginationParams = (query = {}) => {
  const page = toPositiveInt(query.page, DEFAULT_PAGE);
  const rawLimit = toPositiveInt(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(rawLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

const buildPaginationResult = ({ docs, total, page, limit }) => {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const safePage = Math.min(page, totalPages);
  const hasPrevPage = safePage > 1;
  const hasNextPage = safePage < totalPages;

  return {
    docs,
    total,
    limit,
    totalPages,
    page: safePage,
    pagingCounter: (safePage - 1) * limit + 1,
    hasPrevPage,
    hasNextPage,
    prevPage: hasPrevPage ? safePage - 1 : null,
    nextPage: hasNextPage ? safePage + 1 : null,
  };
};

module.exports = {
  getPaginationParams,
  buildPaginationResult,
};
