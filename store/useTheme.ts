import { useColorScheme } from 'react-native';
import { Colors, Gradients } from '../constants/Colors';
import { useAppStore } from './useAppStore';

export function useTheme() {
  const { isDarkMode } = useAppStore();
  const systemScheme = useColorScheme();
  const dark = isDarkMode ?? systemScheme === 'dark';

  const colors = dark ? Colors.dark : Colors.light;
  const gradients = {
    header: Gradients.header,
    btn:    Gradients.btn,
    card:   Gradients.headerCard,
  };

  return { colors, dark, gradients };
}
