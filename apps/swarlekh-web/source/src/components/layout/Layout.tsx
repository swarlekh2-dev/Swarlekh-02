import { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* Desktop: margin for sidebar. Mobile: padding for top bar */}
      <main className="flex-1 min-h-screen lg:ml-64 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
