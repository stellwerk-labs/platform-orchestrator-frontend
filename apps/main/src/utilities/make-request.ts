import axios, { AxiosResponse, GenericAbortSignal, Method, RawAxiosRequestHeaders } from 'axios';

import { windowEnv } from '@src/config/environment';

// This wire name is retained for compatibility with the existing API contract.
const AgentHeader = 'Humanitec-User-Agent';

/**
 * function to send a Http request to the API
 *
 * @param method - Http verb of the request (GET,POST,PUT,...)
 * @param url - url endpoint to send request to e.g ‘contacts’
 * @param body - data of the request
 * @param absoluteURL - if false, BE API base URL will be added. Otherwise, it will be the url specified. This should only be set to true when calling an external endpoint.
 * @param contentType - Optional content type of the request. Defaults to 'application/json'.
 * @param etag - Optional ETag value to send in the If-Match header.
 * @returns response of the request or error
 */
export const makeRequest = <T = unknown>(
  method: Method,
  url: string,
  data?: unknown,
  absoluteURL?: boolean,
  signal?: GenericAbortSignal,
  contentType?: string,
  etag?: string,
  accept?: string,
): Promise<AxiosResponse<T>> => {
  const headers: RawAxiosRequestHeaders = {};
  if (!absoluteURL) {
    url = `${windowEnv.BASE_URL}${url}`;
    const id = `frontend/${windowEnv.VERSION}`;
    headers[AgentHeader] = `app ${id}; sdk ${id}`;
  }

  if (etag) {
    headers['If-Match'] = etag;
  }

  const config = {
    data,
    headers: {
      'Content-Type': contentType || 'application/json',
      Accept: accept,
      ...headers,
    },
    method,
    url,
    // If the URL is absolute(it's an external URL, so cookie should not be sent)
    withCredentials: !absoluteURL,
    signal,
  };

  return axios.request(config);
};
