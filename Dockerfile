# Esta de aqui javier tebas no me la bloquea (denuncien a laliga son unos corruptos)
FROM mirror.gcr.io/library/node:20-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build -- --configuration production --base-href /cliente/

RUN sed -i "s/__BUILD_TIMESTAMP__/$(date +%s)/g" /app/dist/smart-economato/browser/sw.js

FROM mirror.gcr.io/library/nginx:alpine

COPY --from=build /app/dist/smart-economato/browser /usr/share/nginx/html

COPY nginx-custom.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]