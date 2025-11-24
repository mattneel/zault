import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { Html5Qrcode } from "html5-qrcode";
import { addContact, type Contact } from "~/lib/storage";
import { getShortId, fromBase64Url } from "~/lib/crypto";

export default function AddContact() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [name, setName] = createSignal("");
  const [idInput, setIdInput] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal(false);
  const [scanning, setScanning] = createSignal(false);
  const [scanStatus, setScanStatus] = createSignal("");
  const [scannedParts, setScannedParts] = createSignal<{ [key: string]: string }>({});

  let scanner: Html5Qrcode | null = null;
  let fileInput: HTMLInputElement | undefined;

  onMount(() => {
    const urlId = searchParams.id;
    if (urlId) {
      setIdInput(urlId);
    }
  });

  onCleanup(async () => {
    if (scanner) {
      try {
        await scanner.stop();
      } catch {}
    }
  });

  const startScan = async () => {
    setScanning(true);
    setError(null);
    setScannedParts({});
    setScanStatus("Scan first QR code...");

    try {
      scanner = new Html5Qrcode("qr-reader");
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQrScan(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error("Failed to start scanner:", err);
      setError("Could not access camera");
      setScanning(false);
    }
  };

  const handleQrScan = (text: string) => {
    // Check if it's a split QR code (starts with "1:" or "2:")
    if (text.startsWith("1:") || text.startsWith("2:")) {
      const part = text.charAt(0);
      const data = text.slice(2);
      
      const parts = { ...scannedParts(), [part]: data };
      setScannedParts(parts);
      
      if (parts["1"] && parts["2"]) {
        // Got both parts - combine them
        try {
          const part1 = fromBase64Url(parts["1"]);
          const part2 = fromBase64Url(parts["2"]);
          
          // Combine the two halves
          const combined = new Uint8Array(part1.length + part2.length);
          combined.set(part1, 0);
          combined.set(part2, part1.length);
          
          // Convert back to base64 for the input field
          const fullIdentity = btoa(String.fromCharCode(...combined))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
          
          setIdInput(fullIdentity);
          setScanStatus("Complete!");
          stopScan();
        } catch (err) {
          console.error("Failed to combine QR parts:", err);
          setError("Invalid QR code data");
        }
      } else if (parts["1"]) {
        setScanStatus("Got part 1. Scan part 2...");
      } else {
        setScanStatus("Got part 2. Scan part 1...");
      }
    } else {
      // Single QR code (legacy or full identity somehow)
      setIdInput(text);
      setScanStatus("Complete!");
      stopScan();
    }
  };

  const stopScan = async () => {
    if (scanner) {
      try {
        await scanner.stop();
      } catch {}
      scanner = null;
    }
    setScanning(false);
  };

  const importFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.publicIdentity) {
        setIdInput(data.publicIdentity);
      }
    } catch (err) {
      console.error("Failed to read file:", err);
      setError("Failed to read file");
    }
    
    input.value = "";
  };

  const handleAdd = async () => {
    setError(null);

    if (!name().trim()) {
      setError("Enter a name");
      return;
    }

    if (!idInput().trim()) {
      setError("Scan QR, paste identity, or import JSON");
      return;
    }

    try {
      let encoded = idInput().trim();
      if (encoded.includes("?id=")) {
        encoded = encoded.split("?id=")[1];
      }

      const publicIdentity = fromBase64Url(encoded);

      if (publicIdentity.length !== 3136) {
        setError(`Invalid identity (got ${publicIdentity.length} bytes, expected 3136)`);
        return;
      }

      const shortId = getShortId(publicIdentity);

      const contact: Contact = {
        id: shortId,
        name: name().trim(),
        publicIdentity,
        addedAt: Date.now(),
      };

      await addContact(contact);
      setSuccess(true);

      setTimeout(() => {
        navigate(`/chat/${shortId}`);
      }, 500);
    } catch (err) {
      console.error("Failed to add contact:", err);
      setError("Invalid identity");
    }
  };

  return (
    <div class="min-h-dvh flex flex-col bg-base-100">
      {/* Header */}
      <div class="navbar bg-base-200 min-h-0 h-14">
        <div class="navbar-start">
          <button class="btn btn-ghost btn-sm btn-square" onClick={() => navigate("/")}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div class="navbar-center">
          <span class="font-medium">Add Contact</span>
        </div>
        <div class="navbar-end" />
      </div>

      {/* Content */}
      <div class="flex-1 p-4">
        <Show
          when={!success()}
          fallback={
            <div class="flex flex-col items-center justify-center py-16">
              <div class="text-success text-4xl mb-4">✓</div>
              <p class="font-medium">Contact added</p>
            </div>
          }
        >
          <div class="space-y-4 max-w-md mx-auto">
            {/* QR Scanner */}
            <Show when={scanning()}>
              <div class="relative">
                <div id="qr-reader" class="rounded-lg overflow-hidden" />
                <div class="absolute bottom-2 left-2 right-2 bg-base-100/90 rounded px-3 py-2 text-center text-sm">
                  {scanStatus()}
                </div>
                <button
                  class="btn btn-sm btn-circle btn-ghost absolute top-2 right-2 bg-base-100/80"
                  onClick={stopScan}
                >
                  ✕
                </button>
              </div>
            </Show>

            <Show when={!scanning()}>
              <button class="btn btn-outline btn-block gap-2" onClick={startScan}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Scan QR Code
              </button>

              <input
                ref={fileInput}
                type="file"
                accept=".json"
                class="hidden"
                onChange={importFile}
              />
              <button class="btn btn-outline btn-block gap-2" onClick={() => fileInput?.click()}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import JSON File
              </button>

              <div class="divider text-xs">OR PASTE</div>
            </Show>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Name</legend>
              <input
                type="text"
                class="input w-full"
                placeholder="Alice"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Identity</legend>
              <textarea
                class="textarea w-full font-mono text-xs h-24"
                placeholder="Paste their identity or share link..."
                value={idInput()}
                onInput={(e) => setIdInput(e.currentTarget.value)}
              />
            </fieldset>

            <Show when={error()}>
              <div role="alert" class="alert alert-error alert-soft">
                <span>{error()}</span>
              </div>
            </Show>

            <button class="btn btn-primary btn-block" onClick={handleAdd}>
              Add Contact
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
