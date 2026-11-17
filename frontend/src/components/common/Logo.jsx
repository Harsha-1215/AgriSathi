import { Leaf } from 'lucide-react';

export default function Logo({ className = '', size = 'medium' }) {
  const sizeMap = {
    small: 'agri-logo__mark--small',
    medium: 'agri-logo__mark--medium',
    large: 'agri-logo__mark--large',
  };

  return (
    <div className={`agri-logo ${className}`} aria-label="AGRISATHI logo">
      <span className={`agri-logo__mark ${sizeMap[size]}`}>
        <span className="agri-logo__glow" />
        <svg
          className="agri-logo__svg"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#16A34A" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="20" fill="#DCFCE7" stroke="#166534" strokeWidth="2" />
          <path d="M8 24C8 16 14 10 24 10C30 10 36 16 36 24C36 32 30 38 24 38C14 38 8 32 8 24Z" fill="url(#leafGrad)" />
          <path d="M24 10C24 14 18 20 24 26C28 30 34 24 34 20" stroke="#14532D" strokeWidth="3" strokeLinecap="round" />
          <path d="M14 24L24 34L34 24" stroke="#14532D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="agri-logo__wordmark">
        <strong>AGRISATHI</strong>
        <small>Smart Farming</small>
      </span>
    </div>
  );
}