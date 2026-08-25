FROM node:20
ADD ./app /app
WORKDIR /app
RUN npm install