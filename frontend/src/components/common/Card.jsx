export default function Card({
  children,
  variant = 'standard',
  className = '',
  padding = true,
  hoverable = true,
}) {
  const variantClasses = {
    standard: 'card',
    feature: 'card card-feature',
    stats: 'card card-stats',
    interactive: 'card card-interactive',
  };

  return (
    <div
      className={`${variantClasses[variant]} ${padding ? 'p-6' : ''} ${hoverable ? '' : 'hover:scale-95 transition-transform duration-200'} ${className}`}
    >
      {children}
    </div>
  );
}