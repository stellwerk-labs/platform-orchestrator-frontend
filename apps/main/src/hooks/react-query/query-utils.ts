/**
 * builds query param string from a filters object
 *
 * @param filters
 */
export const buildQueryString = <T>(filters?: T) => {
  let query = '';

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        query += `${query ? '&' : `?`}${key}=${value.join(`&${key}=`)}`;
      }
    } else if (value) {
      query += `${query ? `&` : `?`}${key}=${value}`;
    }
  });

  return query;
};
