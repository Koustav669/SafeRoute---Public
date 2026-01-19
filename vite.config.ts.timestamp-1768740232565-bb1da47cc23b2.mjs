// vite.config.ts
import { defineConfig } from "file:///D:/InnovateX%20projects/2025-26/SafeRoute/prototype%20demo%203%20(final)/node_modules/vite/dist/node/index.js";
import react from "file:///D:/InnovateX%20projects/2025-26/SafeRoute/prototype%20demo%203%20(final)/node_modules/@vitejs/plugin-react/dist/index.js";
import svgr from "file:///D:/InnovateX%20projects/2025-26/SafeRoute/prototype%20demo%203%20(final)/node_modules/vite-plugin-svgr/dist/index.js";
import path from "path";
import { miaodaDevPlugin } from "file:///D:/InnovateX%20projects/2025-26/SafeRoute/prototype%20demo%203%20(final)/node_modules/miaoda-sc-plugin/dist/index.js";
var __vite_injected_original_dirname = "D:\\InnovateX projects\\2025-26\\SafeRoute\\prototype demo 3 (final)";
var vite_config_default = defineConfig({
  plugins: [react(), svgr({
    svgrOptions: {
      icon: true,
      exportType: "named",
      namedExport: "ReactComponent"
    }
  }), miaodaDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    // Exclude frontend and other directories from being served
    middlewareMode: false
  },
  build: {
    rollupOptions: {
      input: path.resolve(__vite_injected_original_dirname, "index.html")
    }
  },
  optimizeDeps: {
    entries: ["index.html"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxJbm5vdmF0ZVggcHJvamVjdHNcXFxcMjAyNS0yNlxcXFxTYWZlUm91dGVcXFxccHJvdG90eXBlIGRlbW8gMyAoZmluYWwpXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxJbm5vdmF0ZVggcHJvamVjdHNcXFxcMjAyNS0yNlxcXFxTYWZlUm91dGVcXFxccHJvdG90eXBlIGRlbW8gMyAoZmluYWwpXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9Jbm5vdmF0ZVglMjBwcm9qZWN0cy8yMDI1LTI2L1NhZmVSb3V0ZS9wcm90b3R5cGUlMjBkZW1vJTIwMyUyMChmaW5hbCkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcclxuaW1wb3J0IHN2Z3IgZnJvbSAndml0ZS1wbHVnaW4tc3Zncic7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuaW1wb3J0IHsgbWlhb2RhRGV2UGx1Z2luIH0gZnJvbSBcIm1pYW9kYS1zYy1wbHVnaW5cIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZS5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBzdmdyKHtcclxuICAgICAgc3Znck9wdGlvbnM6IHtcclxuICAgICAgICBpY29uOiB0cnVlLCBleHBvcnRUeXBlOiAnbmFtZWQnLCBuYW1lZEV4cG9ydDogJ1JlYWN0Q29tcG9uZW50JywgfSwgfSksIG1pYW9kYURldlBsdWdpbigpXSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHNlcnZlcjoge1xyXG4gICAgLy8gRXhjbHVkZSBmcm9udGVuZCBhbmQgb3RoZXIgZGlyZWN0b3JpZXMgZnJvbSBiZWluZyBzZXJ2ZWRcclxuICAgIG1pZGRsZXdhcmVNb2RlOiBmYWxzZSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIGlucHV0OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnaW5kZXguaHRtbCcpLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgZW50cmllczogWydpbmRleC5odG1sJ10sXHJcbiAgfSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1ksU0FBUyxvQkFBb0I7QUFDamEsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixPQUFPLFVBQVU7QUFFakIsU0FBUyx1QkFBdUI7QUFMaEMsSUFBTSxtQ0FBbUM7QUFRekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sR0FBRyxLQUFLO0FBQUEsSUFDcEIsYUFBYTtBQUFBLE1BQ1gsTUFBTTtBQUFBLE1BQU0sWUFBWTtBQUFBLE1BQVMsYUFBYTtBQUFBLElBQWtCO0FBQUEsRUFBRyxDQUFDLEdBQUcsZ0JBQWdCLENBQUM7QUFBQSxFQUM5RixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUE7QUFBQSxJQUVOLGdCQUFnQjtBQUFBLEVBQ2xCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixPQUFPLEtBQUssUUFBUSxrQ0FBVyxZQUFZO0FBQUEsSUFDN0M7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsWUFBWTtBQUFBLEVBQ3hCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
