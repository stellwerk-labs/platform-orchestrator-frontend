import { createBrowserRouter } from 'react-router';

import { App as AppRoot } from '@src/AppRoot';
import { MainLayout } from '@src/components/shared/MainLayout';
import { PrivateRoute } from '@src/components/shared/PrivateRoute';
import { PublicRoute } from '@src/components/shared/PublicRoute';
import { SaasRoute } from '@src/components/shared/SaasRoute';
import { Auth } from '@src/containers/Auth/Auth';
import { Login } from '@src/containers/Auth/containers/Login';
import { Register } from '@src/containers/Auth/containers/Register/Register';
import { SsoCallback } from '@src/containers/Auth/containers/SsoCallback';
import { SsoLogin } from '@src/containers/Auth/containers/SsoLogin';
import { Device } from '@src/containers/Device';
import { AcceptInvite } from '@src/containers/Orgs/AcceptInvite';
import { Orgs } from '@src/containers/Orgs/Orgs';
import { ResourceGraphFullPage } from '@src/containers/ResourceGraphFullPage/ResourceGraphFullPage';
import { RedirectRoot } from '@src/RedirectRoot';

import { orgRoutes } from './org-routes';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppRoot />,
    children: [
      {
        path: '/orgs/:orgId',
        element: (
          <PrivateRoute>
            <Orgs />
          </PrivateRoute>
        ),
        children: orgRoutes,
      },
      {
        path: '/',
        element: <RedirectRoot />,
      },
      {
        path: '*',
        element: <RedirectRoot />,
        handle: { isWildcard: true },
      },
      {
        path: '/orgs/:orgId/projects/:projectId/envs/:envId/resource-graph',
        element: (
          <PrivateRoute>
            <ResourceGraphFullPage />
          </PrivateRoute>
        ),
      },
      {
        path: 'auth',
        element: <Auth />,
        children: [
          {
            path: 'login',
            element: (
              <PublicRoute>
                <Login />
              </PublicRoute>
            ),
          },
          {
            path: 'register',
            element: (
              <SaasRoute>
                <PublicRoute>
                  <Register />
                </PublicRoute>
              </SaasRoute>
            ),
          },
          {
            path: 'sso/callback',
            element: (
              <PublicRoute>
                <SsoCallback />
              </PublicRoute>
            ),
          },
        ],
      },
      {
        path: 'sso',
        element: <Auth />,
        children: [
          {
            path: ':orgId',
            element: (
              <PublicRoute>
                <SsoLogin />
              </PublicRoute>
            ),
          },
        ],
      },
      {
        path: 'accept-invite',
        element: (
          <SaasRoute>
            <AcceptInvite />
          </SaasRoute>
        ),
      },
      {
        path: 'devicelogins/:deviceLoginCode',
        element: (
          <PrivateRoute>
            <MainLayout>
              <Device />
            </MainLayout>
          </PrivateRoute>
        ),
      },
    ],
  },
]);
