FROM node:20 as base
RUN npm install --global dotenv-cli
WORKDIR /app
COPY package.json yarn.lock ./


FROM base as builder
WORKDIR /app
COPY . .
RUN npm install 
RUN npm run prisma:generate
RUN npm run build
ENTRYPOINT [ "npm","run", "start:prod" ]
