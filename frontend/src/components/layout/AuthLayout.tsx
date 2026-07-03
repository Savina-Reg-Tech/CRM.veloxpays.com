import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/login-bg.webp)' }}>
      {/* Overlay for readability */}
      {/* <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" /> */}
      <div className="relative w-full max-w-sm">
        {/* Logo / brand */}


        {/* Auth card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex  items-center justify-center rounded-2xl mb-4">
            <img src="/fav.svg" alt="Veloxverse icon" className="h-20 w-full max-w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Veloxverse</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your workspace</p>
        </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
