import { Typography } from 'antd';
import { HookAPI } from 'antd/es/modal/useModal';

export const showTokenModal = (
  successModal: HookAPI,
  userName: string,
  token: string,
  regenerated: boolean = false,
) => {
  const title = regenerated
    ? `Token for service user ${userName} regenerated`
    : `Service User ${userName} created`;
  successModal.success({
    title,
    width: 500,
    content: (
      <div>
        <p>
          Here's your {regenerated ? 'new' : ''} token.{' '}
          <strong>This will not be shown again</strong>, so make sure to copy and store it securely.
        </p>
        <Typography.Text code copyable>
          {token}
        </Typography.Text>
      </div>
    ),
    okText: 'OK',
  });
};
