import { useQueryClient } from '@tanstack/react-query';
import { theme } from 'antd';
import { isAxiosError } from 'axios';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';

import { customInstance } from '@src/custom-instance';
import { removeLastVisitedApp, removeSelectedOrganization } from '@src/utilities/local-storage';

import { type BrowserSession, SessionRejectedError, startBrowserSession } from './browserSession';
import { sessionCheckMask } from './sessionCheckMask';

const SessionActivityContext = createContext<() => void>(() => undefined);
export const useSessionActivity = () => useContext(SessionActivityContext);

export const SessionGuard = ({
  children,
  onExpired,
}: {
  children: ReactNode;
  onExpired: () => void;
}) => {
  const { token } = theme.useToken();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isPublic =
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/sso/') ||
    pathname.startsWith('/accept-invite');
  const [active, setActive] = useState(false);
  const [verified, setVerified] = useState(false);
  const report = useRef<() => void>(() => undefined);
  const expired = useRef(onExpired);
  expired.current = onExpired;

  useEffect(() => {
    if (isPublic) {
      setVerified(false);
      setActive(false);
      return;
    }
    const controller = startBrowserSession({
      request: async (activity, signal) => {
        try {
          return await customInstance<BrowserSession>({
            url: activity ? '/auth/session/activity' : '/auth/session',
            method: activity ? 'POST' : 'GET',
            headers: activity ? { 'X-Session-Activity': '1' } : undefined,
            signal,
            timeout: 10_000,
          });
        } catch (error) {
          if (isAxiosError(error) && error.response?.status === 401)
            throw new SessionRejectedError();
          throw error;
        }
      },
      onChecking: () => setActive(false),
      onActive: () => {
        setVerified(true);
        setActive(true);
      },
      onExpired: () => {
        setActive(false);
        setVerified(false);
        expired.current();
        void queryClient.cancelQueries();
        queryClient.clear();
        removeSelectedOrganization();
        removeLastVisitedApp();
        navigate('/auth/login?reason=session-expired', { replace: true });
      },
    });
    report.current = controller.activity;
    return () => {
      report.current = () => undefined;
      controller.stop();
    };
  }, [isPublic, navigate, queryClient]);

  return (
    <SessionActivityContext.Provider value={() => report.current()}>
      {isPublic ? (
        children
      ) : (
        <>
          {verified && <div style={{ display: active ? 'contents' : 'none' }}>{children}</div>}
          {!active &&
            createPortal(
              <div
                id={'stellwerk-session-check'}
                role={'status'}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: token.colorBgLayout,
                  color: token.colorText,
                  display: 'grid',
                  placeContent: 'center',
                  zIndex: 2147483647,
                }}>
                <style>{sessionCheckMask}</style>
                Checking session…
              </div>,
              document.body,
            )}
        </>
      )}
    </SessionActivityContext.Provider>
  );
};
