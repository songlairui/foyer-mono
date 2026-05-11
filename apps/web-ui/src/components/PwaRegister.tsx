import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

export function PwaRegister() {
  useRegisterSW({
    onOfflineReady() {
      toast("App ready to work offline", {
        description: "You can use Foyer even without an internet connection.",
      });
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000,
        );
      }
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  return null;
}
