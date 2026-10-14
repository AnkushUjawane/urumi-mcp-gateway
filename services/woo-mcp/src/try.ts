import { woo } from "./wooClient.js";
const products: any[] = await woo("GET", "/products", { query: { per_page: 5 } });
console.log(products.map((p) => ({ id: p.id, name: p.name, price: p.price })));
const orders: any[] = await woo("GET", "/orders", { query: { per_page: 5 } });
console.log(orders.map((o) => ({ id: o.id, status: o.status, total: o.total })));
