# AGRISATHI – AI-Powered Smart Agriculture and Farmer Assistance Platform

Tagline: "Smart Farming. Better Harvest. Brighter Future."

## Module 1: Project Setup and Design System

This is Module 1 of the AGRISATHI project. It establishes the complete frontend foundation including project setup, design system, application layout, responsive navigation, reusable components, and the welcome/landing page.

## Technology Stack

- **React.js** (JavaScript, no TypeScript)
- **Vite** – Build tool and dev server
- **Tailwind CSS** – Utility-first styling
- **React Router DOM** – Client-side routing
- **Lucide React** – Icon library
- **Framer Motion** – Animations
- **Axios** – HTTP client
- **React Hot Toast** – Toast notifications

## Folder Structure

```
agrisathi-frontend/
├── public/
│   ├── images/
│   ├── icons/
│   ├── logos/
│   └── sounds/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   └── navigation/
│   ├── pages/
│   ├── routes/
│   ├── constants/
│   ├── context/
│   ├── hooks/
│   ├── services/
│   ├── styles/
│   ├── i18n/
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The development server will start at `http://localhost:5173`.

### Production Build

```bash
npm run build
```

The production build will be output to the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Design System

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| Primary Green | #166534 | Primary buttons, links, accents |
| Secondary Green | #22C55E | Secondary buttons, success states |
| Dark Green | #14532D | Footer, dark backgrounds |
| Light Green | #DCFCE7 | Light backgrounds, subtle accents |
| Background | #F8FAF7 | Page background |
| Card Background | #FFFFFF | Card backgrounds |
| Primary Text | #172B1D | Headings, body text |
| Secondary Text | #64748B | Captions, secondary text |
| Warning | #F59E0B | Warning badges, alerts |
| Danger | #DC2626 | Error states, danger buttons |
| Success | #16A34A | Success states |

### Typography

- **Inter** – English
- **Noto Sans Telugu** – Telugu (te)
- **Noto Sans Devanagari** – Hindi (hi)

All font sizes use CSS `clamp()` for responsive scaling.

## Routes

| Path | Component |
|------|-----------|
| `/` | Welcome (Landing Page) |
| `/about` | Coming Soon |
| `/features` | Coming Soon |
| `/login` | Coming Soon |
| `/register` | Coming Soon |
| `/coming-soon` | Coming Soon |
| `/*` | Not Found |

## Internationalization

Supported languages: English (en), Telugu (te), Hindi (hi)

Translation files are in `src/i18n/`. Language preference is stored in `localStorage`.

## Components

### Common Components

- **Button** – Primary, secondary, outline, danger variants; loading state
- **Card** – Standard, feature, stats, interactive variants
- **Badge** – Success, warning, danger, info variants
- **Modal** – Overlay-based modal with close button
- **Loader** – Spinner, page loader, skeleton
- **SectionTitle** – Reusable section heading with title, description, icon, action
- **Logo** – AGRISATHI brand logo component

### Layout Components

- **MainLayout** – Wrapper with Header, main content, Footer
- **Header** – Sticky navigation with logo, links, language selector, CTAs
- **Footer** – Logo, quick links, modules, contact, legal
- **Sidebar** – Mobile navigation drawer
- **MobileNavigation** – Mobile menu toggle + sidebar

### Navigation Components

- **NavigationLinks** – Desktop navigation links
- **LanguageSelector** – Language dropdown selector

## Accessibility

- Minimum 48px touch targets
- Large readable fonts with CSS clamp()
- Visible focus states
- Screen-reader labels
- Keyboard navigation
- High color contrast
- Proper image alt text
- Reduced-motion support

## Responsive Design

Mobile-first approach with breakpoints:
- Mobile: 320px–480px
- Tablet: 600px–1024px
- Desktop: 1280px+

## Performance

- Lazy-loaded images
- Optimized CSS
- Reusable components
- Reduced-motion support
- Responsive image sizing

## PWA Support

PWA support is configured via `vite-plugin-pwa` in `vite.config.js`. Complete PWA functionality will be implemented in a later module.

## License

ISC