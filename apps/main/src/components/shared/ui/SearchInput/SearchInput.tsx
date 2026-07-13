import { Flex, Input, InputProps } from 'antd';
import { useEffect, useState } from 'react';

interface SearchInputProps extends Omit<InputProps, 'onChange'> {
  // If this is set to true the onChange event will be debounced by 250ms
  debounceEvent?: boolean;
  onChange: (value: string) => void;
}

export const SearchInput = ({
  debounceEvent,
  onChange,
  defaultValue,
  readOnly,
  placeholder,
}: SearchInputProps) => {
  const [inputValue, setInputValue] = useState<string>((defaultValue as string) || '');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (onChange && debounceEvent) {
        onChange(inputValue);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [inputValue, debounceEvent, onChange]);

  const handleInputChange: InputProps['onChange'] = (event) => {
    if (debounceEvent) {
      setInputValue(event.target.value);
    } else if (onChange) {
      onChange(event.target.value);
    }
  };

  return (
    <Flex justify={'flex-end'} flex={1}>
      <Input.Search
        onChange={handleInputChange}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{ maxWidth: '300px' }}
      />
    </Flex>
  );
};
