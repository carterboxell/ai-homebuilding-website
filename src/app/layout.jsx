import './globals.css'

export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME || 'AI Homebuilder',
  description: 'Find your perfect home with AI-powered tools',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 font-sans">
        {children}
      </body>
    </html>
  )
}
