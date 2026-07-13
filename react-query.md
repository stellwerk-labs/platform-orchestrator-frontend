# React query developer guide

This document is a brief introduction on the conventions we use in our project.

## Query keys & query key factories

- We define a query key so that it can be called from other places like mutation for invalidate cache or other purpose. That way we can modify the key without needing to update everywhere else.
- Query key is similar to dependency array in `useEffect`.

We generate our query keys based on the [query key factories concept](https://tkdodo.eu/blog/effective-react-query-keys#use-query-key-factories) found in the [Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) blog post.

Advantages

- Makes keys less error prone. Writing the keys manually in your query could lead to errors when invalidating - due to typos or changing the key structure.
- Reuse keys within the factory. Keeps the structure consistent.

Parameters can have types `string | undefined`. This is for 2 reasons:

- Route params could always be undefined. The query could be called under the wrong route, and the url param would not exist
- Sometimes we want to pass a parameter into the hook. Chances are that this could be undefined also.

Using `string | undefined` will ensure that Typescript will throw an error if you don't pass the parameter. It can still be undefined, we just won't have the ability to NOT pass the parameter.

## `useQuery` example

Assuming we want a query for a list of applications, and a single application. (`/orgs/${orgId}/apps` & `/orgs/${orgId}/apps/${projectId}`).

```typescript
// Apps query key factory
// Note: All query key factories may not be as straightforward as this. Refer to this and the blog b=pots above as a starting point.
// Some query key factories may have nested endpoints which may require some more explicit naming. Check some of the other existing query key factories if you are stuck.
const appsQueryKeyFactory = {
  // 'all' is the base on which to base all your query keys for this feature
  all: (orgId: string | undefined) => ['orgs', orgId, 'apps'],
  // Append 'list' to show that this is the list of apps i.e. `/orgs/${orgId}/apps` endpoint
  list: (orgId: string | undefined) => [...appsQueryKeyFactory.all(orgId), 'list'],
  // Append 'detail' & projectId to show that this is the detail of a specific application i.e. `/orgs/${orgId}/apps/${projectId}` endpoint
  detail: (orgId: string | undefined, projectId: string | undefined) => [
    ...appsQueryKeyFactory.all(orgId),
    'detail',
    projectId,
  ],
};
```

```typescript
// List Apps query
import type { QueryResponse } from '@src/hooks/queries/types';
import { makeRequest } from '@src/utilities/make-request';

const transformData = (data: ApplicationResponse): Application => {
  ...
};

const useAppsListQuery = (): QueryResponse<Application[], ApplicationResponse[]> => {
  // (1) (2)
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  const { data, ...queryResult } = useQuery({
    queryKey: appsQueryKeyFactory.list(orgId),
    queryFn: () => makeRequest<Application[]>('GET', `/orgs/${orgId}/apps`),
    enabled: Boolean(orgId),// (3)
  });

  const transformedData = transformData(data);

  return { ...queryResult, data: transformedData, responseData: data?.data }; // (4)
};

export default useAppsListQuery;
```

```typescript
// Single App query
import type { QueryResponse } from '@src/hooks/queries/types';
import { makeRequest } from '@src/utilities/make-request';

const transformData = (data: ApplicationResponse): Application => {
  ...
};

const useAppQuery = (): QueryResponse<Application, ApplicationResponse>=>{ // (1) (2)
  const { orgId, projectId } = useParams<keyof MatchParams>() as MatchParams;

  const { data, ...queryResult } = useQuery({
    queryKey: appsQueryKeyFactory.detail(orgId, projectId),
    queryFn: () => makeRequest<Application>('GET', `/orgs/${orgId}/apps/${projectId}`),
    enabled: Boolean(orgId && projectId) // (3)
  });

  const transformedData = transformData(data)

  return { ...queryResult, data: transformedData, responseData: data?.data }; // (4)
}

export default useAppQuery;
```

1. QueryResponse:

- It is a custom generic type created for useQuery in our app. It has two templates. First one is the type of the data after transformation. Second generic template is the type of the response from the makeRequest call.
- Second generic template is optional. If not passed, it is assumed that there is no transformation and the same data type is used for both `data` and `responseData` in the response

2. Custom hook

- Each query resides in a custom hook
- Data transfer stays in custom hook as much as possible
- If there is a special case where we need to do more transformation on existing transformed data OR if we need to do different transformation other than the default, it can be done in the component with the response object.

3. Enabled

- We should enable the query only if all parameters exist. This will stop the URL being called with an undefined parameter

4. QueryResult

- Entire query result of `useQuery` call is passed in the response along with transformedData and responseData
- If there is no transformation required, we can directly pass the entire return object of the `useQuery` call.

## `useMutation` example

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError, AxiosResponse, Method } from 'axios';
import { useParams } from 'react-router';

// the interface of the variables send to the mutation function
interface ApplicationCreateMutationVariables {
  application: Partial<Application>;
}

const useApplicationCreateMutation = () => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  const queryClient = useQueryClient();

  const { data, ...queryResult } = useMutation<
    AxiosResponse<Application>,
    AxiosError,
    ApplicationCreateMutationVariables
  >({
    mutationFn: ({ application }) => makeRequest('POST', `/orgs/${orgId}/apps`, application),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: appsQueryKeyFactory.list(orgId) });
    },
  });

  return { ...queryResult, data: data?.data };
};

export default useApplicationCreateMutation;
```

## Invalidating queries

When you need to invalidate queries, it may not be clear what you should invalidate. e.g. After updating an application, do I need to invalidate the list or the specific application detail? Best practice is to start at the detail level, and then see if you need to invalidate anything else. e.g. Is there a list of applications displayed somewhere? If yes, the list should be invalidated.

## Naming convention

When using a property from the query or the mutation (e.g `isLoading` or `error`), we should rename it to include the context about what it is used for.
e.g If we use the above query and mutation in our component, we would name the variables as follows:

```typescript
const AppsComponent = () => {
  ...
  const {
    mutate: createApplication,
    error: createApplicationError,
    isLoading: isCreatingApplication,
  } = useApplicationCreateMutation();

  const {
    data: apps,
    error: createAppsError,
    isLoading: isLoadingApps,
  } = useAppsListQuery();
  ...
});
```

## Testing

To test a component that is using a query, you should mock the response of the query using `msw`. The msw server is located [here](src/testing-utils/msw/mswServer.ts). You can import the server and add whatever endpoints you want to mock.

There are reusable functions defined within the [msw directory](src/testing-utils/msw) that can be used.

The server is started nbefore each test & cleaned up automatically in [setupTests file](src/setupTests.js).

- Example: testing a component that uses the `useUserQuery` from the example above:

```typescript
// @src/testing-utils/msw/user
export const mockUser = (userData) =>
  rest.get('*/user', (_, res, ctx) => {
    return res(ctx.json(userData));
  });

// Test file
import { server } from '@src/testing-utils/msw/mswServer';
import { mockUser } from '@src/testing-utils/msw/user';

it('Should do something with the user', async () => {
  server.use(mockUser({ name: 'Lebron James', hobbies: ['Basketball'] }));
  render(<UserComponent />);
  // ...test
});
```

To test a mutation, you should mock the mutation request using `msw` like it is done for queries.
Add a callback function that will be called with the mocked request data when the request is done.

In the test file you can use the callback function to assert if it has been called properly.

Alternatively you can assert if a new item has been added in the UI. e.g. a new row for the created user has been added.

- Example: testing a component that uses the `useUserCreateMutation` from the example above:

```typescript
// @src/testing-utils/msw/user
export const mockCreateUser = (callback) =>
  rest.post('*/user', async (req, res, ctx) => {
    callback(await req.json())
    return res(ctx.json(await req.json()));
  });

// Test file
import { server } from '@src/testing-utils/msw/mswServer';
import { mockCreateUser } from '@src/testing-utils/msw/user';

it('Should do something with the user', async () => {
  let createdUserResponse
  server.use(mockCreateUser({ name: 'Lebron James', hobbies: ['Basketball'] }, (requestJSON) => createdUserResponse = requestJSON));
  render(<UserComponent />);
  // ...add user
  expect(createdUserResponse).toEqual({
      name: 'Cristiano Ronaldo',
      hobbies: ['Football'],
    })
});
```

## Mocking endpoints with MSW

Most of the time for GET endpoints, you can use wildcards for the URLs.

Example:

```typescript
export const mockArtefacts = (artefacts: Artefact[]) =>
  rest.get('*/orgs/*/artefacts', (_, res, ctx) => {
    return res(ctx.json(artefacts));
  });
```

This way, you don't have to worry about what the orgId is. Any id will be matched. If you need to add specific responses for certain ids, you can modify your function to accept optional URL params. If the param is provided, it will use it, otherwise a wildcard will be used.

```typescript
export const mockArtefacts = (artefacts: Artefact[], params?: { orgId?: string }) => {
  const { orgId = '*' } = params || {};

  return rest.get(`*/orgs/${orgId}/artefacts`, (_, res, ctx) => {
    return res(ctx.json(artefacts));
  });
};
```

## Specific Usage Guides

### Roles

To perform mutations on roles refer to [this guide](`src/hooks/react-query/roles/mutations/guide_to_mutations.md`).
