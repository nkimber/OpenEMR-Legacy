FROM node:24-alpine AS build
WORKDIR /app
COPY modernized-openemr/frontend/package*.json ./
RUN npm ci
COPY modernized-openemr/frontend/ ./
ENV VITE_API_BASE_URL=
RUN npm run build

FROM nginx:1.29-alpine
COPY infra/azure/demo/modernized-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
