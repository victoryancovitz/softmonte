'use client'

interface ChartCardProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export default function ChartCard({ title, description, children, className = '', action }: ChartCardProps) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm border border-gray-100 p-5 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
