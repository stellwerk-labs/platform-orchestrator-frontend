import { theme as antDesignTheme, ThemeConfig } from 'antd';

interface BrandColors {
  background: string;
  container: string;
  border: string;
  primary: string;
  primaryHover: string;
  labelText: string;
  navigationMenuBackground: string;
}

const lightColors: BrandColors = {
  background: '#FFF',
  container: '#FAFAFA',
  border: 'rgba(0, 3, 17, 0.15)',
  primary: 'rgba(33, 86, 246, 1)',
  primaryHover: 'rgb(61,107,250)',
  labelText: 'rgba(0, 0, 0, 0.60)',
  navigationMenuBackground: 'rgba(149, 183, 255, 0.25)',
};

const darkColors: BrandColors = {
  background: 'rgba(0, 3, 17, 1)',
  container: 'rgb(13,16,29)',
  border: 'rgba(255, 255, 255, 0.15)',
  primary: 'rgba(99, 138, 255, 1)',
  primaryHover: 'rgb(113,147,246)',
  labelText: 'rgba(255, 255, 255, 0.50)',
  navigationMenuBackground: 'rgba(149, 183, 255, 0.25)',
};

export const lightHighContrastTheme: ThemeConfig = {
  cssVar: true,
  algorithm: antDesignTheme.defaultAlgorithm,
  token: {
    colorBgContainer: lightColors.container,
    colorBgLayout: lightColors.background,
    colorBorder: lightColors.border,
    colorBorderSecondary: lightColors.border,
    colorSplit: lightColors.border,
    colorLink: lightColors.primary,
    colorPrimary: lightColors.primary,
    colorPrimaryHover: lightColors.primaryHover,
    colorInfo: lightColors.primary,
    colorTextDescription: lightColors.labelText,
    colorTextLabel: lightColors.labelText,
    colorTextSecondary: lightColors.labelText,
    colorBgElevated: lightColors.container,
  },
  components: {
    Menu: {
      itemSelectedBg: lightColors.navigationMenuBackground,
      itemActiveBg: lightColors.navigationMenuBackground,
      itemSelectedColor: '#000000',
      colorTextLightSolid: '#000',
      popupBg: lightColors.container,
    },
    Segmented: {
      trackBg: '#E1E1E1FF',
    },
    Descriptions: {
      labelColor: lightColors.labelText,
    },
    Table: {
      headerBg: 'var(--ant-colorBgBase)',
    },
    Layout: {
      headerPadding: '0 30px',
      siderBg: lightColors.container,
    },
  },
};
export const darkHighContrastTheme: ThemeConfig = {
  cssVar: true,
  algorithm: antDesignTheme.darkAlgorithm,
  token: {
    colorBgLayout: darkColors.background,
    colorBgContainer: darkColors.container,
    colorBgBase: 'rgb(3,3,4)',
    colorLink: darkColors.primary,
    colorPrimary: darkColors.primary,
    colorPrimaryHover: darkColors.primaryHover,
    colorInfo: darkColors.primary,
    colorLinkHover: darkColors.primaryHover,
    colorBorder: darkColors.border,
    colorSplit: darkColors.border,
    colorTextDescription: darkColors.labelText,
    colorTextSecondary: darkColors.labelText,
    colorTextLabel: darkColors.labelText,
  },
  components: {
    Menu: {
      itemSelectedColor: '#FFF',
      itemActiveBg: darkColors.navigationMenuBackground,
      itemHoverBg: darkColors.navigationMenuBackground,
      itemSelectedBg: darkColors.navigationMenuBackground,
      popupBg: darkColors.container,
    },
    Layout: {
      headerBg: darkColors.background,
      headerPadding: '0 30px',
      siderBg: darkColors.container,
    },
    Button: {
      colorPrimary: '#3962e0',
      colorPrimaryHover: 'rgb(85,129,255)',
    },
    Segmented: {
      trackBg: 'rgb(66,66,66)',
    },
    Table: {
      headerBg: 'var(--ant-colorBgBase)',
    },
  },
};
