import { useEffect } from 'react';

import { windowEnv } from '@src/config/environment';

interface HTMLDocumentTitle {
  title?: string;
}
export const HTMLDocumentTitle = ({ title }: HTMLDocumentTitle) => {
  useEffect(() => {
    document.title = `${title ? title : windowEnv.PRODUCT_NAME}`;
  }, [title]);

  return null;
};
