import Axios, { AxiosError, AxiosRequestConfig } from 'axios';
import qs from 'qs';

import { windowEnv } from './config/environment';

export const AXIOS_INSTANCE = Axios.create({
  baseURL: windowEnv.BASE_URL,
  paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
});

// add a second `options` argument here if you want to pass extra options to each generated query
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const isLocal = windowEnv.BASE_URL.includes('localhost');
  const source = Axios.CancelToken.source();

  const headers: Record<string, string> = {};

  if (isLocal) {
    headers.From = 'x';
  }

  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    headers,
    withCredentials: !isLocal,
    cancelToken: source.token,
  }).then(({ data }) => data);

  return promise;
};

// In some case with react-query and swr you want to be able to override the return error type so you can also do it here like this
export type ErrorType<Error> = AxiosError<Error>;
