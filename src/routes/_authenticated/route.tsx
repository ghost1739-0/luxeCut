import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Role gate for /admin — any authenticated user must be admin to view.
    if (location.pathname.startsWith("/admin")) {
      try {
        const res = await checkIsAdmin();
        if (!res.isAdmin) throw redirect({ to: "/" });
      } catch (e) {
        if (e && typeof e === "object" && "to" in e) throw e;
        throw redirect({ to: "/" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
