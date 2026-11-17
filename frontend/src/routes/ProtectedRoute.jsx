import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import authContent from '../data/authContent';

export function ProtectedRoute({ allowedRoles }) {
  const { user, loading, sessionChecked, sessionExpired, refreshUser } = useAuth();
  const { lang } = useLanguage();
  const copy = authContent[lang] || authContent.en;
  const location = useLocation();

  useEffect(() => {
    if (!loading && !sessionChecked) refreshUser().catch(() => {});
  }, [loading, sessionChecked, refreshUser]);

  if (loading || !sessionChecked) {
    return <div className="auth-page-state" role="status">{copy.checkingSession}</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location, sessionExpired }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
