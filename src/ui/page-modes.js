// The page's one mode store (phase 4b on). Screens import it; main.js puts it
// on the bridge for the old scripts (as orbitModes) and the test hook.
import { createModeStore } from './mode-store.js';

export const modes = createModeStore();
