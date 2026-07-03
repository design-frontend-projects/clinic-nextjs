module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#00BFA5',
        secondary: '#00796B',
        accent: '#FF5722',
        background: '#0f0f0f',
        foreground: '#ffffff',
        card: '#181818',
        popover: '#181818',
        border: '#222222',
        input: '#222222',
        ring: '#00BFA5',
        muted: '#222222',
        mutedForeground: '#888888',
        destructive: '#ff4d4d',
        destructiveForeground: '#ffffff'
      },
      spacing: {
        '4': '4px',
        '8': '8px',
        '16': '16px',
        '24': '24px',
        '32': '32px',
        '48': '48px',
        '64': '64px'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem'
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px'
      }
    }
  },
  plugins: []
};
