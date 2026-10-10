import type { baseColors } from './baseColors';
import type { semanticColors } from './semanticColors';

type SemanticColors = typeof semanticColors;
type BaseColors = typeof baseColors;

declare module '@mui/material/styles' {
  interface Palette {
    semantic: SemanticColors;
    base: BaseColors;
  }

  interface PaletteOptions {
    semantic?: SemanticColors;
    base?: BaseColors;
  }
}
