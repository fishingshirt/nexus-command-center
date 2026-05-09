FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files
COPY public /usr/share/nginx/html

# Ensure proper MIME types
RUN echo 'types { text/javascript js; }' >> /etc/nginx/mime.types

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
