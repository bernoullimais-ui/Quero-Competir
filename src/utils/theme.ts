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
  
  if (org.font_family) {
    let fontFamily = '"Inter", sans-serif'; // default
    if (org.font_family === 'roboto') {
      fontFamily = '"Roboto", sans-serif';
    } else if (org.font_family === 'space') {
      fontFamily = '"Space Grotesk", sans-serif';
    }
    
    // Tailwind v4 relies heavily on --font-sans for the default font
    root.style.setProperty('--font-sans', fontFamily);
    // Also apply it directly to body to ensure it propagates everywhere correctly
    document.body.style.fontFamily = fontFamily;
  }

  if (org.theme_mode === 'dark') {
    root.style.setProperty('--color-white', '#0f172a'); // slate-900
    root.style.setProperty('--color-slate-50', '#1e293b'); // slate-800
    root.style.setProperty('--color-slate-100', '#334155'); // slate-700
    root.style.setProperty('--color-slate-200', '#475569'); // slate-600
    root.style.setProperty('--color-slate-300', '#64748b'); // slate-500
    root.style.setProperty('--color-slate-400', '#94a3b8'); // slate-400
    root.style.setProperty('--color-slate-500', '#cbd5e1'); // slate-300
    root.style.setProperty('--color-slate-600', '#e2e8f0'); // slate-200
    root.style.setProperty('--color-slate-700', '#f1f5f9'); // slate-100
    root.style.setProperty('--color-slate-800', '#f8fafc'); // slate-50
    root.style.setProperty('--color-slate-900', '#ffffff'); // white
    root.style.setProperty('--color-slate-950', '#ffffff'); // white
    root.style.setProperty('--color-gray-50', '#1e293b');
    root.style.setProperty('--color-gray-100', '#334155');
    root.style.setProperty('--color-gray-200', '#475569');
    root.style.setProperty('--color-gray-300', '#64748b');
    root.style.setProperty('--color-gray-400', '#94a3b8');
    root.style.setProperty('--color-gray-500', '#cbd5e1');
    root.style.setProperty('--color-gray-600', '#e2e8f0');
    root.style.setProperty('--color-gray-700', '#f1f5f9');
    root.style.setProperty('--color-gray-800', '#f8fafc');
    root.style.setProperty('--color-gray-900', '#ffffff');
    root.style.setProperty('--color-black', '#ffffff');
  } else {
    // Reset to defaults if light
    root.style.removeProperty('--color-white');
    root.style.removeProperty('--color-slate-50');
    root.style.removeProperty('--color-slate-100');
    root.style.removeProperty('--color-slate-200');
    root.style.removeProperty('--color-slate-300');
    root.style.removeProperty('--color-slate-400');
    root.style.removeProperty('--color-slate-500');
    root.style.removeProperty('--color-slate-600');
    root.style.removeProperty('--color-slate-700');
    root.style.removeProperty('--color-slate-800');
    root.style.removeProperty('--color-slate-900');
    root.style.removeProperty('--color-slate-950');
    root.style.removeProperty('--color-gray-50');
    root.style.removeProperty('--color-gray-100');
    root.style.removeProperty('--color-gray-200');
    root.style.removeProperty('--color-gray-300');
    root.style.removeProperty('--color-gray-400');
    root.style.removeProperty('--color-gray-500');
    root.style.removeProperty('--color-gray-600');
    root.style.removeProperty('--color-gray-700');
    root.style.removeProperty('--color-gray-800');
    root.style.removeProperty('--color-gray-900');
    root.style.removeProperty('--color-black');
  }

};
