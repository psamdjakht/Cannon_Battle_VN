# Dành cho lần sửa mã máy chủ sau này

Render chạy `server.bundle.js`. File `server.js` là mã nguồn dễ chỉnh sửa.
Sau khi sửa `server.js`, cần tạo lại bundle bằng esbuild:

```bash
npm install --no-save express@5.1.0 socket.io@4.8.1 esbuild@0.25.5
copy node_modules\socket.io\client-dist\socket.io.min.js public\vendor\socket.io.min.js
npx esbuild server.js --bundle --platform=node --target=node20 --format=cjs --outfile=server.bundle.js --minify
```

Không cần commit thư mục `node_modules` lên GitHub.
