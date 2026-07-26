import type { MetadataRoute } from "next";
import { APP_BACKGROUND_COLOR } from "@/lib/app-theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shark Money",
    short_name: "Shark Money",
    description: "Finanzas personales con decisiones basadas en datos reales",
    start_url: "/",
    display: "standalone",
    background_color: APP_BACKGROUND_COLOR,
    theme_color: APP_BACKGROUND_COLOR,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
