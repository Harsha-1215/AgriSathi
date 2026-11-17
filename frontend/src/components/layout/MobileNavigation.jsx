import { useState } from 'react';
import Sidebar from '../layout/Sidebar';

export default function MobileNavigation() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <button
        className="p-2 md:hidden text-[#172B1D] hover:bg-[#DCFCE7] rounded-lg transition-colors"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation menu"
      >
        <span className="w-6 h-6">☰</span>
      </button>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}