import { CheckOutlined, DownOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useMsal } from '@azure/msal-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dropdown,
  Flex,
  Layout,
  MenuProps,
  Segmented,
  theme as antTheme,
  Typography,
} from 'antd';
import { ItemType, MenuItemType } from 'antd/es/menu/interface';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ProductLogo } from '@src/assets/svg/ProductLogo';
import { MatchParams } from '@src/config/routing';
import { useLogoutSession } from '@src/hooks/react-query/v2/iam/internal/internal';
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
} from '@src/hooks/react-query/v2/iam/user/user';
import { Theme, useUserPreferencesStore } from '@src/hooks/zustand/useUserPreferencesStore';
import {
  removeLastVisitedApp,
  removeSelectedOrganization,
  setLastVisitedURL,
} from '@src/utilities/local-storage';
import { generateAppUrl, generateProfileUrl } from '@src/utilities/navigation';

import styles from './MainHeader.module.css';

export const MainHeader = () => {
  // Zustand
  const { theme, setTheme } = useUserPreferencesStore();

  // router
  const navigate = useNavigate();
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  // ant design
  const { token } = antTheme.useToken();

  // react query
  const { data: currentUser } = useGetCurrentUser();
  const { mutate: logoutSession } = useLogoutSession();
  const queryClient = useQueryClient();

  // msal
  const { instance: msalInstance } = useMsal();

  // We display a copy icon on hover of the org ids.
  const [hoveredUserOrgId, setHoveredUserOrgId] = useState<string | null>(null);
  const userOrgs: ItemType<MenuItemType>[] =
    currentUser?.organization_memberships.map((org) => ({
      key: org.id,
      icon: org.id === orgId ? <CheckOutlined /> : undefined,
      style: { backgroundColor: org.id === orgId ? token.colorBgTextHover : '', display: 'flex' },
      onClick: () => {
        navigate(`/orgs/${org.id}/projects`);
      },
      onMouseEnter: () => setHoveredUserOrgId(org.id),
      onMouseLeave: () => setHoveredUserOrgId(null),
      label: (
        // The copyable attribute expands the width of the row and makes the menu item flicker, so we add some artificial spacing for the non-hovered rows.
        <Typography.Text
          copyable={hoveredUserOrgId === org.id && { text: org.id }}
          style={{
            ...(hoveredUserOrgId !== org.id && { marginRight: token.size + token.lineWidth }),
          }}>
          {org.id}
        </Typography.Text>
      ),
    })) ?? [];

  const profileMenuItems: MenuProps['items'] = [
    {
      label: (
        <Flex vertical justify={'center'} align={'center'}>
          <span>{currentUser?.display_name}</span>
          <span style={{ fontSize: token.fontSizeSM, color: token.colorTextDescription }}>
            {currentUser?.primary_email_address}
          </span>
        </Flex>
      ),
      key: 'profile',
    },
    { key: 'divider1', type: 'divider' },
    {
      label: 'Switch organization',
      key: 'organization',
      className: styles.noSubMenuArrow,
      type: 'group',
      children: userOrgs,
    },
    { key: 'divider2', type: 'divider' },
    { label: 'Logout', key: 'logout' },
  ];

  const handleProfileMenuItemClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logoutSession(undefined, {
        onSuccess: async () => {
          // Clear MSAL cache
          msalInstance.clearCache();

          await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });

          // If the user has explicitly logged out, we must clear this local storage in anticipation of switching orgs
          // otherwise things can get weird on login.
          removeSelectedOrganization();
          setLastVisitedURL('/');
          removeLastVisitedApp();

          navigate('/auth/login');
        },
      });
    } else if (key === 'profile') {
      navigate(generateProfileUrl(orgId));
    }
  };

  const getHomeUrl = () => {
    if (orgId) {
      return generateAppUrl(orgId);
    } else if (currentUser?.organization_memberships[0]) {
      return generateAppUrl(currentUser?.organization_memberships[0].id);
    } else return '/auth/login';
  };

  return (
    <Layout.Header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: token.marginMD,
        borderBottom: `1px solid ${token.colorBorder}`,
        backgroundColor: token.colorBgLayout,
      }}>
      <Link className={'flex'} to={getHomeUrl()} title={'Home'}>
        <ProductLogo theme={theme} />
        {/* <span
          style={{
            fontWeight: 500,
            fontSize: 16,
            color: token.colorPrimary,
            letterSpacing: 0.5,
          }}>
          {windowEnv.PRODUCT_NAME}
        </span> */}
      </Link>
      <Flex align={'center'} justify={'flex-end'} flex={1} gap={'middle'}>
        <Segmented<Theme | null>
          value={theme}
          options={[
            { value: 'light', icon: <SunOutlined /> },
            { value: 'dark', icon: <MoonOutlined /> },
          ]}
          onChange={(value) => {
            if (value) {
              setTheme(value);
            }
          }}
        />

        {currentUser && (
          <Dropdown
            menu={{ items: profileMenuItems, onClick: handleProfileMenuItemClick }}
            trigger={['click']}>
            <Button
              variant={'outlined'}
              aria-label={'Profile menu'}
              size={'large'}
              icon={<DownOutlined />}
              iconPosition={'end'}>
              <Flex vertical align={'flex-start'}>
                <span style={{ fontSize: token.fontSize }}>{currentUser.display_name}</span>

                <span style={{ fontSize: token.fontSizeSM }}>
                  {orgId || 'No organization selected'}
                </span>
              </Flex>
            </Button>
          </Dropdown>
        )}
      </Flex>
    </Layout.Header>
  );
};
