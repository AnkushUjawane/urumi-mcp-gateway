import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev only: pretend to be the real hostname so the cluster's Ingress and the
// gateway's Origin check see a normal same-origin request.
const HOST = "app.localtest.me";
const proxy = {
  target: "http://localhost",       // Traefik, published on port 80 by k3d
  changeOrigin: false,
  configure: (p: any) =>
    p.on("proxyReq", (req: any) => {
      req.setHeader("Host", HOST);
      if (req.getHeader("origin")) req.setHeader("Origin", `http://${HOST}`);
    }),
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": proxy, "/mcp": proxy } },
});
