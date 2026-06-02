export const applyBrandColors = (org: any) => {
  if (!org) return;
  const root = document.documentElement;
  
  if (org.primary_color) {
    root.style.setProperty('--color-indigo-50', `color-mix(in srgb, ${org.primary_color} 10%, white)`);
    root.style.setProperty('--color-indigo-100', `color-mix(in srgb, ${org.primary_color} 20%, white)`);
    root.style.setProperty('--color-indigo-200', `color-mix(in srgb, ${org.primary_color} 40%, white)`);
    root.style.setProperty('--color-indigo-300', `color-mix(in srgb, ${org.primary_color} 60%, white)`);
    root.style.setProperty('--color-indigo-400', `color-mix(in srgb, ${org.primary_color} 80%, white)`);
    root.style.setProperty('--color-indigo-500', org.primary_color);
    root.style.setProperty('--color-indigo-600', `color-mix(in srgb, ${org.primary_color} 85%, black)`);
    root.style.setProperty('--color-indigo-700', `color-mix(in srgb, ${org.primary_color} 70%, black)`);
    root.style.setProperty('--color-indigo-800', `color-mix(in srgb, ${org.primary_color} 50%, black)`);
    root.style.setProperty('--color-indigo-900', `color-mix(in srgb, ${org.primary_color} 30%, black)`);
  }
  
  if (org.secondary_color) {
    root.style.setProperty('--color-amber-50', `color-mix(in srgb, ${org.secondary_color} 10%, white)`);
    root.style.setProperty('--color-amber-100', `color-mix(in srgb, ${org.secondary_color} 20%, white)`);
    root.style.setProperty('--color-amber-200', `color-mix(in srgb, ${org.secondary_color} 40%, white)`);
    root.style.setProperty('--color-amber-300', `color-mix(in srgb, ${org.secondary_color} 60%, white)`);
    root.style.setProperty('--color-amber-400', `color-mix(in srgb, ${org.secondary_color} 80%, white)`);
    root.style.setProperty('--color-amber-500', org.secondary_color);
    root.style.setProperty('--color-amber-600', `color-mix(in srgb, ${org.secondary_color} 85%, black)`);
    root.style.setProperty('--color-amber-700', `color-mix(in srgb, ${org.secondary_color} 70%, black)`);
    root.style.setProperty('--color-amber-800', `color-mix(in srgb, ${org.secondary_color} 50%, black)`);
    root.style.setProperty('--color-amber-900', `color-mix(in srgb, ${org.secondary_color} 30%, black)`);
  }
};
