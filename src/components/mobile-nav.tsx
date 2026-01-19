'use client'

import { useState } from 'react'
import { Menu, X, Building2, FileText, Search, Bell, Home } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/filings', label: 'Filings', icon: FileText },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/alerts', label: 'Alerts', icon: Bell },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle className="text-left">Healthcare Filings DB</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col py-4">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <Icon className="h-5 w-5 text-gray-500" />
                <span className="font-medium">{item.label}</span>
              </a>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
