import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import InteractionModePrompt from './components/common/InteractionModePrompt';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

function App() {
  return (
    <Router>
      <ThemeProvider>
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <InteractionModePrompt />
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </LanguageProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;