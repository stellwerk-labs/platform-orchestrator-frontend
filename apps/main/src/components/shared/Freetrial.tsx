import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

export const Freetrial = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authTranslations = t('AUTHENTICATE');

  return (
    <Typography.Link
      className={'txt-sm'}
      href={'/auth/register'}
      onClick={(e) => {
        e.preventDefault();
        navigate('/auth/register');
      }}>
      {authTranslations.SIGN_UP}
    </Typography.Link>
  );
};
