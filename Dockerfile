FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .

RUN npm run build -- --configuration production --base-href /cliente/

# Inject current build timestamp into the Service Worker
# This ensures the cache version changes on every deploy, busting stale caches
RUN sed -i "s/__BUILD_TIMESTAMP__/$(date +%s)/g" /app/dist/smart-economato/browser/sw.js

FROM nginx:alpine

COPY --from=build /app/dist/smart-economato/browser /usr/share/nginx/html

COPY nginx-custom.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
