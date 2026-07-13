import {
  ApiOutlined,
  AppstoreOutlined,
  BookOutlined,
  CodeOutlined,
  ContainerOutlined,
  CustomerServiceOutlined,
  DeploymentUnitOutlined,
  ExclamationCircleOutlined,
  HddOutlined,
  MailOutlined,
  ReconciliationOutlined,
  RobotOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Flex, Layout, Menu, theme } from 'antd';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import { KeyboardEvent, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { windowEnv } from '@src/config/environment';
import { MatchParams } from '@src/config/routing';
import { useGetCurrentUser } from '@src/hooks/react-query/v2/iam/user/user';
import { getNavigationMenuMinimized } from '@src/utilities/local-storage';
import {
  generateEnvironmentTypesUrl,
  generateModulesUrl,
  generateOrgMembersUrl,
  generateProjectsUrl,
  generateProvidersUrl,
  generateResourceTypesUrl,
  generateRunnersUrl,
  generateServiceUsersUrl,
} from '@src/utilities/navigation';

const NavigationBar = () => {
  const [collapsed, setCollapsed] = useState<boolean>(getNavigationMenuMinimized);
  const location = useLocation();

  const { orgId: routerOrgId } = useParams<keyof MatchParams>() as MatchParams;

  const { data: user } = useGetCurrentUser();

  const orgId = routerOrgId ? routerOrgId : user?.organization_memberships?.[0]?.id;

  // Ant design token
  const { token } = theme.useToken();

  const screens = useBreakpoint();
  const isSmallScreen = !screens.lg;

  useEffect(() => {
    if (isSmallScreen) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [isSmallScreen]);

  const handleMenuItemKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.querySelector('a')?.click();
    }
  };

  return (
    <Layout.Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
      <Flex vertical justify={'space-between'} style={{ height: '100%', overflow: 'auto' }}>
        {orgId && (
          <Menu
            defaultSelectedKeys={['1']}
            mode={'vertical'}
            style={{ padding: `${token.paddingMD}px 0`, border: 0 }}
            tabIndex={-1}
            selectedKeys={location.pathname.split('/')}>
            <Menu.Item
              key={'projects'}
              icon={<AppstoreOutlined />}
              tabIndex={0}
              onKeyDown={handleMenuItemKeyDown}>
              <Link to={generateProjectsUrl(orgId)} tabIndex={-1}>
                Projects
              </Link>
            </Menu.Item>

            <Menu.Item
              key={'modules'}
              icon={<ApiOutlined />}
              tabIndex={0}
              onKeyDown={handleMenuItemKeyDown}>
              <Link to={generateModulesUrl(orgId)} tabIndex={-1}>
                Modules
              </Link>
            </Menu.Item>

            <Menu.Item
              key={'resource-types'}
              icon={<DeploymentUnitOutlined />}
              tabIndex={0}
              onKeyDown={handleMenuItemKeyDown}>
              <Link to={generateResourceTypesUrl(orgId)} tabIndex={-1}>
                Resource Types
              </Link>
            </Menu.Item>

            <Menu.Item
              key={'runners'}
              icon={<HddOutlined />}
              tabIndex={0}
              onKeyDown={handleMenuItemKeyDown}>
              <Link to={generateRunnersUrl(orgId)} tabIndex={-1}>
                Runners
              </Link>
            </Menu.Item>

            <Menu.Item
              key={'providers'}
              icon={<ReconciliationOutlined />}
              tabIndex={0}
              onKeyDown={handleMenuItemKeyDown}>
              <Link to={generateProvidersUrl(orgId)} tabIndex={-1}>
                Providers
              </Link>
            </Menu.Item>

            <Menu.Item
              key={'environment-types'}
              icon={<ContainerOutlined />}
              tabIndex={0}
              onKeyDown={handleMenuItemKeyDown}>
              <Link to={generateEnvironmentTypesUrl(orgId)} tabIndex={-1}>
                Environment Types
              </Link>
            </Menu.Item>

            <Menu.Item
              key={'members'}
              icon={<TeamOutlined />}
              tabIndex={0}
              onKeyDown={handleMenuItemKeyDown}>
              <Link to={generateOrgMembersUrl(orgId)} tabIndex={-1}>
                Memberships
              </Link>
            </Menu.Item>

            <Menu.Item
              key={'service-users'}
              icon={<RobotOutlined />}
              tabIndex={0}
              onKeyDown={handleMenuItemKeyDown}>
              <Link to={generateServiceUsersUrl(orgId)} tabIndex={-1}>
                Service Users
              </Link>
            </Menu.Item>
          </Menu>
        )}

        <div>
          <Menu
            mode={'vertical'}
            style={{ padding: 0, border: 0, marginBottom: 0 }}
            tabIndex={-1}
            inlineIndent={24}
            selectedKeys={[]}>
            {windowEnv.DOCS_URL && (
              <Menu.Item
                key={'documentation'}
                icon={<CodeOutlined />}
                tabIndex={0}
                onKeyDown={handleMenuItemKeyDown}>
                <a
                  tabIndex={-1}
                  href={windowEnv.DOCS_URL}
                  target={'_blank'}
                  rel={'noreferrer noopener'}>
                  Documentation
                </a>
              </Menu.Item>
            )}

            {windowEnv.TUTORIAL_URL && (
              <Menu.Item
                key={'tutorial'}
                icon={<BookOutlined />}
                tabIndex={0}
                onKeyDown={handleMenuItemKeyDown}>
                <a
                  tabIndex={-1}
                  href={windowEnv.TUTORIAL_URL}
                  target={'_blank'}
                  rel={'noreferrer noopener'}>
                  Tutorial
                </a>
              </Menu.Item>
            )}
          </Menu>
          {(windowEnv.SUPPORT_URL || windowEnv.STATUS_URL) && (
            <Menu
              mode={'vertical'}
              style={{ padding: 0, border: 0, marginBottom: 0 }}
              items={[
                {
                  key: 'support',
                  label: 'Support',
                  icon: <CustomerServiceOutlined />,
                  children: [
                    ...(windowEnv.SUPPORT_URL
                      ? [
                          {
                            key: 'contact',
                            label: (
                              <a
                                href={windowEnv.SUPPORT_URL}
                                target={'_blank'}
                                rel={'noreferrer noopener'}>
                                Contact Us
                              </a>
                            ),
                            icon: <MailOutlined />,
                          },
                        ]
                      : []),
                    ...(windowEnv.STATUS_URL
                      ? [
                          {
                            key: 'status',
                            label: (
                              <a
                                href={windowEnv.STATUS_URL}
                                target={'_blank'}
                                rel={'noreferrer noopener'}>
                                Status
                              </a>
                            ),
                            icon: <ExclamationCircleOutlined />,
                          },
                        ]
                      : []),
                  ],
                },
              ]}
            />
          )}
          {windowEnv.VERSION && (
            <div
              style={{
                padding: `${token.paddingXS}px ${token.paddingLG}px ${token.paddingSM}px`,
                color: token.colorTextSecondary,
                fontSize: token.fontSizeSM,
                overflow: 'hidden',
                height: '35px',
              }}>
              {!collapsed && windowEnv.VERSION}
            </div>
          )}
        </div>
      </Flex>
    </Layout.Sider>
  );
};

export { NavigationBar };
