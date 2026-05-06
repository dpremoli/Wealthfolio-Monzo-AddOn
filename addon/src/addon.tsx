import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddonDefinition, useAddonContext } from "@wealthfolio/addon-sdk";
import { DashboardPage } from "./pages/dashboard-page";
import { SettingsPage } from "./pages/settings-page";

const queryClient = new QueryClient();

function AddonContent() {
  const { router } = useAddonContext();

  return (
    <QueryClientProvider client={queryClient}>
      {router.currentRoute === "/addons/monzo/settings" ? (
        <SettingsPage />
      ) : (
        <DashboardPage />
      )}
    </QueryClientProvider>
  );
}

export default {
  enable: async (ctx) => {
    ctx.ui.sidebar.addItem({
      label: "Monzo Sync",
      icon: "bank",
      path: "/addons/monzo",
    });

    ctx.router.add({
      path: "/addons/monzo",
      component: AddonContent,
    });

    ctx.router.add({
      path: "/addons/monzo/settings",
      component: AddonContent,
    });
  },

  onDisable: async () => {
    // Cleanup if needed
  },
} satisfies AddonDefinition;
