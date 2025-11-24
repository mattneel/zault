import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="text-center">
        <div class="text-6xl mb-4">🔍</div>
        <h1 class="text-2xl font-bold mb-2">Page Not Found</h1>
        <p class="text-[var(--zault-muted)] mb-4">
          The page you're looking for doesn't exist.
        </p>
        <A href="/" class="btn btn-primary">
          Go Home
        </A>
      </div>
    </div>
  );
}
