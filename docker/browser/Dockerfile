FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /opt/ophiuchus
RUN npm init -y && npm install --omit=dev --ignore-scripts --save-exact playwright@1.64.1 && npm cache clean --force
COPY probe.mjs ./probe.mjs
USER pwuser
ENTRYPOINT ["node", "/opt/ophiuchus/probe.mjs"]
