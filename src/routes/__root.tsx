import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "react-oidc-context";

export const Route = createRootRoute({
  component: RootLayout,
});

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN as string;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string;

function RootLayout() {
  const auth = useAuth();

  async function handleSignOut() {
    // Clear the local OIDC session first so the app doesn't treat the user
    // as authenticated when Cognito redirects back.
    await auth.removeUser();
    const logoutUri = encodeURIComponent(window.location.origin);
    window.location.href = `https://${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${logoutUri}`;
  }

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="font-medium text-red-600 text-sm">
            Authentication error
          </p>
          <p className="mt-1 text-gray-500 text-xs">{auth.error.message}</p>
          <button
            className="mt-4 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            onClick={() => auth.signinRedirect()}
            type="button"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <LayoutDashboard className="mx-auto mb-3 h-8 w-8 text-blue-600" />
          <h1 className="font-semibold text-base text-gray-900">
            GovTech Barbados Service Status Dashboard
          </h1>
          <p className="mt-1 text-gray-500 text-sm">
            Sign in to manage service visibility
          </p>
          <button
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 font-medium text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={() => auth.signinRedirect()}
            type="button"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-gray-200 border-b bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* <LayoutDashboard className="h-5 w-5 text-blue-600" /> */}
            <span className="font-semibold text-gray-900 text-sm">
              GovTech Barbados - Service Status Dashboard
            </span>
          </div>
          <div className="flex items-center gap-4">
            {auth.user?.profile.email && (
              <span className="text-gray-500 text-xs">
                {auth.user.profile.email}
              </span>
            )}
            <button
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-gray-600 text-xs hover:bg-gray-100 hover:text-gray-900"
              onClick={handleSignOut}
              type="button"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </div>
  );
}
