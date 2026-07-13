import { Breadcrumb, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { BreadcrumbItem } from '@src/hooks/useBreadcrumbs';

interface NewBreadcrumbsProps {
  crumbs: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs = ({ crumbs, className }: NewBreadcrumbsProps) => {
  const { t } = useTranslation();
  const uiTranslations = t('UI');

  // Ant design token
  const { token } = theme.useToken();

  return (
    <nav
      className={className}
      aria-label={uiTranslations.BREADCRUMBS}
      style={{
        padding: `${token.paddingSM}px ${token.paddingXL}px`,
        backgroundColor: token.colorBgLayout,
      }}>
      <Breadcrumb
        items={crumbs.map((crumb, index) =>
          crumbs.length === 0
            ? { title: `${crumb.name}` }
            : {
                title:
                  crumb.pathname && index !== crumbs.length - 1 ? (
                    <Link to={crumb.pathname}>{crumb.name}</Link>
                  ) : (
                    crumb.name
                  ),
              },
        )}
      />
    </nav>
  );
};
