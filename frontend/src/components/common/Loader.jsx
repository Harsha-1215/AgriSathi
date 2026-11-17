export default function Loader({
  type = 'spinner',
  size = 'md',
  className = '',
  text,
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  if (type === 'page') {
    return (
      <div className="loader-page text-center animate-fade-in">
        <div className={`loader ${sizeClasses[size]}`} role="status" aria-label="Loading" />
        {text && <p className="mt-3 text-[#64748B] font-medium">{text}</p>}
      </div>
    );
  }

  if (type === 'skeleton') {
    return (
      <div className={`skeleton ${className}`} aria-hidden="true">
        {children}
      </div>
    );
  }

  return (
    <div
      className={`loader ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}