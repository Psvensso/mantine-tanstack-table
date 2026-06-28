import { defineConfig, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import type { IncomingMessage, ServerResponse } from "node:http";

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
};

const PRODUCTS: Product[] = [
  { id: 1,  sku: "PRD-001", name: "Mechanical Keyboard",    category: "Electronics", price: 1299, stock: 24,  rating: 4.7 },
  { id: 2,  sku: "PRD-002", name: "USB-C Hub 7-in-1",       category: "Electronics", price: 449,  stock: 83,  rating: 4.5 },
  { id: 3,  sku: "PRD-003", name: "Standing Desk Mat",       category: "Office",      price: 379,  stock: 56,  rating: 4.2 },
  { id: 4,  sku: "PRD-004", name: "Ergonomic Mouse",         category: "Electronics", price: 699,  stock: 41,  rating: 4.8 },
  { id: 5,  sku: "PRD-005", name: "Monitor Arm Dual",        category: "Office",      price: 1099, stock: 18,  rating: 4.6 },
  { id: 6,  sku: "PRD-006", name: "Webcam 4K",               category: "Electronics", price: 899,  stock: 30,  rating: 4.4 },
  { id: 7,  sku: "PRD-007", name: "Laptop Stand Aluminium",  category: "Office",      price: 549,  stock: 62,  rating: 4.3 },
  { id: 8,  sku: "PRD-008", name: "Noise-Cancelling Headset",category: "Electronics", price: 2299, stock: 15,  rating: 4.9 },
  { id: 9,  sku: "PRD-009", name: "Cable Management Kit",    category: "Office",      price: 149,  stock: 120, rating: 4.1 },
  { id: 10, sku: "PRD-010", name: "LED Desk Lamp",           category: "Office",      price: 449,  stock: 45,  rating: 4.5 },
  { id: 11, sku: "PRD-011", name: "Wireless Charger 15W",    category: "Electronics", price: 329,  stock: 90,  rating: 4.3 },
  { id: 12, sku: "PRD-012", name: "SSD Enclosure USB4",      category: "Electronics", price: 599,  stock: 27,  rating: 4.6 },
  { id: 13, sku: "PRD-013", name: "Desk Organiser Set",      category: "Office",      price: 249,  stock: 74,  rating: 4.0 },
  { id: 14, sku: "PRD-014", name: "Stream Deck MK.2",        category: "Electronics", price: 1799, stock: 12,  rating: 4.8 },
  { id: 15, sku: "PRD-015", name: "Footrest Adjustable",     category: "Office",      price: 299,  stock: 38,  rating: 4.2 },
  { id: 16, sku: "PRD-016", name: "Thunderbolt 4 Dock",      category: "Electronics", price: 3499, stock: 9,   rating: 4.7 },
  { id: 17, sku: "PRD-017", name: "Whiteboard 90×60",        category: "Office",      price: 699,  stock: 22,  rating: 4.4 },
  { id: 18, sku: "PRD-018", name: "USB Microphone",          category: "Electronics", price: 1099, stock: 33,  rating: 4.6 },
  { id: 19, sku: "PRD-019", name: "Laptop Sleeve 15\"",      category: "Accessories", price: 199,  stock: 98,  rating: 4.1 },
  { id: 20, sku: "PRD-020", name: "Blue Light Glasses",      category: "Accessories", price: 349,  stock: 67,  rating: 3.9 },
  { id: 21, sku: "PRD-021", name: "Wrist Rest Keyboard",     category: "Accessories", price: 179,  stock: 55,  rating: 4.2 },
  { id: 22, sku: "PRD-022", name: "Trackball Mouse",         category: "Electronics", price: 799,  stock: 19,  rating: 4.5 },
  { id: 23, sku: "PRD-023", name: "Portable Monitor 15.6\"", category: "Electronics", price: 2799, stock: 8,   rating: 4.7 },
  { id: 24, sku: "PRD-024", name: "Ergonomic Chair Lumbar",  category: "Office",      price: 4999, stock: 5,   rating: 4.8 },
  { id: 25, sku: "PRD-025", name: "Desk Power Strip 8-way",  category: "Accessories", price: 399,  stock: 44,  rating: 4.3 },
];

function devApiPlugin(): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const [path, qs = ""] = (req.url ?? "").split("?");
          if (path !== "/api/products") {
            next();
            return;
          }

          const params = new URLSearchParams(qs);
          const nameFilter = params.get("name")?.toLowerCase();
          const categoryFilter = params.get("category");

          let results = PRODUCTS;
          if (nameFilter) {
            results = results.filter((p) =>
              p.name.toLowerCase().includes(nameFilter),
            );
          }
          if (categoryFilter) {
            results = results.filter((p) => p.category === categoryFilter);
          }

          setTimeout(() => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(results));
          }, 600);
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), devApiPlugin()],
});
