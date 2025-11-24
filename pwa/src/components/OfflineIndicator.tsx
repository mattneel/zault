import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { isServer } from "solid-js/web";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = createSignal(true);
  const [showBanner, setShowBanner] = createSignal(false);

  onMount(() => {
    if (isServer) return;

    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      // Show "back online" briefly
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Show banner if starting offline
    if (!navigator.onLine) {
      setShowBanner(true);
    }

    onCleanup(() => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    });
  });

  return (
    <Show when={showBanner()}>
      <div 
        class={`fixed top-0 left-0 right-0 z-50 text-center py-2 text-sm font-medium transition-all duration-300 ${
          isOnline() 
            ? "bg-success text-success-content" 
            : "bg-warning text-warning-content"
        }`}
      >
        {isOnline() ? (
          <span>Back online</span>
        ) : (
          <span>You're offline. Messages will sync when reconnected.</span>
        )}
      </div>
    </Show>
  );
}

