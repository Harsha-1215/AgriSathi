export default function SectionTitle({
  title,
  description,
  icon,
  action,
  className = '',
}) {
  return (
    <div className={`section-title text-center mb-12 ${className}`}>
      {icon && <div className={`text-3xl mb-4 inline-block ${icon}`}>{icon}</div>}
      <h2 className="text-3xl md:text-4xl font-bold text-[#172B1D] mb-4">
        {title}
      </h2>
      {description && (
        <p className="text-lg md:text-xl text-[#64748B] max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-8 flex justify-center">{action}</div>}
    </div>
  );
}