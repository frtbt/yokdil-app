import { useColorScheme } from 'react-native';
import { Colors, Gradients } from '../constants/Colors';
import { useAppStore } from './useAppStore';

export function useTheme() {
  const { isDarkMode, isFuatBaskanMode } = useAppStore();
  const systemScheme = useColorScheme();
  const dark = isDarkMode ?? systemScheme === 'dark';

  const colors = isFuatBaskanMode
    ? Colors.fuatBaskan
    : dark
      ? Colors.dark
      : Colors.light;

  const gradients = isFuatBaskanMode
    ? { header: Gradients.headerBrand, btn: Gradients.brand,   card: Gradients.cardBrand }
    : { header: Gradients.header,      btn: Gradients.premium, card: Gradients.headerCard };

  return { colors, dark, isFuatBaskanMode, gradients };
}
