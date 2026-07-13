import { Alert, Form, FormProps, theme } from 'antd';
import { AxiosError } from 'axios';
import React, { ReactNode, useState } from 'react';

interface FormWithErrorHandlingProps extends FormProps {
  children: ReactNode;
  onFinish: (values: any) => Promise<void>;
  onFinished?: () => void;
  customErrorMessage?: string;
}
export const FormWithErrorHandling = ({
  children,
  onFinish,
  onFinished,
  customErrorMessage,
  ...formProps
}: FormWithErrorHandlingProps) => {
  const [error, setError] = useState<string | null>(null);

  const handleRequestError = (err: unknown) => {
    if (err instanceof AxiosError) {
      setError(customErrorMessage || err.response?.data?.message || 'A server error occurred.');
    }
  };

  const handleFinish = async (values: any) => {
    setError(null);
    try {
      await onFinish(values);
    } catch (err) {
      handleRequestError(err);
    } finally {
      if (onFinished) {
        onFinished();
      }
    }
  };

  const { token } = theme.useToken();
  return (
    <Form {...formProps} onFinish={handleFinish}>
      {error && (
        <Alert
          style={{ margin: `${token.marginMD}px 0` }}
          message={'API Error'}
          showIcon
          description={error}
          type={'error'}
        />
      )}
      {children}
    </Form>
  );
};
