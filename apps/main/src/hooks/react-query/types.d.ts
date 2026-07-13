import { UseQueryResult } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';

/**
 * Provides type for custom hooks used for react-query. It has all values returned by `useQuery` along with `data` replaced by transformed data
 * and `responseData` is the original response
 *
 * @template T type of the transformed data
 * @template U type of response object returned by AxiosResponse . It is the type passed to makeRequest generic.
 * If its not passed, it is assumed that there is no transformation after calling useQuery and the same type is used for both
 */
interface QueryResponse<T, U = T> extends Omit<UseQueryResult<AxiosResponse<U>>, 'data'> {
  data: T | undefined;
  responseData?: U | undefined;
}
