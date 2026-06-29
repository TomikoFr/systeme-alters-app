FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js styles.css supabase-config.js /usr/share/nginx/html/
COPY .nojekyll /usr/share/nginx/html/.nojekyll

EXPOSE 80
