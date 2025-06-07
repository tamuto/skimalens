import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Eye, FileText } from 'lucide-react';

export const Route = createRootRoute({
  component: () => (
    <>
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold">
              <Eye className="h-6 w-6" />
              SkimaLens
            </Link>
            <div className="flex gap-6">
              <Link 
                to="/" 
                className="text-sm font-medium transition-colors hover:text-primary [&.active]:text-primary"
              >
                <FileText className="h-4 w-4 inline mr-1" />
                Upload
              </Link>
              <Link 
                to="/about" 
                className="text-sm font-medium transition-colors hover:text-primary [&.active]:text-primary"
              >
                About
              </Link>
            </div>
          </nav>
        </div>
      </header>
      <main className="min-h-screen bg-background">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </>
  ),
});
