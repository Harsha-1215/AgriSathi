import { useState, useCallback } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  showCloseButton = true,
  size = 'md',
}) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className={`fixed left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-h-[90vh] overflow-y-auto ${sizeClasses[size]} ${className}`}
      >
        {title && (
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 id="modal-title" className="text-xl font-bold text-[#172B1D]">
                {title}
              </h2>
            </div>
            {showCloseButton && (
              <button
                onClick={handleClose}
                className="p-2 hover:bg-[#DCFCE7] rounded-lg text-[#64748B] hover:text-[#166534] transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="text-[#172B1D] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}