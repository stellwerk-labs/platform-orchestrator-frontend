import { useSearchParams } from 'react-router';

type URLParamNames = 'code' | 'inviteToken' | 'redirect';

export const useGetUrlParam = (paramName: URLParamNames): string | null => {
  const [searchParams] = useSearchParams();
  return searchParams.get(paramName);
};
