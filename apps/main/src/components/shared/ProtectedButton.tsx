import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, ButtonProps, Tooltip } from 'antd';
import React, { FocusEvent, MouseEvent, useState } from 'react';

interface ProtectedButtonProps extends ButtonProps {
  /** Whether the user is allowed to perform the action */
  allowed: boolean;
  /** Tooltip message when disabled */
  message: string;
  /** Button label or children */
  children: React.ReactNode;
}

export const ProtectedButton = ({
  allowed,
  message,
  children,
  ...buttonProps
}: ProtectedButtonProps) => {
  const [open, setOpen] = useState(false);

  // Tooltip visibility handlers
  const handleOpenChange = (visible: boolean) => setOpen(visible);
  const handleFocus = (_e: FocusEvent<HTMLSpanElement>) => setOpen(true);
  const handleBlur = (_e: FocusEvent<HTMLSpanElement>) => setOpen(false);
  const handleMouseEnter = (_e: MouseEvent<HTMLSpanElement>) => setOpen(true);
  const handleMouseLeave = (_e: MouseEvent<HTMLSpanElement>) => setOpen(false);

  if (allowed) {
    return <Button {...buttonProps}>{children}</Button>;
  }

  return (
    <Tooltip title={message} placement={'top'} open={open} onOpenChange={handleOpenChange}>
      <span
        tabIndex={0}
        aria-disabled={'true'}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}>
        <Button {...buttonProps} disabled icon={<InfoCircleOutlined />} iconPosition={'end'}>
          {children}
        </Button>
      </span>
    </Tooltip>
  );
};
