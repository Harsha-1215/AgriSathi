import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Welcome from '../pages/Welcome';
import NotFound from '../pages/NotFound';
import ComingSoon from '../pages/ComingSoon';
import MainLayout from '../components/layout/MainLayout';
import AuthLayout from '../components/auth/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';
import RoleSelection from '../pages/auth/RoleSelection';
import Register from '../pages/auth/Register';
import Login from '../pages/auth/Login';
import VerifyOtp from '../pages/auth/VerifyOtp';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import VoiceRegistration from '../pages/auth/VoiceRegistration';
import VoiceRegistrationFlow from '../pages/auth/VoiceRegistrationFlow';
import VoiceServiceSelection from '../pages/auth/VoiceServiceSelection';
import AccountStatus from '../pages/auth/AccountStatus';
import FarmerDashboard from '../pages/farmer/FarmerDashboard';

const VoiceAssistantPage = lazy(() => import('../pages/farmer/VoiceAssistantPage'));
const CropDoctorPage = lazy(() => import('../pages/farmer/CropDoctorPage'));
const WeatherPage = lazy(() => import('../pages/farmer/WeatherPage'));
const LandMeasurementPage = lazy(() => import('../pages/farmer/LandMeasurementPage'));
const SmartCalculatorsPage = lazy(() => import('../pages/farmer/SmartCalculatorsPage'));
const CropKnowledgePage = lazy(() => import('../pages/farmer/CropKnowledgePage'));
const CropKnowledgeDetailPage = lazy(() => import('../pages/farmer/CropKnowledgeDetailPage'));
const CropKnowledgeAdminPage = lazy(() => import('../pages/admin/CropKnowledgeAdminPage'));
const AgriShortsPage = lazy(() => import('../pages/farmer/AgriShortsPage'));
const GovernmentSchemesPage = lazy(() => import('../pages/farmer/GovernmentSchemesPage'));
const PlatformAdminPage = lazy(() => import('../pages/admin/PlatformAdminPage'));
const MarketplacePage = lazy(() => import('../pages/farmer/MarketplacePage'));
const MarketplaceAdminPage = lazy(() => import('../pages/admin/MarketplaceAdminPage'));
const LivestockMarketplacePage = lazy(() => import('../pages/farmer/LivestockMarketplacePage'));
const LivestockAdminPage = lazy(() => import('../pages/admin/LivestockAdminPage'));

function AppRoutes() {
  return (
    <Suspense fallback={<div className="auth-page-state" role="status">Loading AGRISATHI module…</div>}>
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Welcome />} />
        <Route path="/about" element={<ComingSoon />} />
        <Route path="/features" element={<ComingSoon />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route path="/contact" element={<ComingSoon />} />
        <Route path="/help" element={<ComingSoon />} />
        <Route path="/privacy" element={<ComingSoon />} />
        <Route path="/terms" element={<ComingSoon />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RoleSelection />} />
        <Route path="/register/voice" element={<VoiceRegistration />} />
        <Route path="/voice-register" element={<VoiceRegistrationFlow />} />
        <Route path="/voice-services" element={<VoiceServiceSelection />} />
        <Route path="/register/:role" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/account-status" element={<AccountStatus />} />
        <Route path="/unauthorized" element={<AccountStatus />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['farmer']} />}>
        <Route path="/farmer" element={<Navigate to="/farmer/dashboard" replace />} />
        <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
        <Route path="/farmer/voice-assistant" element={<VoiceAssistantPage />} />
        <Route path="/farmer/crop-doctor" element={<CropDoctorPage />} />
        <Route path="/farmer/weather" element={<WeatherPage />} />
        <Route path="/farmer/land-measurement" element={<LandMeasurementPage />} />
        <Route path="/farmer/calculators" element={<SmartCalculatorsPage />} />
        <Route path="/farmer/crop-knowledge" element={<CropKnowledgePage />} />
        <Route path="/farmer/crop-knowledge/:cropId" element={<CropKnowledgeDetailPage />} />
        <Route path="/farmer/agri-shorts" element={<AgriShortsPage />} />
        <Route path="/farmer/agri-shorts/:id" element={<AgriShortsPage />} />
        <Route path="/farmer/government-schemes" element={<GovernmentSchemesPage />} />
        <Route path="/farmer/government-schemes/:id" element={<GovernmentSchemesPage />} />
        <Route path="/farmer/marketplace" element={<MarketplacePage />} />
        <Route path="/farmer/livestock" element={<LivestockMarketplacePage />} />
        <Route path="/farmer/*" element={<ComingSoon />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['expert', 'approved_creator', 'admin']} />}>
        <Route path="/creator/agri-shorts" element={<AgriShortsPage creatorOnly />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['expert']} />}>
        <Route path="/expert/*" element={<ComingSoon />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['provider']} />}>
        <Route path="/provider/*" element={<ComingSoon />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['buyer']} />}>
        <Route path="/buyer" element={<Navigate to="/buyer/marketplace" replace />} />
        <Route path="/buyer/marketplace" element={<MarketplacePage />} />
        <Route path="/buyer/dashboard" element={<Navigate to="/buyer/marketplace" replace />} />
        <Route path="/buyer/livestock" element={<LivestockMarketplacePage />} />
        <Route path="/buyer/*" element={<ComingSoon />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['seller']} />}>
        <Route path="/seller/marketplace" element={<MarketplacePage />} />
        <Route path="/seller/livestock" element={<LivestockMarketplacePage />} />
        <Route path="/seller/dashboard" element={<MarketplacePage initialView="sellerOverview" />} />
        <Route path="/seller/*" element={<ComingSoon />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/crop-knowledge" element={<CropKnowledgeAdminPage />} />
        <Route path="/admin/agri-shorts" element={<PlatformAdminPage />} />
        <Route path="/admin/government-schemes" element={<PlatformAdminPage schemes />} />
        <Route path="/admin/marketplace" element={<MarketplaceAdminPage />} />
        <Route path="/admin/livestock" element={<LivestockAdminPage />} />
        <Route path="/admin/*" element={<ComingSoon />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

export default AppRoutes;