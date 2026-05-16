/* ============================================================
   Style presets — quickly switch the entire look in one click
   ============================================================ */

const PRESETS = {
  macSonoma: {
    label: 'macOS Sonoma',
    patch: {
      theme: 'dark',
      opacity: 0.65,
      cornerRadius: 16,
      height: 36,
      width: 720,
      fontSize: 13,
      accent: '#0a84ff'
    }
  },
  windows11: {
    label: 'Windows 11',
    patch: {
      theme: 'light',
      opacity: 0.82,
      cornerRadius: 10,
      height: 38,
      width: 760,
      fontSize: 13,
      accent: '#0078d4'
    }
  },
  minimal: {
    label: 'Minimal',
    patch: {
      theme: 'dark',
      opacity: 0.45,
      cornerRadius: 22,
      height: 32,
      width: 560,
      fontSize: 12,
      accent: '#a3a3a8'
    }
  },
  neon: {
    label: 'Neon',
    patch: {
      theme: 'dark',
      opacity: 0.78,
      cornerRadius: 14,
      height: 36,
      width: 720,
      fontSize: 13,
      accent: '#bf5af2'
    }
  }
};

window.WinBarPresets = PRESETS;
