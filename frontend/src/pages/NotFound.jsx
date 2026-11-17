import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import SectionTitle from '../components/common/SectionTitle';
import { AlertCircle, Home } from 'lucide-react';

export default function NotFound() {
  const { t, lang } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAF7] text-[#172B1D]">
      <div className="text-center px-4">
        <div className="w-16 h-16 bg-[#F59E0B]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-[#F59E0B]" />
        </div>
        <SectionTitle
          title={t('notFound.title')}
          description={t('notFound.description')}
        />
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="primary" size="md" asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" /> {t('notFound.button')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}