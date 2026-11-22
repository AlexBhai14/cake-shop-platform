# ---- Stage 1: build the static site ----
FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Vite reads VITE_* variables at BUILD time, so the API address is baked into the files
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Stage 2: serve with nginx ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
