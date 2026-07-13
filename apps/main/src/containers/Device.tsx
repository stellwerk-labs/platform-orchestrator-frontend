import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Descriptions,
  DescriptionsProps,
  Result,
  Space,
  Spin,
  theme,
  Typography,
} from 'antd';
import { useParams } from 'react-router';

import { DOCS_CLI } from '@src/config/docs-links';
import { MatchParams } from '@src/config/routing';
import {
  useAcceptDeviceLoginRequest,
  useGetDeviceLoginRequest,
  useRejectDeviceLoginRequest,
} from '@src/hooks/react-query/v2/iam/device/device';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

const { Paragraph } = Typography;

export const Device = () => {
  const { deviceLoginCode } = useParams<keyof MatchParams>() as MatchParams;

  const { data: loginRequest, isLoading: isLoginRequestLoading } =
    useGetDeviceLoginRequest(deviceLoginCode);
  const {
    mutate: acceptLogin,
    isSuccess: isLoginRequestAccepted,
    error: acceptLoginRequestError,
  } = useAcceptDeviceLoginRequest();
  const {
    mutate: rejectLogin,
    isSuccess: isLoginRequestRejected,
    error: rejectLoginRequestError,
  } = useRejectDeviceLoginRequest();

  const { token } = theme.useToken();

  const acceptOrRejectError = acceptLoginRequestError || rejectLoginRequestError;

  if (isLoginRequestLoading) {
    return <Spin />;
  }

  const items: DescriptionsProps['items'] = [
    {
      key: '1',
      label: 'Requested at',
      children: formatDate(
        loginRequest?.created_at,
        DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE,
      ),
    },
    {
      key: '2',
      label: 'Expires at',
      children: formatDate(
        loginRequest?.expires_at,
        DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE,
      ),
    },
    {
      key: '3',
      label: 'User Agent',
      children: loginRequest?.user_agent,
    },
    {
      key: '4',
      label: 'IP',
      children: loginRequest?.client_ip,
    },
    {
      key: '5',
      label: 'Region',
      children: loginRequest?.client_region,
    },
    {
      key: '6',
      label: 'City',
      children: loginRequest?.client_city,
    },
  ];

  if (!loginRequest || !loginRequest.id) {
    return (
      <Result
        status={'info'}
        title={'Not Found'}
        subTitle={'This login request could not be found.'}
        extra={
          <Button type={'primary'} href={'/'}>
            Go Home
          </Button>
        }
      />
    );
  }

  const notAcceptedOrRejected = !(isLoginRequestAccepted || isLoginRequestRejected);

  return (
    loginRequest && (
      <Card
        title={'Login Request'}
        style={{ maxWidth: 800, margin: '0 auto', marginTop: token.marginMD }}>
        <Paragraph>A new device is attempting to authenticate with your account.</Paragraph>
        <Space direction={'vertical'} size={'middle'}>
          <Descriptions column={2} title={'Device Info'} items={items} />
          {notAcceptedOrRejected &&
            (!acceptOrRejectError ? (
              <Space>
                <Button
                  onClick={() => {
                    rejectLogin({ requestId: loginRequest.id });
                  }}>
                  Reject
                </Button>
                <Button
                  type={'primary'}
                  onClick={() => {
                    acceptLogin({ requestId: loginRequest.id });
                  }}>
                  Accept
                </Button>
              </Space>
            ) : (
              <Typography.Text type={'danger'}>
                Your login request has expired. Please log in again via{' '}
                <Typography.Text code>octl login</Typography.Text> to continue. for more information
                check the CLI documentation{' '}
                <a href={DOCS_CLI} rel={'noreferrer noopener'} target={'_blank'}>
                  here.
                </a>
              </Typography.Text>
            ))}
          {isLoginRequestAccepted && (
            <Space>
              <CheckCircleOutlined color={token.green} />
              You accepted this request. This device is now authorized with your account.
            </Space>
          )}
          {isLoginRequestRejected && (
            <Space>
              <CloseCircleOutlined />
              You rejected this request.
            </Space>
          )}
        </Space>
      </Card>
    )
  );
};
