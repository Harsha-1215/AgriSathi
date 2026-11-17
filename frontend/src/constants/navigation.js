export const navigation = {
  main: [
    { path: '/', label: 'Home', key: 'nav.home' },
    { path: '/about', label: 'About', key: 'nav.about' },
    { path: '/features', label: 'Features', key: 'nav.features' },
  ],
  cta: [
    { path: '/login', label: 'Login', key: 'nav.login', variant: 'outline' },
    { path: '/register', label: 'Get Started', key: 'nav.getStarted', variant: 'primary' },
  ],
  mobile: [
    { path: '/', label: 'Home', key: 'nav.home' },
    { path: '/about', label: 'About', key: 'nav.about' },
    { path: '/features', label: 'Features', key: 'nav.features' },
    { path: '/login', label: 'Login', key: 'nav.login' },
    { path: '/register', label: 'Register', key: 'nav.register' },
  ],
  footer: {
    quickLinks: [
      { path: '/', label: 'Home' },
      { path: '/about', label: 'About' },
      { path: '/features', label: 'Features' },
      { path: '/login', label: 'Login' },
      { path: '/register', label: 'Register' },
    ],
    modules: [
      { label: 'Crop Doctor', path: '#' },
      { label: 'Weather Forecast', path: '#' },
      { label: 'Market Prices', path: '#' },
      { label: 'Government Schemes', path: '#' },
      { label: 'Marketplace', path: '#' },
    ],
    legal: [
      { label: 'Privacy Policy', path: '#' },
      { label: 'Terms and Conditions', path: '#' },
    ],
  },
};

export default navigation;