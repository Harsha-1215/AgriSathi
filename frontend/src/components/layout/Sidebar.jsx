export default function Sidebar({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-white/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
    >
      <div className="absolute top-4 right-4">
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#DCFCE7] rounded-lg text-[#172B1D] transition-colors"
          aria-label="Close menu"
        >
          <span className="w-6 h-6">✕</span>
        </button>
      </div>
      <div className="container py-20">
        <Logo size="large" className="mb-8" />
        <nav className="space-y-4">
          <a href="/" className="block px-4 py-3 text-lg font-semibold text-[#172B1D] bg-[#DCFCE7]/30 rounded-xl border border-[#166534]/20">
            Home
          </a>
          <a href="/about" className="block px-4 py-3 text-lg font-medium text-[#64748B] hover:bg-[#DCFCE7]/30 rounded-xl transition-colors">
            About
          </a>
          <a href="/features" className="block px-4 py-3 text-lg font-medium text-[#64748B] hover:bg-[#DCFCE7]/30 rounded-xl transition-colors">
            Features
          </a>
          <a href="/login" className="block px-4 py-3 text-lg font-medium text-[#64748B] hover:bg-[#DCFCE7]/30 rounded-xl transition-colors">
            Login
          </a>
          <a href="/register" className="block px-4 py-3 text-lg font-medium text-[#64748B] hover:bg-[#DCFCE7]/30 rounded-xl transition-colors">
            Register
          </a>
        </nav>
        <div className="mt-12 flex items-center gap-3 px-4">
          <span className="text-sm font-medium text-[#172B1D]">Language:</span>
          <button className="px-3 py-1.5 text-sm font-medium text-white bg-[#166534] rounded-lg">English</button>
          <button className="px-3 py-1.5 text-sm font-medium text-[#64748B] hover:text-[#166534] transition-colors">తెలుగు</button>
          <button className="px-3 py-1.5 text-sm font-medium text-[#64748B] hover:text-[#166534] transition-colors">हिन्दी</button>
        </div>
      </div>
    </div>
  );
}