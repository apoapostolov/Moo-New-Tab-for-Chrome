FROM oven/bun:1.3.1

WORKDIR /app

COPY --chown=bun:bun . .

RUN chown bun:bun /app

USER bun

RUN bun install

EXPOSE 5173

CMD ["bun", "run", "dev:host"]
