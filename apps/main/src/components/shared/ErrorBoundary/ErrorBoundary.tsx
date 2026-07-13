import React, { ReactNode } from 'react';
import { Translation } from 'react-i18next';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { isLocal } from '@src/config/features';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: any) {
    super(props);
    this.state = { ...this.state, hasError: false };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch() {
    if (isLocal) return;

    const errorCount = Number(localStorage.getItem('errorCount'));
    if (!errorCount || errorCount <= 3) {
      localStorage.setItem('errorCount', (errorCount + 1).toString());
      window.location.reload(); // reload the page if there is an error
    }
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        this.props.fallback || (
          <Translation>
            {(t) => (
              <ErrorPage
                title={t('ERROR.SOMETHING_WENT_WRONG') as string}
                descriptionTexts={[t('ERROR.PAGE_COULDNT_BE_LOADED') as string]}
              />
            )}
          </Translation>
        )
      );
    }
    return this.props.children;
  }
}
