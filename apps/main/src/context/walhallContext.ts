import { createContext, Dispatch, SetStateAction, useContext } from 'react';

interface WalhallContextProps {
  theme?: 'light' | 'dark';
  pendingRequests?: number;
  shouldConfirmOnNavigateState: [boolean, Dispatch<SetStateAction<boolean>>];
  navigateDialogState: [boolean, Dispatch<SetStateAction<boolean>>];
  nextRouteState: [string | null, Dispatch<SetStateAction<string | null>>];
}

export const WalhallContext = createContext<WalhallContextProps>({
  shouldConfirmOnNavigateState: [false, () => false],
  navigateDialogState: [false, () => false],
  nextRouteState: [null, () => null],
});

export const useWalhallContext = () => useContext(WalhallContext);
