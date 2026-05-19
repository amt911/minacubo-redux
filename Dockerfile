FROM nginx:alpine

COPY . /usr/share/nginx/html/

RUN rm -rf /usr/share/nginx/html/node_modules \
    && rm -rf /usr/share/nginx/html/.git \
    && rm -rf /usr/share/nginx/html/coverage \
    && rm -rf /usr/share/nginx/html/graphify-out

EXPOSE 80
