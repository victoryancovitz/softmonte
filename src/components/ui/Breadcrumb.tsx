import Link from 'next/link'
import BackButton from '@/components/BackButton'

interface BreadcrumbItem {
  label: string
  href?: string
}

export default function Breadcrumb({ items, fallback }: { items: BreadcrumbItem[]; fallback?: string }) {
  return (
    <div className="flex items-center gap-2 mb-6 text-sm">
      <BackButton fallback={fallback ?? '/'} />
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-gray-300">/</span>}
            {isLast || !item.href ? (
              <span className={isLast ? 'font-medium text-gray-700' : 'text-gray-400'}>{item.label}</span>
            ) : (
              <Link href={item.href} className="text-gray-400 hover:text-gray-600">{item.label}</Link>
            )}
          </span>
        )
      })}
    </div>
  )
}
